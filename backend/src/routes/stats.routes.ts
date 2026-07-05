import { Router } from "express";
import {
  getConversionTrend,
  getPipelineFunnel,
  getEmployeePerformance,
  getRevenueForecast,
  getSourceTrend,
} from "../controllers/stats.controller.js";

const router = Router();

router.get("/conversion-trend", getConversionTrend);
router.get("/pipeline-funnel", getPipelineFunnel);
router.get("/employee-performance", getEmployeePerformance);
router.get("/forecast", getRevenueForecast);
router.get("/source-trend", getSourceTrend);

export default router;
