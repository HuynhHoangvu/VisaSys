import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fly Visa System API",
      version: "1.0.0",
      description: "API quản lý nghiệp vụ doanh nghiệp dịch vụ visa tích hợp AI",
      contact: { name: "Huỳnh Hoàng Vũ", email: "admin@flyvisa.com" },
    },
    servers: [
      { url: "http://localhost:3001", description: "Local" },
      { url: "https://fly-visa-system-backend-fly.up.railway.app", description: "Production (Railway)" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "connect.sid" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        Employee: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
            employeeCode: { type: "string" },
            department: { type: "string", nullable: true },
          },
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string" },
            content: { type: "string", description: "Tên khách hàng" },
            phone: { type: "string" },
            email: { type: "string", nullable: true },
            price: { type: "string" },
            source: { type: "string", nullable: true },
            assignedTo: { type: "string" },
            columnId: { type: "string", nullable: true },
            visaType: { type: "string", nullable: true },
            checklistType: { type: "string", enum: ["tourism", "labor", "study"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        LeadScore: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 1, maximum: 10 },
            label: { type: "string", enum: ["Nóng", "Ấm", "Lạnh"] },
            reason: { type: "string" },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
    tags: [
      { name: "Auth", description: "Xác thực người dùng" },
      { name: "Board", description: "Kanban board CRM" },
      { name: "Tasks", description: "Quản lý hồ sơ khách hàng" },
      { name: "AI", description: "Trợ lý AI & Lead Scoring" },
      { name: "HR", description: "Quản lý nhân sự" },
      { name: "Stats", description: "Thống kê & báo cáo" },
      { name: "Chat", description: "Chat nội bộ" },
      { name: "Docs", description: "Quản lý tài liệu" },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
