// server.ts
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js"; // File cấu hình Prisma ở bước trước
const app = express();
const PORT = 3001;
// Cho phép frontend gọi API và tự động parse JSON
app.use(cors());
app.use(express.json());
// API Lấy toàn bộ dữ liệu Bảng Kanban (Đúng chuẩn format frontend cần)
app.get("/api/board", async (req, res) => {
    try {
        // 1. Lấy dữ liệu từ DB
        const columnsData = await prisma.column.findMany({
            orderBy: { order: "asc" },
            include: {
                tasks: {
                    include: { activities: true }, // Lấy luôn activities của từng task
                },
            },
        });
        // 2. Chuyển đổi dữ liệu (Transform) về đúng format frontend yêu cầu
        const tasks = {};
        const columns = {};
        const columnOrder = [];
        columnsData.forEach((col) => {
            columnOrder.push(col.id);
            const taskIds = col.tasks.map((t) => t.id);
            columns[col.id] = {
                id: col.id,
                title: col.title,
                taskIds: taskIds,
            };
            // Gom các task vào object 'tasks'
            col.tasks.forEach((task) => {
                tasks[task.id] = {
                    ...task,
                    // Bỏ trường columnId dư thừa khi gửi về frontend nếu không cần
                    columnId: undefined,
                };
            });
        });
        const boardData = {
            tasks,
            columns,
            columnOrder,
        };
        // 3. Trả dữ liệu về cho frontend
        res.json(boardData);
    }
    catch (error) {
        console.error("Lỗi khi lấy dữ liệu:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// Chạy server
app.listen(PORT, () => {
    console.log(`🚀 Backend server đang chạy tại: http://localhost:${PORT}`);
});
