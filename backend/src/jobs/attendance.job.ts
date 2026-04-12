import cron from "node-cron";
import { runPenalizeForgotCheckout } from "../controllers/attendance.controller.js";

/**
 * Registers all attendance-related cron jobs.
 * Call once at server startup — do not call on each request.
 */
export const scheduleAttendanceJobs = (): void => {
  // Every night at 23:59 — penalize employees who forgot to check out
  cron.schedule("59 23 * * *", async () => {
    console.log("⏰ Running forgot-checkout penalty job...");
    try {
      const { penalized } = await runPenalizeForgotCheckout();
      console.log(`✅ Done: penalized ${penalized} employee(s).`);
    } catch (err) {
      console.error("❌ forgot-checkout job failed:", err);
    }
  });
};
