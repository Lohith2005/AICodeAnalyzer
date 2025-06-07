import { analyses, type Analysis, type InsertAnalysis } from "@shared/schema";

export interface IStorage {
  getAnalysis(id: number): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getRecentAnalyses(limit?: number): Promise<Analysis[]>;
}

export class MemStorage implements IStorage {
  private analyses: Map<number, Analysis>;
  private currentId: number;

  constructor() {
    this.analyses = new Map();
    this.currentId = 1;
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = this.currentId++;
    const analysis: Analysis = {
      ...insertAnalysis,
      id,
      createdAt: new Date(),
      explanation: insertAnalysis.explanation || null,
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getRecentAnalyses(limit = 10): Promise<Analysis[]> {
    return Array.from(this.analyses.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
