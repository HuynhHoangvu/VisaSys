import { Router } from "express";
import { requireAuth } from "../middlewares/authorize.js";
import { getChatUsers, getDmRoom, getMessages, getConversations } from "../controllers/chat.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/users", getChatUsers);
router.get("/conversations", getConversations);
router.get("/dm/:targetId", getDmRoom);
router.get("/rooms/:roomId/messages", getMessages);

export default router;
