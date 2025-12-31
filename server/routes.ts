import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";

const RATE_LIMIT_MS = 3000;
let lastAnalysisAt = 0;

export async function registerRoutes(app: Express): Promise<Server> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  app.post("/api/analyze", async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastAnalysisAt < RATE_LIMIT_MS) {
        return res.status(429).json({ message: "Slow down 😅 Wait a few seconds." });
      }
      lastAnalysisAt = now;

      const { code, language } = analyzeCodeSchema.parse(req.body);
      if (!apiKey) return res.status(400).json({ message: "Gemini API key missing ⚠️" });

      const existing = await storage.findByCode?.(code);
      if (existing) {
        return res.json({
          linesOfCode: existing.linesOfCode,
          timeComplexity: existing.timeComplexity,
          spaceComplexity: existing.spaceComplexity,
          explanation: existing.explanation
        });
      }

      const linesOfCode = code
        .split("\n")
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("#");
        }).length;

      const prompt = `
Analyze the following ${language} code and ONLY return JSON in this exact format:

{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "explanation": "..."
}

Code:
\`\`\`${language}
${code}
\`\`\`
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-client": "genai-js/1.0.0"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }]
              }
            ]
          })
        }
      );

      const json = await response.json();
      console.log("🔥 RAW GEMINI RESPONSE:", json);

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      let parsed = {};
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch {}

      const result: AnalysisResult = {
        linesOfCode,
        timeComplexity: parsed.timeComplexity ?? "O(?)",
        spaceComplexity: parsed.spaceComplexity ?? "O(?)",
        explanation: parsed.explanation ?? "AI could not analyze this code."
      };

      await storage.createAnalysis({ code, language, ...result });
      return res.json(result);

    } catch (err) {
      console.error("🔥 SERVER ERROR:", err);
      res.status(500).json({ message: "Server crashed analyzing code 😭" });
    }
  });

  app.get("/api/analyses", async (_, res) => {
    try {
      res.json(await storage.getRecentAnalyses(10));
    } catch {
      res.status(500).json({ message: "Failed fetching history" });
    }
  });

  return createServer(app);
}
