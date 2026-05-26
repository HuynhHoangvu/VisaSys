import { prisma } from "../../lib/prisma.js";

export const getDepartmentsService = async () => {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
  });
};

export const createDepartmentService = async (name: string) => {
  return prisma.department.create({ data: { name } });
};

export const updateDepartmentService = async (id: string, name: string) => {
  return prisma.department.update({ where: { id }, data: { name } });
};

export const deleteDepartmentService = async (id: string) => {
  return prisma.department.delete({ where: { id } });
};
