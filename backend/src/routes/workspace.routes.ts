import { Router } from "express";
import { requireAuth } from "../middlewares/authorize.js";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../controllers/workspace.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/",        getWorkspaces);
router.post("/",       createWorkspace);
router.put("/:id",     updateWorkspace);
router.delete("/:id",  deleteWorkspace);

export default router;
