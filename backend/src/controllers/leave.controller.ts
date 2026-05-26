import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  createLeaveRequestService,
  createBulkLeaveRequestService,
  getLeaveRequestsService,
  getLeaveRequestsByEmployeeService,
  updateLeaveRequestStatusService,
} from "../services/leave.service.js";

export const createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const { newRequest, empName, receivers } = await createLeaveRequestService(id, req.body);
    getIO().emit("new_notification", { message: `Có đơn mới từ ${empName}`, receivers });
    getIO().emit("data_changed");
    res.status(201).json(newRequest);
  } catch (error: any) {
    if (error.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

export const createBulkLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  try {
    const count = await createBulkLeaveRequestService(req.body);
    getIO().emit("data_changed");
    res.status(201).json({ 
      success: true, 
      count,
      message: `Đã tạo đơn nghỉ cho ${count} nhân viên` 
    });
  } catch (error: any) {
    if (error.message === "Không có nhân viên nào trong hệ thống") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const getLeaveRequests = asyncHandler(async (_req: Request, res: Response) => {
  const requests = await getLeaveRequestsService();
  res.json(requests);
});

export const getLeaveRequestsByEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requests = await getLeaveRequestsByEmployeeService(id);
  res.json(requests);
});

export const updateLeaveRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;
  
  try {
    const updated = await updateLeaveRequestStatusService(id, status);
    getIO().emit("data_changed");
    res.json(updated);
  } catch (error: any) {
    if (error.message === "Không tìm thấy đơn xin nghỉ này!") {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});
