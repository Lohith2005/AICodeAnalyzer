import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // simple in-memory rate limiter
  let lastAnalysisAt = 0;
  const RATE_LIMIT_MS = 3000;

  app.post("/api/analyze", async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastAnalysisAt < RATE_LIMIT_MS) {
        return res.status(429).json({ message: "Please wait before analyzing again." });
      }
      lastAnalysisAt = now;

      const { code, language } = analyzeCodeSchema.parse(req.body);
      if (!apiKey) {
        return res.status(400).json({ message: "Gemini API key is missing" });
      }

      // check if previously analyzed (avoid burning quota)
      const existing = await storage.findByCode?.(code);
      if (existing) {
        const existingResult: AnalysisResult = {
          linesOfCode: existing.linesOfCode,
          timeComplexity: existing.timeComplexity,
          spaceComplexity: existing.spaceComplexity,
          explanation: existing.explanation
        };
        return res.json(existingResult);
      }

      const linesOfCode = code
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("//"))
        .length;

      const prompt = `Analyze the following ${language} code and provide:
1. Time Complexity in Big-O notation
2. Space Complexity in Big-O notation
3. Brief explanation of the complexity analysis

Code:
\`\`\`${language}
${code}
\`\`\`

Respond in exactly this format:
Time Complexity: O(...)
Space Complexity: O(...)
Explanation: ...`;

      // --- REST API CALL ---
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
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      const timeMatch = text.match(/Time Complexity:\s*(O\([^)]+\))/i);
      const spaceMatch = text.match(/Space Complexity:\s*(O\([^)]+\))/i);
      const explMatch = text.match(/Explanation:\s*(.+)/i);

      const result: AnalysisResult = {
        linesOfCode,
        timeComplexity: timeMatch ? timeMatch[1] : "O(?)",
        spaceComplexity: spaceMatch ? spaceMatch[1] : "O(?)",
        explanation: explMatch ? explMatch[1].trim() : "Analysis completed using AI.",
      };

      await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity: result.timeComplexity,
        spaceComplexity: result.spaceComplexity,
        explanation: result.explanation,
      });

      res.json(result);

    } catch (err) {
      console.error("Analysis error:", err);
      return res.status(500).json({ message: "Failed to analyze. Try again." });
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
