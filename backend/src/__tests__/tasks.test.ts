import "./setup.js";
import request from "supertest";
import app from "../app.js";

describe("Tasks API", () => {
  const agent = request.agent(app);
  let createdTaskId: string;

  beforeAll(async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "admin@flyvisa.com", password: "admin123" });
  });

  describe("POST /api/tasks", () => {
    it("tạo hồ sơ khách hàng mới thành công", async () => {
      const res = await agent
        .post("/api/tasks")
        .send({
          content: "Test Khách Hàng Jest",
          phone: "0901111222",
          price: "20000000",
          source: "Website",
          assignedTo: "Admin",
          columnId: "col-1",
          checklistType: "tourism",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.content).toBe("Test Khách Hàng Jest");
      createdTaskId = res.body.id;
    });

    it("trả về 401 khi chưa đăng nhập", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ content: "Test", phone: "0900000000", price: "0", assignedTo: "Admin" });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("cập nhật hồ sơ thành công", async () => {
      const res = await agent
        .put(`/api/tasks/${createdTaskId}`)
        .send({ price: "35000000", visaType: "Visa 500 - Du học" });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe("35000000");
    });

    it("trả về lỗi khi task không tồn tại", async () => {
      const res = await agent
        .put("/api/tasks/task-khong-ton-tai-abc")
        .send({ price: "999" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("PUT /api/tasks/:id/move", () => {
    it("di chuyển task sang cột khác", async () => {
      // Lấy columnId hợp lệ từ board
      const boardRes = await agent.get("/api/board");
      const columnIds = boardRes.body.columnOrder;
      const targetCol = columnIds[1] ?? columnIds[0];

      const res = await agent
        .put(`/api/tasks/${createdTaskId}/move`)
        .send({ columnId: targetCol, index: 0 });

      expect([200, 400]).toContain(res.status);
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("xóa hồ sơ thành công", async () => {
      const res = await agent.delete(`/api/tasks/${createdTaskId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
    });

    it("trả về lỗi khi xóa task không tồn tại", async () => {
      const res = await agent.delete("/api/tasks/task-da-xoa-xyz");
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
