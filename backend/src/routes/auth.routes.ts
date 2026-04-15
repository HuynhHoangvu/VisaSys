import { Router } from "express";
import { login, logout, getCurrentUser, changePassword } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema } from "../schemas/index.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", getCurrentUser);
router.put("/change-password", changePassword);

export default router;
