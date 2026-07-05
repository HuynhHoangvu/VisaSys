import "./setup.js";
import request from "supertest";
import app from "../app.js";

describe("Auth API", () => {
  describe("POST /api/auth/login", () => {
    it("đăng nhập thành công với đúng credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@flyvisa.com", password: "admin123" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("role");
      expect(res.body).toHaveProperty("permissions");
      expect(Array.isArray(res.body.permissions)).toBe(true);
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("trả về lỗi khi sai mật khẩu", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@flyvisa.com", password: "saimatkhau" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty("error");
    });

    it("trả về 400 khi thiếu email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "admin123" });

      expect(res.status).toBe(400);
    });

    it("trả về lỗi khi email không tồn tại", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "khongtontai@flyvisa.com", password: "admin123" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/me", () => {
    it("trả về 401 khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("trả về thông tin user khi đã đăng nhập (dùng agent giữ cookie)", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/auth/login")
        .send({ email: "admin@flyvisa.com", password: "admin123" });

      const res = await agent.get("/api/auth/me");

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("admin@flyvisa.com");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("đăng xuất thành công", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/auth/login")
        .send({ email: "admin@flyvisa.com", password: "admin123" });

      const res = await agent.post("/api/auth/logout");
      expect(res.status).toBe(200);
    });
  });
});
