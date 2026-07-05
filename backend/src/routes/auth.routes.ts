import { Router } from "express";
import { login, logout, getCurrentUser, changePassword, refreshSession, forgotPassword } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema } from "../schemas/index.js";

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@flyvisa.com }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Employee' }
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post("/login", validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post("/logout", logout);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Làm mới session
 *     responses:
 *       200:
 *         description: Session hợp lệ
 */
router.post("/refresh", refreshSession);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Employee' }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/me", getCurrentUser);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Đổi mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 */
router.put("/change-password", changePassword);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Quên mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Đã gửi email reset
 */
router.post("/forgot-password", forgotPassword);

export default router;
