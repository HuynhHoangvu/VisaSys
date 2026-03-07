// src/routes/board.routes.ts
import { Router } from "express";
import { getBoardData } from "../controllers/board.controller.js";
const router = Router();
// Endpoint: GET /api/board
router.get("/", getBoardData);
export default router;
