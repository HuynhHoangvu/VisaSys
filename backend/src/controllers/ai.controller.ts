import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { generateInsights, scoreLeadDetailed } from "../services/ruleBasedAI.service.js";
import { streamGeminiResponse } from "../services/geminiAI.service.js";

// ─── Cache ────────────────────────────────────────────────────────────────────
let insightsCache: { ts: number; data: unknown } | null = null;
const CACHE_TTL = 30 * 60 * 1000;
const leadScoreCache = new Map<string, { ts: number; score: number; label: string; reason: string }>();
const LEAD_CACHE_TTL = 60 * 60 * 1000;

// ─── POST /api/ai/insights ────────────────────────────────────────────────────
export const getAIInsights = asyncHandler(async (_req: Request, res: Response) => {
  if (insightsCache && Date.now() - insightsCache.ts < CACHE_TTL) {
    return res.json(insightsCache.data);
  }
  const insights = await generateInsights();
  insightsCache = { ts: Date.now(), data: insights };
  res.json(insights);
});

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
export const aiChat = asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body as { message: string };
  if (!message) return res.status(400).json({ error: "Thiếu nội dung tin nhắn" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const chunk of streamGeminiResponse(message)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi AI";
    res.write(`data: ${JSON.stringify({ text: `\n\n⚠️ Lỗi kết nối AI: ${msg}` })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

// ─── POST /api/ai/lead-score ──────────────────────────────────────────────────
export const getLeadScore = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.body as { taskId: string };
  if (!taskId) return res.status(400).json({ error: "Thiếu taskId" });

  const cached = leadScoreCache.get(taskId);
  if (cached && Date.now() - cached.ts < LEAD_CACHE_TTL) {
    return res.json({ score: cached.score, label: cached.label, reason: cached.reason });
  }

  const scoreData = await scoreLeadDetailed(taskId);
  if (scoreData.score === 1 && scoreData.reason === "Không tìm thấy hồ sơ khách hàng")
    return res.status(404).json({ error: scoreData.reason });

  leadScoreCache.set(taskId, { ts: Date.now(), ...scoreData });
  res.json(scoreData);
});
