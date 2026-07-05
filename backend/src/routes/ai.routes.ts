import { Router } from "express";
import { getAIInsights, aiChat, getLeadScore } from "../controllers/ai.controller.js";

const router = Router();

/**
 * @swagger
 * /api/ai/insights:
 *   post:
 *     tags: [AI]
 *     summary: Lấy AI insights cho Dashboard
 *     description: Phân tích rule-based dữ liệu kinh doanh, cache 30 phút
 *     responses:
 *       200:
 *         description: Danh sách insights
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type: { type: string, enum: [warning, opportunity, success, info] }
 *                   title: { type: string }
 *                   body: { type: string }
 *                   action: { type: string }
 */
router.post("/insights", getAIInsights);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Chat với Gemini AI (Server-Sent Events streaming)
 *     description: Truy vấn DB lấy context thực tế rồi gửi Gemini sinh câu trả lời. Response dạng SSE stream.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "Doanh thu tháng này bao nhiêu?" }
 *     responses:
 *       200:
 *         description: SSE stream — mỗi event là `data: {"text":"..."}`, kết thúc bằng `data: [DONE]`
 *         content:
 *           text/event-stream:
 *             schema: { type: string }
 */
router.post("/chat", aiChat);

/**
 * @swagger
 * /api/ai/lead-score:
 *   post:
 *     tags: [AI]
 *     summary: Chấm điểm tiềm năng khách hàng (Lead Scoring)
 *     description: Phân tích nguồn khách, hoạt động, giá trị hợp đồng và hồ sơ. Cache 1 giờ.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskId]
 *             properties:
 *               taskId: { type: string, example: "task-3" }
 *     responses:
 *       200:
 *         description: Kết quả chấm điểm
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LeadScore' }
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.post("/lead-score", getLeadScore);

export default router;
