import { prisma } from "../../lib/prisma.js";

export const getBoardDataService = async () => {
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

  return { tasks, columns, columnOrder };
};
