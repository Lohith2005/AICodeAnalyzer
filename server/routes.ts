import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
);

// cheaper model = flash-lite
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
   const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// simple in-memory rate limiter
let lastAnalysisAt = 0;
const RATE_LIMIT_MS = 3000; // 3 seconds

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastAnalysisAt < RATE_LIMIT_MS) {
        return res.status(429).json({ message: "Please wait a moment before analyzing again." });
      }
      lastAnalysisAt = now;

      const { code, language } = analyzeCodeSchema.parse(req.body);

      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return res.status(400).json({
          message: "Gemini API key not configured. Add GEMINI_API_KEY in .env"
        });
      }

      // check if we've already analyzed this exact code
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
Explanation: [Brief explanation]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const timeMatch = text.match(/Time Complexity:\s*(O\([^)]+\))/i);
      const spaceMatch = text.match(/Space Complexity:\s*(O\([^)]+\))/i);
      const explMatch = text.match(/Explanation:\s*(.+)/i);

      const timeComplexity = timeMatch ? timeMatch[1] : "O(?)";
      const spaceComplexity = spaceMatch ? spaceMatch[1] : "O(?)";
      const explanation = explMatch ? explMatch[1].trim() : "Analysis completed using AI.";

      await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      });

      const response: AnalysisResult = {
        linesOfCode,
        timeComplexity,
       spaceComplexity,
        explanation,
      };

      res.json(response);
    } catch (error) {
      console.error("Analysis error:", error);

      const message = error instanceof Error ? error.message : "";
      if (message.includes("quota") || message.includes("rate")) {
        return res.status(429).json({
          message: "API quota exceeded. Try again later."
        });
      }

      return res.status(500).json({
        message: "Failed to analyze code. Please try again."
      });
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
