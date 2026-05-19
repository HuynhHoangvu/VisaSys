import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { requireAuth, requirePermission } from "../middlewares/authorize.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getAccessCatalog,
  getAccessMatrix,
  putAccessMatrix,
  getAccessEmployees,
  getEmployeeAccessEffective,
  putEmployeeAccessOverride,
  deleteEmployeeAccessOverride,
} from "../controllers/access.controller.js";
import { accessMatrixPutSchema, employeeOverridePutSchema } from "../schemas/index.js";

const router = Router();

const rbac = [requireAuth, requirePermission(["system.rbac.manage"])] as const;

router.get("/catalog", rbac[0], rbac[1], asyncHandler(getAccessCatalog));
router.get("/matrix", rbac[0], rbac[1], asyncHandler(getAccessMatrix));
router.put("/matrix", rbac[0], rbac[1], validate(accessMatrixPutSchema), asyncHandler(putAccessMatrix));
router.get("/employees", rbac[0], rbac[1], asyncHandler(getAccessEmployees));
router.get("/employees/:id/effective", rbac[0], rbac[1], asyncHandler(getEmployeeAccessEffective));
router.put("/employees/:id/override", rbac[0], rbac[1], validate(employeeOverridePutSchema), asyncHandler(putEmployeeAccessOverride));
router.delete("/employees/:id/override", rbac[0], rbac[1], asyncHandler(deleteEmployeeAccessOverride));

export default router;
