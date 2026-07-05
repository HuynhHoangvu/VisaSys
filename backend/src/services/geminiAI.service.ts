import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../../lib/prisma.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `Bạn là trợ lý AI nội bộ của công ty tư vấn visa "Fly Visa" tại TP.HCM.
Nhiệm vụ: hỗ trợ nhân viên tra cứu dữ liệu, phân tích kinh doanh và giải đáp thắc mắc nghiệp vụ visa Úc.
Quy tắc:
- Luôn trả lời tiếng Việt, ngắn gọn và chuyên nghiệp.
- Dùng dữ liệu thực tế từ hệ thống được cung cấp bên dưới. KHÔNG bịa số liệu.
- KHÔNG dùng markdown: không dùng **, không dùng *, không dùng #. Chỉ viết văn xuôi hoặc danh sách với dấu gạch đầu dòng thường.
- Trả lời thẳng vào câu hỏi, không giải thích dài dòng về giới hạn dữ liệu trừ khi thực sự không có data.
- Nếu không có đủ dữ liệu, nói ngắn gọn một câu.`;

async function buildContext(question: string): Promise<string> {
  const q = question.toLowerCase();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const parts: string[] = [];

  // ── Luôn lấy: pipeline tổng quan ──────────────────────────────────────────
  const [columns, taskCount, empCount] = await Promise.all([
    prisma.column.findMany({
      include: { tasks: { select: { price: true, assignedTo: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.task.count(),
    prisma.employee.count(),
  ]);

  parts.push(
    `## Tổng quan hệ thống\n- Tổng hồ sơ: ${taskCount} | Tổng nhân viên: ${empCount}`
  );

  const pipelineLines = columns.map((c) => {
    const rev = c.tasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
    return `- **${c.title}**: ${c.tasks.length} hồ sơ (${(rev / 1_000_000).toFixed(0)}tr VND)`;
  });
  parts.push(`## Pipeline CRM\n${pipelineLines.join("\n")}`);

  // ── Doanh thu / kinh doanh ─────────────────────────────────────────────────
  if (/doanh thu|doanh số|bán|sale|profit|lợi nhuận|thu nhập|kinh doanh|tháng/.test(q)) {
    const sales = await prisma.salesRecord.findMany({
      where: { createdAt: { gte: startOfMonth } },
      include: { employee: { select: { name: true } } },
      orderBy: { profit: "desc" },
    });
    const total = sales.reduce((s, r) => s + r.profit, 0);
    const byEmp: Record<string, number> = {};
    sales.forEach((s) => { byEmp[s.employee.name] = (byEmp[s.employee.name] || 0) + s.profit; });
    const empLines = Object.entries(byEmp)
      .sort((a, b) => b[1] - a[1])
      .map(([n, p]) => `- ${n}: ${(p / 1e6).toFixed(1)}tr VND`)
      .join("\n");
    parts.push(
      `## Doanh thu tháng ${now.getMonth() + 1}/${now.getFullYear()}\n- **Tổng: ${(total / 1e6).toFixed(1)} triệu VND** (${sales.length} giao dịch)\n${empLines || "- Chưa có giao dịch"}`
    );
  }

  // ── Nhân viên ─────────────────────────────────────────────────────────────
  if (/nhân viên|nhân sự|staff|employee|phụ trách|ai bán|hiệu suất|top/.test(q)) {
    const employees = await prisma.employee.findMany({
      select: {
        name: true,
        role: true,
        department: { select: { name: true } },
        salesRecords: { select: { profit: true }, where: { createdAt: { gte: startOfMonth } } },
      },
      orderBy: { name: "asc" },
    });
    const lines = employees
      .map((e) => {
        const rev = e.salesRecords.reduce((s, r) => s + r.profit, 0);
        return `- **${e.name}** (${e.role}${e.department ? " – " + e.department.name : ""}): doanh thu tháng ${(rev / 1e6).toFixed(1)}tr`;
      })
      .join("\n");
    parts.push(`## Danh sách nhân viên\n${lines}`);
  }

  // ── Điểm danh ─────────────────────────────────────────────────────────────
  if (/điểm danh|chấm công|vắng|muộn|absent|attendance/.test(q)) {
    const todayStr = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const [employees, todayRecords] = await Promise.all([
      prisma.employee.findMany({ select: { id: true, name: true, role: true } }),
      prisma.attendanceRecord.findMany({
        where: { date: todayStr },
        select: { employeeId: true, status: true, inTime: true },
      }),
    ]);
    const checkedIds = new Set(todayRecords.map((r) => r.employeeId));
    const notChecked = employees.filter((e) => !checkedIds.has(e.id));
    const checkedLines = todayRecords
      .map((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return `- ${emp?.name}: ${r.status}${r.inTime ? ` (${r.inTime})` : ""}`;
      })
      .join("\n");
    parts.push(
      `## Điểm danh hôm nay (${todayStr})\n- **Đã điểm danh:** ${todayRecords.length}/${employees.length} người\n${checkedLines}\n- **Chưa điểm danh (${notChecked.length}):** ${notChecked.map((e) => e.name).join(", ") || "Tất cả đã điểm danh"}`
    );
  }

  // ── Tìm khách hàng ────────────────────────────────────────────────────────
  const searchTerms = question.match(/(?:tìm|khách|hồ sơ|customer|search)\s+([^\s?!,]+(?:\s+[^\s?!,]+)?)/i);
  if (searchTerms) {
    const keyword = searchTerms[1].trim();
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
    if (tasks.length > 0) {
      const lines = tasks
        .map((t) => {
          const done = t.activities.filter((a) => a.completed).length;
          return `- **${t.content}** | SĐT: ${t.phone} | Giai đoạn: ${t.column?.title || "?"} | Phụ trách: ${t.assignedTo} | Phí: ${t.price} | Hoạt động: ${done}/${t.activities.length}`;
        })
        .join("\n");
      parts.push(`## Kết quả tìm "${keyword}" (${tasks.length} hồ sơ)\n${lines}`);
    } else {
      parts.push(`## Tìm "${keyword}"\nKhông tìm thấy hồ sơ nào khớp.`);
    }
  }

  // ── Loại visa ─────────────────────────────────────────────────────────────
  if (/loại visa|visa|checklist|tourism|labor|study|du lịch|du học|lao động/.test(q)) {
    const visaTasks = await prisma.task.groupBy({
      by: ["checklistType"],
      _count: { checklistType: true },
      orderBy: { _count: { checklistType: "desc" } },
    });
    const VISA_LABELS: Record<string, string> = {
      tourism: "Du lịch (Tourism)",
      labor: "Lao động (Labor)",
      study: "Du học (Study)",
    };
    const lines = visaTasks
      .map((v) => `- ${VISA_LABELS[v.checklistType ?? ""] ?? v.checklistType}: ${v._count.checklistType} hồ sơ`)
      .join("\n");
    parts.push(`## Phân loại visa\n${lines || "Chưa có dữ liệu loại visa"}`);
  }

  // ── Khách tiềm năng / hot leads ───────────────────────────────────────────
  if (/tiềm năng|nóng|hot|lead|triển vọng/.test(q)) {
    const tasks = await prisma.task.findMany({
      where: { source: { in: ["Giới thiệu", "Website"] } },
      include: {
        column: { select: { title: true } },
        activities: { select: { completed: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const lines = tasks
      .map((t) => {
        const done = t.activities.filter((a) => a.completed).length;
        return `- **${t.content}** | ${t.column?.title || "?"} | Nguồn: ${t.source} | ${done}/${t.activities.length} hoạt động | ${t.price}`;
      })
      .join("\n");
    parts.push(`## Khách hàng tiềm năng\n${lines || "Chưa có dữ liệu"}`);
  }

  // ── Hồ sơ còn thiếu giấy tờ ──────────────────────────────────────────────
  if (/thiếu|hồ sơ|giấy tờ|checklist|tài liệu|document/.test(q)) {
    const nameHint = question.match(/khách\s+(.+?)(?:\s+còn|\s+thiếu|$)/i)?.[1]?.trim();
    const tasks = await prisma.task.findMany({
      where: nameHint ? { content: { contains: nameHint, mode: "insensitive" } } : {},
      select: { content: true, checklistType: true, documents: true },
      take: nameHint ? 3 : 5,
    });

    const REQUIRED: Record<string, string[]> = {
      tourism: ["passport", "photo", "bank_statement", "itinerary", "hotel_booking", "invitation"],
      labor: ["passport", "photo", "contract", "skill_assessment", "english_cert", "police_check"],
      study: ["passport", "photo", "coe", "english_cert", "financial_capacity", "health_insurance"],
    };

    const lines = tasks
      .map((t) => {
        const required = REQUIRED[t.checklistType ?? "tourism"] ?? [];
        const uploaded = Object.keys((t.documents as Record<string, unknown>) ?? {});
        const missing = required.filter((r) => !uploaded.includes(r));
        return `- **${t.content}** (${t.checklistType ?? "tourism"}): còn thiếu ${missing.length} giấy tờ – ${missing.join(", ") || "đủ hết"}`;
      })
      .join("\n");
    parts.push(`## Tình trạng hồ sơ\n${lines || "Không có hồ sơ"}`);
  }

  return parts.join("\n\n");
}

export async function* streamGeminiResponse(question: string): AsyncGenerator<string> {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const context = await buildContext(question);
  const prompt = `Dữ liệu thực tế từ hệ thống Fly Visa:\n\n${context}\n\n---\nCâu hỏi: ${question}`;

  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
