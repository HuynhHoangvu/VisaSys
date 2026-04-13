import { Router } from "express";
import { createActivity, updateActivity, deleteActivity } from "../controllers/activity.controller.js";

const router = Router();

router.post("/", createActivity);         
router.put("/:id", updateActivity);       
router.delete("/:id", deleteActivity);    

export default router;