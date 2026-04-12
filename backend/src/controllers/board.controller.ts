import { prisma } from "../../lib/prisma.js";
import { Request, Response } from "express";
/**
 * Retrieve board structure and related task activity for the kanban view.
 * The frontend expects a payload containing tasks, columns, and columnOrder.
 */
export const getBoardData = async (req: Request, res: Response) => {
  try {
    /**
     * Load all board columns with their tasks and recent activities.
     * The frontend expects tasks keyed by id and columns containing task order.
     */
    const columnsData = await prisma.column.findMany({
      orderBy: { order: "asc" },
      include: {
        tasks: {
          include: {
            activities: {
              orderBy: { createdAt: "desc" }, 
            },
          },
        },
      },
    });

    // Transform data to the frontend format.
    const tasks: Record<string, any> = {};
    const columns: Record<string, any> = {};
    const columnOrder: string[] = [];

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
          columnId: undefined, 
        };
      });
    });

    // Return the board payload.
    res.status(200).json({
      tasks,
      columns,
      columnOrder,
    });
  } catch (error) {
    console.error("Lỗi getBoardData:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};