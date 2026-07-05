import "../__tests__/setup.js";
import request from "supertest";
import app from "../app.js";

async function getAuthCookie() {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@flyvisa.com", password: "admin123" });
  return res.headers["set-cookie"]?.[0] ?? "";
}

describe("Stats API", () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await getAuthCookie();
  });

  describe("GET /api/stats/pipeline-funnel", () => {
    it("trả về dữ liệu funnel theo cột", async () => {
      const res = await request(app)
        .get("/api/stats/pipeline-funnel")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("stage");
        expect(res.body[0]).toHaveProperty("count");
      }
    });
  });

  describe("GET /api/stats/employee-performance", () => {
    it("trả về hiệu suất nhân viên", async () => {
      const res = await request(app)
        .get("/api/stats/employee-performance")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/stats/conversion-trend", () => {
    it("trả về xu hướng chuyển đổi", async () => {
      const res = await request(app)
        .get("/api/stats/conversion-trend")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/stats/forecast", () => {
    it("trả về dự báo doanh thu", async () => {
      const res = await request(app)
        .get("/api/stats/forecast")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("historical");
    });
  });

  describe("GET /api/stats/source-trend", () => {
    it("trả về xu hướng nguồn khách", async () => {
      const res = await request(app)
        .get("/api/stats/source-trend")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
    });
  });
});
