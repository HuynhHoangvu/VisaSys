// lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { prismaAdapter } from "../config/database.js";

const prisma = new PrismaClient({ adapter: prismaAdapter });

export { prisma };
