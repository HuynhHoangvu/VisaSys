import Redis from "ioredis";
import { logger } from "./logger.js";

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

  redis.on("connect", () => logger.info("[redis] connected"));
  redis.on("error", (err) => logger.warn({ err: err.message }, "[redis] connection error — cache disabled"));
  redis.on("close", () => logger.warn("[redis] connection closed"));

  redis.connect().catch(() => {
    // Non-fatal — app runs without cache
    redis = null;
  });
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null;
  try { return await redis.get(key); }
  catch { return null; }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 60): Promise<void> {
  if (!redis) return;
  try { await redis.set(key, value, "EX", ttlSeconds); }
  catch { /* non-fatal */ }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try { await redis.del(key); }
  catch { /* non-fatal */ }
}

export async function redisIsConnected(): Promise<boolean> {
  if (!redis) return false;
  try { await redis.ping(); return true; }
  catch { return false; }
}

export { redis };
