import { Router } from "express";
import { getWeeklyKPI, updateWeeklyKPI } from "../controllers/kpi.controller.js";

const router = Router();

router.get("/", getWeeklyKPI);
router.post("/", updateWeeklyKPI); // Dùng POST cho hàm Upsert

export default router;