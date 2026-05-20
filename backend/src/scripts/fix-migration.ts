import { execSync } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("🛠️ Bắt đầu sửa lỗi migration...");

  // Step 1: Mark the session migration as applied so `prisma migrate deploy`
  // does not try to re-run it (the table is created below via raw SQL).
  try {
    console.log("👉 Đánh dấu migration là đã hoàn thành (bỏ qua lỗi)...");
    execSync('npx prisma migrate resolve --applied 20260520000000_add_session_table', { stdio: 'inherit' });
  } catch (error) {
    console.log("⚠️ Migration đã được resolve hoặc không tồn tại (có thể bỏ qua).");
  }

  // Step 2: Create the session table directly via pg so it exists before the
  // app starts.  Using a raw pg.Pool avoids the custom Prisma adapter path
  // and works reliably in the Railway release phase.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log("👉 Kiểm tra và tạo bảng session nếu chưa có...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL,
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");
    `);

    console.log("✅ Bảng session đã sẵn sàng!");
  } catch (error) {
    console.error("❌ Lỗi khi tạo bảng session:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
