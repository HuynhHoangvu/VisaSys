import "./setup.js";
import request from "supertest";
import app from "../app.js";

describe("Board API", () => {
  const agent = request.agent(app);

  beforeAll(async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "admin@flyvisa.com", password: "admin123" });
  });

  describe("GET /api/board", () => {
    it("trả về 401 khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/board");
      expect(res.status).toBe(401);
    });

    it("trả về board data đúng cấu trúc", async () => {
      const res = await agent.get("/api/board");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tasks");
      expect(res.body).toHaveProperty("columns");
      expect(res.body).toHaveProperty("columnOrder");
      expect(typeof res.body.tasks).toBe("object");
      expect(Array.isArray(res.body.columnOrder)).toBe(true);
    });

    it("columns có đủ thông tin id, title, taskIds", async () => {
      const res = await agent.get("/api/board");

      const columns = Object.values(res.body.columns) as any[];
      expect(columns.length).toBeGreaterThan(0);
      columns.forEach((col) => {
        expect(col).toHaveProperty("id");
        expect(col).toHaveProperty("title");
        expect(col).toHaveProperty("taskIds");
      });
    });

    it("tasks map có đầy đủ thông tin", async () => {
      const res = await agent.get("/api/board");

      const tasks = Object.values(res.body.tasks) as any[];
      if (tasks.length > 0) {
        expect(tasks[0]).toHaveProperty("id");
        expect(tasks[0]).toHaveProperty("content");
        expect(tasks[0]).toHaveProperty("phone");
        expect(tasks[0]).toHaveProperty("price");
      }
    });
  });
});
