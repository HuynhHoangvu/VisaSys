import { Router } from "express";
import { getWeeklyKPI, updateWeeklyKPI } from "../controllers/kpi.controller.js";

const router = Router();

router.get("/", getWeeklyKPI);
router.post("/", updateWeeklyKPI);

export default router;