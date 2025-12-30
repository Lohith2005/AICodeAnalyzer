import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";

// simple in-memory rate limiter
let lastAnalysisAt = 0;
const RATE_LIMIT_MS = 3000; // 3 seconds

export async function registerRoutes(app: Express): Promise<Server> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  app.post("/api/analyze", async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastAnalysisAt < RATE_LIMIT_MS) {
        return res.status(429).json({
          message: "Please wait a moment before analyzing again."
        });
      }
      lastAnalysisAt = now;

      const { code, language } = analyzeCodeSchema.parse(req.body);

      if (!apiKey) {
        return res.status(400).json({
          message: "Gemini API key not configured. Add GEMINI_API_KEY in .env"
        });
      }

      // check if already analyzed
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

      // count meaningful lines
      const lines = code.split("\n");
      const nonEmptyLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith("//")) return false;
        if (trimmed.startsWith("#")) return false;
        if (trimmed.startsWith("/*")) return false;
        if (trimmed.startsWith("*")) return false;
        if (trimmed.startsWith("*/")) return false;
        return true;
      });
      const linesOfCode = nonEmptyLines.length;

      // ===== PROMPT (your original one) =====
      const prompt = `Analyze the following ${language} code and provide:
1. Time Complexity in Big-O notation
2. Space Complexity in Big-O notation
3. Brief explanation of the complexity analysis

Code:
\`\`\`${language}
${code}
\`\`\`

Please respond in this exact format:
Time Complexity: O(...)
Space Complexity: O(...)
Explanation: [Brief explanation of why these complexities were determined]`;

      // ===== CALL GOOGLE GEMINI (REST API) =====
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
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.text ??
        "";

      // ===== STRONG PARSER FOR AI OUTPUT =====
      const clean = text
        .replace(/```/g, "")
        .replace(/\r?\n|\r/g, " ")
        .trim();

      let timeComplexity = "O(?)";
      let spaceComplexity = "O(?)";
      let explanation = "Analysis completed using AI.";

      try {
        const timeMatch = clean.match(/Time Complexity:\s*(O\([^)\]]+\))/i);
        const spaceMatch = clean.match(/Space Complexity:\s*(O\([^)\]]+\))/i);
        const explMatch = clean.match(/Explanation:\s*(.+?)(?:$|\s{2,})/i);

        if (timeMatch) timeComplexity = timeMatch[1];
        if (spaceMatch) spaceComplexity = spaceMatch[1];
        if (explMatch) explanation = explMatch[1].trim();
      } catch {}

      // ===== SAVE TO DB =====
      await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      });

      // ===== SEND RESULT =====
      const response: AnalysisResult = {
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      };

      res.json(response);

    } catch (error) {
      console.error("Analysis error:", error);
      return res.status(500).json({
        message: "Failed to analyze code. Please try again."
      });
    }
  });

  // Return last 10 analyses
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
