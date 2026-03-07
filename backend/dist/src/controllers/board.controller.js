import { prisma } from "../../lib/prisma.js";
export const getBoardData = async (req, res) => {
    try {
        // 1. Lấy toàn bộ Column, kèm theo Task bên trong, và Activity của từng Task
        const columnsData = await prisma.column.findMany({
            orderBy: { order: "asc" },
            include: {
                tasks: {
                    include: {
                        activities: {
                            orderBy: { createdAt: "desc" }, // Sắp xếp hoạt động mới nhất lên đầu
                        },
                    },
                },
            },
        });
        // 2. Chuyển đổi dữ liệu sang format Frontend cần
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
            col.tasks.forEach((task) => {
                tasks[task.id] = {
                    ...task,
                    columnId: undefined, // Xóa trường này đi cho sạch data gửi về frontend
                };
            });
        });
        // 3. Trả về kết quả
        res.status(200).json({
            tasks,
            columns,
            columnOrder,
        });
    }
    catch (error) {
        console.error("Lỗi getBoardData:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
