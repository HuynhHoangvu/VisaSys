import { Router } from "express";
import { getBoardData } from "../controllers/board.controller.js";

const router = Router();

router.get("/", getBoardData);

export default router;