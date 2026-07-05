import "./setup.js";
import request from "supertest";
import app from "../app.js";

describe("AI API", () => {
  const agent = request.agent(app);

  beforeAll(async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "admin@flyvisa.com", password: "admin123" });
  });

  describe("POST /api/ai/insights", () => {
    it("trả về danh sách insights hợp lệ", async () => {
      const res = await agent.post("/api/ai/insights");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("type");
        expect(res.body[0]).toHaveProperty("title");
        expect(res.body[0]).toHaveProperty("body");
        expect(["warning", "opportunity", "success", "info"]).toContain(res.body[0].type);
      }
    });
  });

  describe("POST /api/ai/lead-score", () => {
    it("trả về lead score hợp lệ", async () => {
      const boardRes = await agent.get("/api/board");
      const taskIds = Object.keys(boardRes.body.tasks);
      if (taskIds.length === 0) return;

      const res = await agent
        .post("/api/ai/lead-score")
        .send({ taskId: taskIds[0] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("score");
      expect(res.body).toHaveProperty("label");
      expect(res.body).toHaveProperty("reason");
      expect(res.body.score).toBeGreaterThanOrEqual(1);
      expect(res.body.score).toBeLessThanOrEqual(10);
      expect(["Nóng", "Ấm", "Lạnh"]).toContain(res.body.label);
    });

    it("trả về 400 khi thiếu taskId", async () => {
      const res = await agent.post("/api/ai/lead-score").send({});
      expect(res.status).toBe(400);
    });

    it("trả về 404 khi task không tồn tại", async () => {
      const res = await agent
        .post("/api/ai/lead-score")
        .send({ taskId: "task-khong-ton-tai-xyz-999" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/ai/chat", () => {
    it("trả về 400 khi thiếu message", async () => {
      const res = await agent.post("/api/ai/chat").send({});
      expect(res.status).toBe(400);
    });

    it("trả về SSE stream với [DONE] ở cuối", async () => {
      const res = await agent
        .post("/api/ai/chat")
        .send({ message: "Tổng số hồ sơ hiện tại" })
        .buffer(true)
        .parse((res, callback) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => callback(null, data));
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.body).toContain("[DONE]");
    }, 60000);
  });
});
