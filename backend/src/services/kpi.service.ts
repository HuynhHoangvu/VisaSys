import { prisma } from "../../lib/prisma.js";

export const getWeeklyKPIService = async (weekLabel: string) => {
  const kpiData = await prisma.weeklyKPI.findUnique({
    where: { weekLabel },
  });
  return kpiData ? kpiData.data : null;
};

export const updateWeeklyKPIService = async (weekLabel: string, data: any) => {
  return prisma.weeklyKPI.upsert({
    where: { weekLabel },
    update: { data },
    create: { weekLabel, data },
  });
};
