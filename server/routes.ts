import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";

// simple rate limiter
let lastAnalysisAt = 0;
const RATE_LIMIT_MS = 3000;

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

      // check if already analyzed
      const existing = await storage.findByCode?.(code);
      if (existing) {
        return res.json({
          linesOfCode: existing.linesOfCode,
          timeComplexity: existing.timeComplexity,
          spaceComplexity: existing.spaceComplexity,
          explanation: existing.explanation
        });
      }

      // count meaningful lines
      const linesOfCode = code
        .split("\n")
        .filter((line) => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          if (trimmed.startsWith("//")) return false;
          if (trimmed.startsWith("#")) return false;
          if (trimmed.startsWith("/*")) return false;
          if (trimmed.startsWith("*")) return false;
          if (trimmed.startsWith("*/")) return false;
          return true;
        }).length;

      // ---- JSON PROMPT (stable output) ----
      const prompt = `Analyze the following ${language} code and ONLY return JSON.
No markdown. No explanation text before or after. ONLY JSON.

Required:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "explanation": "..."
}

Code:
\`\`\`${language}
${code}
\`\`\``;

      // ---- REST CALL ----
      const responseAI = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await responseAI.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
console.log("🔥 RAW GEMINI RESPONSE:", text);
      // normalize + parse JSON
      text = text.replace(/```json|```/g, "").trim();
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }

      const timeComplexity = parsed.timeComplexity ?? "O(?)";
      const spaceComplexity = parsed.spaceComplexity ?? "O(?)";
      const explanation = parsed.explanation ?? "Analysis unavailable";

      // save
      await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      });

      // send result
      const result: AnalysisResult = {
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      };
      res.json(result);

    } catch (err) {
      console.error("Analysis error:", err);
      res.status(500).json({ message: "Failed to analyze" });
    }
  });

  // return recent
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
