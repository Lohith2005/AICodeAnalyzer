import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";

let lastAnalysisAt = 0;
const RATE_LIMIT_MS = 3000;
const MODEL = "models/gemini-2.0-flash-lite-001";

export async function registerRoutes(app: Express): Promise<Server> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  app.post("/api/analyze", async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastAnalysisAt < RATE_LIMIT_MS) {
        return res.status(429).json({ message: "Please wait before analyzing again." });
      }
      lastAnalysisAt = now;

      const { code, language } = analyzeCodeSchema.parse(req.body);
      if (!apiKey) return res.status(400).json({ message: "API key missing" });

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
        .filter((line) => {
          const t = line.trim();
          return t && !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("/*") && !t.startsWith("*") && !t.startsWith("*/");
        }).length;

      // strict JSON prompt (forces Gemini to reply JSON)
      const prompt = `Analyze the following ${language} code and ONLY return JSON:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "explanation": "..."
}

Code:
\`\`\`${language}
${code}
\`\`\``;

const responseAI = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  }
);


      const data = await responseAI.json();
      let text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      console.log("🔥 RAW GEMINI RESPONSE:", text);

      text = text.replace(/```json|```/g, "").trim();

      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      let timeComplexity =
        parsed.timeComplexity ??
        (text.match(/Time Complexity:\s*(O\([^)]+\))/i)?.[1] ?? "O(?)");

      let spaceComplexity =
        parsed.spaceComplexity ??
        (text.match(/Space Complexity:\s*(O\([^)]+\))/i)?.[1] ?? "O(?)");

      let explanation =
        parsed.explanation ??
        (text.match(/Explanation:\s*(.+)/i)?.[1] ?? "AI analysis unavailable");

      await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      });

      const result: AnalysisResult = {
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation
      };

      res.json(result);

    } catch (err) {
      console.error("Analysis error:", err);
      res.status(500).json({ message: "Failed to analyze" });
    }
  });

  app.get("/api/analyses", async (_req, res) => {
    try {
      const list = await storage.getRecentAnalyses(10);
      res.json(list);
    } catch {
      res.status(500).json({ message: "Failed to fetch analyses" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
