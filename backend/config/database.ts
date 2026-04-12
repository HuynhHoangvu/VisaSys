import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL, assertDatabaseUrl } from "./env.js";

assertDatabaseUrl();

export const connectionString = DATABASE_URL;
export const prismaAdapter = new PrismaPg({ connectionString });
