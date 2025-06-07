import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeCodeSchema, type AnalysisResult } from "@shared/schema";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
  );

  // Analyze code endpoint
  app.post("/api/analyze", async (req, res) => {
    try {
      const { code, language } = analyzeCodeSchema.parse(req.body);

      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return res.status(400).json({ 
          message: "Gemini API key not configured. Please set GEMINI_API_KEY or GOOGLE_API_KEY environment variable." 
        });
      }

      // Count non-empty, non-comment lines
      const lines = code.split('\n');
      const nonEmptyLines = lines.filter(line => {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed) return false;
        if (trimmed.startsWith('//')) return false; // JavaScript/Java/C++ comments
        if (trimmed.startsWith('#')) return false;  // Python/Shell comments
        if (trimmed.startsWith('/*')) return false; // Block comments start
        if (trimmed.startsWith('*')) return false;  // Block comments middle
        if (trimmed.startsWith('*/')) return false; // Block comments end
        return true;
      });
      const linesOfCode = nonEmptyLines.length;

      // Create Gemini model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Prepare prompt for Gemini
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

      // Get analysis from Gemini
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the response
      const timeComplexityMatch = text.match(/Time Complexity:\s*(O\([^)]+\))/i);
      const spaceComplexityMatch = text.match(/Space Complexity:\s*(O\([^)]+\))/i);
      const explanationMatch = text.match(/Explanation:\s*(.+)/i);

      const timeComplexity = timeComplexityMatch ? timeComplexityMatch[1] : "O(?)";
      const spaceComplexity = spaceComplexityMatch ? spaceComplexityMatch[1] : "O(?)";
      const explanation = explanationMatch ? explanationMatch[1].trim() : "Analysis completed using AI.";

      // Save analysis to storage
      const analysis = await storage.createAnalysis({
        code,
        language,
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      });

      const analysisResult: AnalysisResult = {
        linesOfCode,
        timeComplexity,
        spaceComplexity,
        explanation,
      };

      res.json(analysisResult);
    } catch (error) {
      console.error("Analysis error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("API_KEY")) {
          return res.status(400).json({ 
            message: "Invalid or missing Gemini API key. Please check your API key configuration." 
          });
        }
        if (error.message.includes("quota") || error.message.includes("rate")) {
          return res.status(429).json({ 
            message: "API quota exceeded or rate limit hit. Please try again later." 
          });
        }
      }

      res.status(500).json({ 
        message: "Failed to analyze code. Please check your code and try again." 
      });
    }
  });

  // Get recent analyses
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getRecentAnalyses(10);
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      res.status(500).json({ message: "Failed to fetch analyses" });
    }
  });

  // Test API connection
  app.post("/api/test-connection", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return res.status(400).json({ 
          message: "Gemini API key not configured", 
          connected: false 
        });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("Hello");
      
      res.json({ 
        message: "API connection successful", 
        connected: true 
      });
    } catch (error) {
      console.error("Connection test error:", error);
      res.status(400).json({ 
        message: "API connection failed. Please check your API key.", 
        connected: false 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
