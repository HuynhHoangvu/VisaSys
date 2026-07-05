import { Router } from "express";
import { getBoardData } from "../controllers/board.controller.js";

const router = Router();

/**
 * @swagger
 * /api/board:
 *   get:
 *     tags: [Board]
 *     summary: Lấy toàn bộ dữ liệu Kanban board
 *     description: Trả về tasks (map by id), columns (map by id), và columnOrder
 *     responses:
 *       200:
 *         description: Dữ liệu board
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: object
 *                   additionalProperties: { $ref: '#/components/schemas/Task' }
 *                 columns:
 *                   type: object
 *                 columnOrder:
 *                   type: array
 *                   items: { type: string }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/", getBoardData);

export default router;