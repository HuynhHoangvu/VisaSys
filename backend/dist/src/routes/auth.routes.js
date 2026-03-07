// backend/src/routes/auth.routes.ts
import { Router } from "express";
import { login, logout, getCurrentUser } from "../controllers/auth.controller.js";
const router = Router();
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", getCurrentUser);
export default router;
