import { GoogleGenerativeAI, SchemaType, type Tool, type Part } from "@google/generative-ai";
import { prisma } from "../../lib/prisma.js";
import { REQUIRED_DOCS } from "./ruleBasedAI.service.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `Bạn là trợ lý AI nội bộ của công ty tư vấn visa "Fly Visa" tại TP.HCM.
Nhiệm vụ: hỗ trợ nhân viên tra cứu dữ liệu, phân tích kinh doanh và giải đáp thắc mắc nghiệp vụ visa Úc.
Quy tắc:
- Trả lời tiếng Việt, tự nhiên như người thật đang nhắn tin, ngắn gọn, đi thẳng vào trọng tâm.
- Dùng công cụ để lấy dữ liệu thực tế. KHÔNG bịa số liệu.
- CHỈ được dùng văn bản thuần (plain text). KHÔNG tô đậm, KHÔNG in nghiêng, KHÔNG tiêu đề. Nghiêm cấm mọi ký tự markdown: **, __, *, #, backtick. Muốn nhấn mạnh thì diễn đạt bằng lời, không dùng ký hiệu. Liệt kê thì dùng dấu gạch đầu dòng (-) ở đầu dòng, không dùng dấu *.
- Không mở đầu dài dòng, không liệt kê thông tin thừa nếu người dùng không hỏi.
- Nếu không có đủ dữ liệu, nói ngắn gọn một câu.`;

// ── Tool implementations ───────────────────────────────────────────────────────

async function getPipeline() {
  const now = new Date();
  const [columns, taskCount, empCount] = await Promise.all([
    prisma.column.findMany({
      include: { tasks: { select: { price: true, assignedTo: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.task.count(),
    prisma.employee.count(),
  ]);
  const pipeline = columns.map((c) => {
    const rev = c.tasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
    return { stage: c.title, count: c.tasks.length, revenue_million: parseFloat((rev / 1e6).toFixed(1)) };
  });
  return { total_tasks: taskCount, total_employees: empCount, pipeline, as_of: now.toLocaleDateString("vi-VN") };
}

async function getVisaTypes() {
  const rows = await prisma.task.groupBy({
    by: ["checklistType"],
    _count: { checklistType: true },
    orderBy: { _count: { checklistType: "desc" } },
  });
  const LABELS: Record<string, string> = {
    tourism: "Du lịch (Tourism)",
    labor: "Lao động (Labor)",
    study: "Du học (Study)",
  };
  return rows.map((r) => ({
    type: LABELS[r.checklistType ?? ""] ?? r.checklistType ?? "Chưa phân loại",
    count: r._count.checklistType,
  }));
}

async function getRevenue(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  const sales = await prisma.salesRecord.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { employee: { select: { name: true } } },
  });
  const total = sales.reduce((s, r) => s + r.profit, 0);
  const byEmp: Record<string, number> = {};
  sales.forEach((s) => { byEmp[s.employee.name] = (byEmp[s.employee.name] || 0) + s.profit; });
  return {
    month: `${m}/${y}`,
    total_million: parseFloat((total / 1e6).toFixed(1)),
    transaction_count: sales.length,
    by_employee: Object.entries(byEmp)
      .sort((a, b) => b[1] - a[1])
      .map(([name, profit]) => ({ name, profit_million: parseFloat((profit / 1e6).toFixed(1)) })),
  };
}

async function getEmployees() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const employees = await prisma.employee.findMany({
    select: {
      name: true,
      role: true,
      department: { select: { name: true } },
      salesRecords: { select: { profit: true }, where: { createdAt: { gte: startOfMonth } } },
    },
    orderBy: { name: "asc" },
  });
  return employees.map((e) => ({
    name: e.name,
    role: e.role,
    department: e.department?.name ?? "Chưa phân bổ",
    monthly_revenue_million: parseFloat((e.salesRecords.reduce((s, r) => s + r.profit, 0) / 1e6).toFixed(1)),
  }));
}

async function getAttendance(date?: string) {
  const now = new Date();
  const todayStr = date ?? now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, name: true } }),
    prisma.attendanceRecord.findMany({
      where: { date: todayStr },
      select: { employeeId: true, status: true, inTime: true },
    }),
  ]);
  const checkedIds = new Set(records.map((r) => r.employeeId));
  return {
    date: todayStr,
    checked: records.map((r) => ({
      name: employees.find((e) => e.id === r.employeeId)?.name ?? "?",
      status: r.status,
      time: r.inTime,
    })),
    not_checked: employees.filter((e) => !checkedIds.has(e.id)).map((e) => e.name),
  };
}

async function searchCustomer(keyword: string) {
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { content: { contains: keyword, mode: "insensitive" } },
        { phone: { contains: keyword } },
      ],
    },
    include: { column: { select: { title: true } }, activities: { select: { completed: true } } },
    take: 8,
  });
  return tasks.map((t) => ({
    name: t.content,
    phone: t.phone,
    stage: t.column?.title ?? "?",
    assigned_to: t.assignedTo,
    price: t.price,
    visa_type: t.checklistType,
    activities_done: t.activities.filter((a) => a.completed).length,
    activities_total: t.activities.length,
  }));
}

async function getMissingDocuments(keyword: string) {
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { content: { contains: keyword, mode: "insensitive" } },
        { phone: { contains: keyword } },
      ],
    },
    select: { id: true, content: true, checklistType: true, documents: true, visaType: true, assignedTo: true },
    take: 3,
  });

  if (!tasks.length) return { found: false, message: `Không tìm thấy khách hàng "${keyword}" trong hệ thống.` };

  const task = tasks[0];
  const checklistType = task.checklistType ?? "tourism";
  const requiredDocs = REQUIRED_DOCS[checklistType] ?? REQUIRED_DOCS["tourism"];

  const uploadedIds = new Set<string>();
  const docs = task.documents as Record<string, unknown[]> | null;
  if (docs && typeof docs === "object") {
    Object.entries(docs).forEach(([key, val]) => {
      if (Array.isArray(val) && val.length > 0) uploadedIds.add(key);
    });
  }

  const missing = requiredDocs.filter((d) => !uploadedIds.has(d.id)).map((d) => d.name);
  const uploaded = requiredDocs.filter((d) => uploadedIds.has(d.id)).map((d) => d.name);

  return {
    found: true,
    customer_name: task.content,
    visa_type: task.visaType ?? checklistType,
    assigned_to: task.assignedTo,
    required_total: requiredDocs.length,
    uploaded_count: uploaded.length,
    uploaded_documents: uploaded,
    missing_count: missing.length,
    missing_documents: missing,
  };
}

// ── Tool definitions for Gemini ────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_pipeline",
        description: "Lấy tổng quan pipeline CRM: số hồ sơ và doanh thu theo từng giai đoạn xử lý, tổng nhân viên",
      },
      {
        name: "get_visa_types",
        description: "Lấy phân loại và số lượng hồ sơ theo từng loại visa: du lịch, lao động, du học",
      },
      {
        name: "get_revenue",
        description: "Lấy doanh thu theo tháng: tổng và chi tiết theo từng nhân viên",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            month: { type: SchemaType.NUMBER, description: "Tháng (1-12), mặc định tháng hiện tại" },
            year: { type: SchemaType.NUMBER, description: "Năm 4 chữ số, mặc định năm hiện tại" },
          },
        },
      },
      {
        name: "get_employees",
        description: "Lấy danh sách nhân viên kèm chức vụ, phòng ban và doanh thu tháng hiện tại",
      },
      {
        name: "get_attendance",
        description: "Lấy tình trạng chấm công theo ngày: ai đã check-in, ai chưa",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            date: { type: SchemaType.STRING, description: "Ngày theo định dạng dd/mm/yyyy, mặc định hôm nay" },
          },
        },
      },
      {
        name: "search_customer",
        description: "Tìm kiếm hồ sơ khách hàng theo tên hoặc số điện thoại",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            keyword: { type: SchemaType.STRING, description: "Từ khóa tìm kiếm: tên hoặc số điện thoại" },
          },
          required: ["keyword"],
        },
      },
      {
        name: "get_missing_documents",
        description: "Kiểm tra danh sách tài liệu còn thiếu và đã nộp của một khách hàng theo loại visa, dùng khi được hỏi khách hàng còn thiếu hồ sơ gì",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            keyword: { type: SchemaType.STRING, description: "Tên hoặc số điện thoại khách hàng cần kiểm tra" },
          },
          required: ["keyword"],
        },
      },
    ],
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_pipeline":          return getPipeline();
    case "get_visa_types":        return getVisaTypes();
    case "get_revenue":           return getRevenue(args.month as number | undefined, args.year as number | undefined);
    case "get_employees":         return getEmployees();
    case "get_attendance":        return getAttendance(args.date as string | undefined);
    case "search_customer":       return searchCustomer(args.keyword as string);
    case "get_missing_documents": return getMissingDocuments(args.keyword as string);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── Markdown sanitizer ──────────────────────────────────────────────────────────
// Gemini đôi khi phớt lờ chỉ dẫn "không markdown" trong SYSTEM_PROMPT, nên lọc lại
// ở đây để đảm bảo chatbox không bao giờ hiện ký hiệu ** * # thô ra cho người dùng.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1")     // __bold__
    .replace(/(?<!\*)\*([^\n*]+?)\*(?!\*)/g, "$1") // *italic*
    .replace(/^#{1,6}\s+/gm, "")     // # heading
    .replace(/`([^`]+)`/g, "$1")     // `code`
    .replace(/\*/g, "");             // ký hiệu * còn sót lại
}

// ── Main streaming function ────────────────────────────────────────────────────

export async function* streamGeminiResponse(question: string): AsyncGenerator<string> {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: TOOLS,
  });

  const chat = model.startChat();
  let response = await chat.sendMessage(question);

  // Agentic loop: execute tool calls until Gemini is ready to answer
  for (let round = 0; round < 5; round++) {
    const calls = response.response.functionCalls();
    if (!calls?.length) break;

    const results: Part[] = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: { result: await executeTool(call.name, (call.args ?? {}) as Record<string, unknown>) },
        },
      }))
    );

    response = await chat.sendMessage(results);
  }

  const text = stripMarkdown(response.response.text());
  if (!text) { yield "Xin lỗi, không thể tạo câu trả lời lúc này."; return; }

  // Yield in chunks to keep SSE streaming feel
  const CHUNK = 40;
  for (let i = 0; i < text.length; i += CHUNK) {
    yield text.slice(i, i + CHUNK);
  }
}
