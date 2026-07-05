import "./setup.js";
import request from "supertest";
import app from "../app.js";

describe("HR API", () => {
  const agent = request.agent(app);
  let employeeId: string;

  beforeAll(async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "admin@flyvisa.com", password: "admin123" });
  });

  describe("GET /api/hr/employees", () => {
    it("trả về danh sách nhân viên", async () => {
      const res = await agent.get("/api/hr/employees");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("role");

      employeeId = res.body[0].id;
    });

    it("trả về 401 khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/hr/employees");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/hr/departments", () => {
    it("trả về danh sách phòng ban", async () => {
      const res = await agent.get("/api/hr/departments");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
    });
  });

  describe("GET /api/hr/leave-requests", () => {
    it("trả về danh sách đơn xin nghỉ", async () => {
      const res = await agent.get("/api/hr/leave-requests");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/hr/salary/history", () => {
    it("trả về lịch sử lương", async () => {
      const res = await agent.get("/api/hr/salary/history");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/hr/employees/:id/checkin", () => {
    it("check-in nhân viên thành công hoặc đã check-in rồi", async () => {
      const res = await agent.post(`/api/hr/employees/${employeeId}/checkin`);
      expect([200, 400]).toContain(res.status);
    });
  });

  describe("GET /api/hr/employees/basic", () => {
    it("trả về danh sách nhân viên basic (id + name)", async () => {
      const res = await agent.get("/api/hr/employees/basic");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
