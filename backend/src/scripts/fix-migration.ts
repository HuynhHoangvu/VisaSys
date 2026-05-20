import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log("🛠️ Bắt đầu sửa lỗi migration...");

  try {
    console.log("👉 Đánh dấu migration là đã hoàn thành (bỏ qua lỗi)...");
    execSync('npx prisma migrate resolve --applied 20260520000000_add_session_table', { stdio: 'inherit' });
  } catch (error) {
    console.log("⚠️ Migration đã được resolve hoặc không tồn tại (có thể bỏ qua).");
  }

  const prisma = new PrismaClient();
  try {
    console.log("👉 Kiểm tra và tạo bảng session nếu chưa có...");
    // Attempt to create table manually to ensure it exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL,
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    
    // Create index (we must catch error if index already exists because IF NOT EXISTS for index is supported only in Postgres 9.5+)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");
      `);
    } catch (e) {
      console.log("⚠️ Index có thể đã tồn tại.");
    }
    
    console.log("✅ Bảng session đã sẵn sàng!");
  } catch (error) {
    console.error("❌ Lỗi khi tạo bảng session:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
