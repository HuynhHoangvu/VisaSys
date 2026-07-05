import { prisma } from "../../lib/prisma.js";

// ─── Text normalization ───────────────────────────────────────────────────────
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

// ─── Visa knowledge base ─────────────────────────────────────────────────────
const VISA_KB: Record<string, { name: string; desc: string; req: string[]; time: string; fee: string }> = {
  "407": {
    name: "Visa 407 — Training Visa",
    desc: "Visa đào tạo nghề tại Úc, dành cho người muốn nâng cao kỹ năng hoặc tham gia chương trình đào tạo nghề có tổ chức.",
    req: ["Hộ chiếu còn hạn > 6 tháng", "Thư mời từ tổ chức đào tạo Úc (nomination)", "Chứng minh tài chính", "IELTS 4.5+ (một số nhà tuyển dụng yêu cầu)", "Khám sức khỏe & lý lịch tư pháp"],
    time: "3–6 tháng xử lý",
    fee: "Phí nộp: ~AUD 310 (khoảng 5.1tr VNĐ)",
  },
  "482": {
    name: "Visa 482 — Temporary Skill Shortage (TSS)",
    desc: "Visa lao động tay nghề cao tại Úc theo diện được nhà tuyển dụng bảo lãnh, thay thế visa 457 cũ.",
    req: ["Hộ chiếu còn hạn > 6 tháng", "Nhà tuyển dụng Úc được accredited sponsor", "Kỹ năng nghề phù hợp danh sách MLTSSL/STSOL", "IELTS 5.0+ (tùy ngành)", "Tối thiểu 2 năm kinh nghiệm liên quan", "Khám sức khỏe"],
    time: "1–4 tháng xử lý",
    fee: "Phí nộp: AUD 1,455–2,770 tùy thời hạn",
  },
  "500": {
    name: "Visa 500 — Student Visa",
    desc: "Visa du học Úc cho sinh viên được chấp thuận nhập học tại cơ sở giáo dục đăng ký (CRICOS).",
    req: ["COE (Xác nhận đăng ký học) từ trường", "Chứng minh tài chính (ít nhất AUD 21,041/năm)", "IELTS 5.5–6.5 tùy cấp học", "Khám sức khỏe", "Hộ chiếu", "GTE Statement (Genuine Temporary Entrant)"],
    time: "4–6 tuần xử lý (online)",
    fee: "Phí nộp: AUD 710 (khoảng 11.7tr VNĐ)",
  },
  "600": {
    name: "Visa 600 — Tourist / Visitor Visa",
    desc: "Visa du lịch hoặc thăm thân nhân tại Úc, cho phép lưu trú tối đa 3–12 tháng.",
    req: ["Hộ chiếu còn hạn > 6 tháng", "CCCD", "Ảnh thẻ 4x6", "Chứng minh tài chính (sao kê 3–6 tháng)", "Lịch trình chuyến đi", "Thư mời (nếu thăm thân)"],
    time: "15–25 ngày làm việc",
    fee: "Phí nộp: AUD 190 (khoảng 3.1tr VNĐ)",
  },
  "186": {
    name: "Visa 186 — Employer Nomination Scheme (ENS)",
    desc: "Visa định cư theo diện nhà tuyển dụng Úc bảo lãnh, cho phép sinh sống và làm việc vĩnh viễn tại Úc.",
    req: ["Được nhà tuyển dụng bảo lãnh (approved sponsor)", "Kỹ năng phù hợp danh sách nghề", "Tối thiểu 3 năm kinh nghiệm liên quan", "Tuổi dưới 45", "IELTS 6.0+", "Khám sức khỏe & lý lịch tư pháp"],
    time: "12–36 tháng xử lý",
    fee: "Phí nộp: AUD 4,640 (khoảng 76tr VNĐ)",
  },
  "189": {
    name: "Visa 189 — Skilled Independent",
    desc: "Visa định cư diện tay nghề độc lập, không cần bảo lãnh từ nhà tuyển dụng hay tiểu bang, xét theo điểm SkillSelect.",
    req: ["Kỹ năng trong danh sách MLTSSL", "Điểm EOI tối thiểu 65+", "Dưới 45 tuổi", "IELTS 6.0+", "Đánh giá kỹ năng (skill assessment) bởi tổ chức chuyên ngành"],
    time: "6–18 tháng",
    fee: "Phí nộp: AUD 4,640",
  },
  "190": {
    name: "Visa 190 — Skilled Nominated",
    desc: "Visa định cư diện tay nghề được tiểu bang/vùng lãnh thổ bảo lãnh (State nomination).",
    req: ["Được một tiểu bang nomination (+5 điểm)", "Kỹ năng trong danh sách tiểu bang", "Điểm EOI tổng 65+ (60 + 5 tiểu bang)", "Dưới 45 tuổi", "IELTS 6.0+", "Skill assessment"],
    time: "6–18 tháng",
    fee: "Phí nộp: AUD 4,640",
  },
  "491": {
    name: "Visa 491 — Skilled Work Regional",
    desc: "Visa lao động tay nghề tạm thời tại vùng nông thôn Úc (5 năm), bước đệm để chuyển sang visa định cư 191.",
    req: ["Được tiểu bang/vùng hoặc người thân bảo lãnh", "Kỹ năng trong danh sách", "Điểm EOI 65+", "Dưới 45 tuổi", "IELTS 6.0+", "Cam kết sinh sống tại vùng regional"],
    time: "6–18 tháng",
    fee: "Phí nộp: AUD 4,640",
  },
  "820": {
    name: "Visa 820/801 — Partner Visa (onshore)",
    desc: "Visa bảo lãnh vợ/chồng hoặc người yêu đang ở Úc sang định cư cùng công dân/thường trú nhân Úc.",
    req: ["Người bảo lãnh là PR/công dân Úc", "Chứng minh quan hệ hôn nhân/tình cảm thực sự", "Hộ chiếu", "Ảnh chứng minh mối quan hệ", "Khám sức khỏe & lý lịch tư pháp"],
    time: "12–36 tháng",
    fee: "Phí nộp: AUD 8,850 (bao gồm cả 801)",
  },
  "309": {
    name: "Visa 309/100 — Partner Visa (offshore)",
    desc: "Visa bảo lãnh vợ/chồng từ Việt Nam (nộp hồ sơ từ ngoài Úc), tương tự 820/801 nhưng dành cho offshore.",
    req: ["Người bảo lãnh là PR/công dân Úc", "Chứng minh quan hệ", "Hộ chiếu", "Khám sức khỏe", "Lý lịch tư pháp"],
    time: "12–36 tháng",
    fee: "Phí nộp: AUD 8,850",
  },
};

// ─── Required documents per checklist type ───────────────────────────────────
const REQUIRED_DOCS: Record<string, { id: string; name: string }[]> = {
  tourism: [
    { id: "p1", name: "Hộ chiếu" },
    { id: "p2", name: "CCCD / CMND" },
    { id: "p3", name: "Ảnh thẻ 4x6" },
    { id: "p4", name: "Tờ khai visa online" },
    { id: "p15", name: "Giấy khai sinh đương đơn" },
    { id: "p17", name: "Giấy xác nhận cư trú" },
    { id: "t5", name: "Lịch trình du lịch" },
    { id: "f8", name: "Sao kê tài khoản" },
  ],
  labor: [
    { id: "lb1", name: "Hộ chiếu" },
    { id: "lb2", name: "CCCD / CMND" },
    { id: "lb3", name: "Giấy khai sinh" },
    { id: "lb4", name: "Sổ hộ khẩu / Xác nhận cư trú" },
    { id: "lb7", name: "Ảnh thẻ nền trắng" },
    { id: "lb8", name: "Bằng tốt nghiệp THPT" },
    { id: "lb12", name: "CV chi tiết" },
    { id: "lb27", name: "Lý lịch tư pháp" },
    { id: "lb28", name: "Giấy khám sức khỏe" },
    { id: "lb31", name: "Tờ khai nhân thân" },
  ],
  study: [
    { id: "sa1", name: "Hộ chiếu" },
    { id: "sa2", name: "CCCD / CMND" },
    { id: "sa3", name: "Giấy khai sinh" },
    { id: "sa4", name: "Sổ hộ khẩu / Xác nhận cư trú" },
    { id: "sa5", name: "Ảnh thẻ nền trắng" },
    { id: "sa8", name: "Bảng điểm học tập" },
    { id: "sa9", name: "Bằng tốt nghiệp THPT" },
    { id: "sa12", name: "Chứng chỉ tiếng Anh" },
    { id: "sa13", name: "Sổ tiết kiệm" },
    { id: "sa27", name: "Thư mời nhập học" },
    { id: "sa28", name: "COE (Xác nhận đăng ký học)" },
    { id: "sa29", name: "Đơn xin visa du học" },
    { id: "sa30", name: "Giấy khám sức khỏe" },
  ],
};

// ─── Intent detection ─────────────────────────────────────────────────────────
type Intent =
  | "SEARCH_CUSTOMER"
  | "PIPELINE_OVERVIEW"
  | "REVENUE_QUERY"
  | "EMPLOYEE_STATS"
  | "HOT_LEADS"
  | "CUSTOMER_STAGE"
  | "ATTENDANCE_CHECK"
  | "VISA_KNOWLEDGE"
  | "MISSING_DOCS"
  | "HELP";

function detectIntent(q: string): Intent {
  if (hasAny(q, ["diem danh", "chua diem", "vang mat", "ai chua diem", "chua check in", "nghi phep", "ai nghi", "chua vao"]))
    return "ATTENDANCE_CHECK";
  if (hasAny(q, ["visa 4", "visa 1", "visa 8", "visa 3", "visa 5", "visa 6", "visa 9", "visa 2", "la gi", "visa gi", "loai visa", "thong tin visa", "quy trinh visa", "visa uc"]))
    return "VISA_KNOWLEDGE";
  if (hasAny(q, ["thieu ho so", "con thieu", "thieu gi", "chua nop", "ho so con thieu", "thieu giay to", "con giay to", "chua du ho so"]))
    return "MISSING_DOCS";
  if (hasAny(q, ["tim khach", "khach ten", "thong tin khach", "tra cuu", "so dien thoai", "ho so cua", "khach hang nao"]))
    return "SEARCH_CUSTOMER";
  if (hasAny(q, ["tong quan", "pipeline", "bao nhieu khach", "cac giai doan", "tong so khach", "hien tai co"]))
    return "PIPELINE_OVERVIEW";
  if (hasAny(q, ["doanh thu", "doanh so", "thang nay", "thang truoc", "thu nhap", "bao nhieu tien", "oanh so"]))
    return "REVENUE_QUERY";
  if (hasAny(q, ["nhan vien", "sale nao", "ai ban", "hieu suat", "ban tot nhat", "top sale", "ket qua nhan vien"]))
    return "EMPLOYEE_STATS";
  if (hasAny(q, ["khach nong", "tiem nang", "hot lead", "uu tien", "can chu y", "can lien he", "chua chot"]))
    return "HOT_LEADS";
  if (hasAny(q, ["dang o buoc", "tien do", "buoc nao", "dang xu ly", "trang thai", "dang o dau", "stage"]))
    return "CUSTOMER_STAGE";
  return "HELP";
}

// ─── Entity extraction ────────────────────────────────────────────────────────
function extractName(text: string): string | null {
  // Match 2-4 consecutive capitalized Vietnamese words (typical Vietnamese name pattern)
  const match = text.match(
    /[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂẮẶẲẴẮ][a-zđàáâãèéêìíòóôõùúýăắặẳẵắ]+(?:\s+[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂẮẶẲẴẮ][a-zđàáâãèéêìíòóôõùúýăắặẳẵắ]+){1,3}/u
  );
  return match ? match[0].trim() : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/0\d{9}/);
  return match ? match[0] : null;
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

async function handleSearchCustomer(text: string): Promise<string> {
  const name = extractName(text);
  const phone = extractPhone(text);

  if (!name && !phone)
    return "❓ Bạn muốn tìm khách hàng nào? Hãy cung cấp **tên** hoặc **số điện thoại**.";

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        ...(name ? [{ content: { contains: name, mode: "insensitive" as const } }] : []),
        ...(phone ? [{ phone: { contains: phone } }] : []),
      ],
    },
    include: { column: { select: { title: true } } },
    take: 5,
  });

  if (!tasks.length)
    return `❌ Không tìm thấy khách hàng${name ? ` **"${name}"**` : ""} trong hệ thống.`;

  if (tasks.length === 1) {
    const t = tasks[0];
    return [
      `👤 **${t.content}**`,
      `📞 ${t.phone ?? "Chưa có SĐT"}`,
      `🗂 Giai đoạn: **${t.column?.title ?? "Chưa xác định"}**`,
      `💼 Loại visa: ${t.visaType ?? "Chưa rõ"}`,
      `💰 Phí dịch vụ: **${t.price}**`,
      `👨‍💼 Sale phụ trách: ${t.assignedTo ?? "Chưa giao"}`,
      `📌 Nguồn khách: ${t.source ?? "Không rõ"}`,
    ].join("\n");
  }

  const list = tasks
    .map((t, i) => `${i + 1}. **${t.content}** — ${t.column?.title ?? "?"} — ${t.phone ?? "?"}`)
    .join("\n");
  return `🔍 Tìm thấy **${tasks.length} khách hàng**:\n\n${list}`;
}

async function handlePipelineOverview(): Promise<string> {
  const columns = await prisma.column.findMany({
    include: { tasks: { select: { price: true } } },
    orderBy: { order: "asc" },
  });

  const total = columns.reduce((s, c) => s + c.tasks.length, 0);
  const totalRev = columns.reduce(
    (s, c) => s + c.tasks.reduce((ss, t) => ss + (parseInt(t.price.replace(/\D/g, "")) || 0), 0),
    0
  );

  const lines = columns.map((col) => {
    const rev = col.tasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
    const filled = Math.min(col.tasks.length, 8);
    const bar = "█".repeat(filled) + "░".repeat(8 - filled);
    return `**${col.title}** \`${bar}\` ${col.tasks.length} khách · ${Math.round(rev / 1_000_000)}tr đ`;
  });

  return [
    `📊 **Tổng quan Pipeline**`,
    `👥 Tổng: **${total} khách hàng** · 💰 Giá trị: **${Math.round(totalRev / 1_000_000)}tr đ**`,
    ``,
    ...lines,
  ].join("\n");
}

async function handleRevenueQuery(text: string): Promise<string> {
  const now = new Date();
  const isLastMonth = norm(text).includes("thang truoc");
  const target = isLastMonth
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const targetEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
  const label = `T${target.getMonth() + 1}/${target.getFullYear()}`;

  // So sánh với tháng trước đó
  const prevStart = new Date(target.getFullYear(), target.getMonth() - 1, 1);
  const prevEnd = new Date(target.getFullYear(), target.getMonth(), 0, 23, 59, 59);

  const [tasks, prevTasks] = await Promise.all([
    prisma.task.findMany({ where: { createdAt: { gte: target, lte: targetEnd } }, select: { price: true, source: true, visaType: true } }),
    prisma.task.findMany({ where: { createdAt: { gte: prevStart, lte: prevEnd } }, select: { price: true } }),
  ]);

  const rev = tasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
  const prevRev = prevTasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
  const growth = prevRev > 0 ? Math.round(((rev - prevRev) / prevRev) * 100) : 0;
  const growthIcon = growth > 0 ? "📈" : growth < 0 ? "📉" : "➡️";

  const sourceMap: Record<string, number> = {};
  tasks.forEach((t) => { sourceMap[t.source ?? "Khác"] = (sourceMap[t.source ?? "Khác"] || 0) + 1; });
  const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];

  const visaMap: Record<string, number> = {};
  tasks.forEach((t) => { visaMap[t.visaType ?? "Khác"] = (visaMap[t.visaType ?? "Khác"] || 0) + 1; });
  const topVisa = Object.entries(visaMap).sort((a, b) => b[1] - a[1])[0];

  return [
    `💰 **Doanh thu ${label}**`,
    ``,
    `📊 Tổng giá trị hợp đồng: **${(rev / 1_000_000).toFixed(1)}tr đ**`,
    `👥 Số khách mới: **${tasks.length}**`,
    `${growthIcon} So với tháng trước: **${growth > 0 ? "+" : ""}${growth}%**`,
    `📌 Nguồn chính: **${topSource?.[0] ?? "Chưa rõ"}** (${topSource?.[1] ?? 0} khách)`,
    `🗂 Loại visa phổ biến: **${topVisa?.[0] ?? "Chưa rõ"}** (${topVisa?.[1] ?? 0} hồ sơ)`,
  ].join("\n");
}

async function handleEmployeeStats(): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [employees, allTasks] = await Promise.all([
    prisma.employee.findMany({
      select: {
        name: true,
        role: true,
        salesRecords: { select: { profit: true, createdAt: true } },
      },
    }),
    prisma.task.findMany({ select: { assignedTo: true } }),
  ]);

  const taskCountByName: Record<string, number> = {};
  allTasks.forEach((t) => { if (t.assignedTo) taskCountByName[t.assignedTo] = (taskCountByName[t.assignedTo] || 0) + 1; });

  const ranked = employees
    .map((e) => ({
      name: e.name,
      role: e.role,
      thisMonth: e.salesRecords
        .filter((r) => new Date(r.createdAt) >= monthStart)
        .reduce((s, r) => s + r.profit, 0),
      customers: taskCountByName[e.name] ?? 0,
    }))
    .filter((e) => e.customers > 0 || e.thisMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth)
    .slice(0, 5);

  if (!ranked.length)
    return "📭 Chưa có dữ liệu hiệu suất nhân viên. Hãy ghi nhận doanh số trong hệ thống.";

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const lines = ranked.map(
    (e, i) =>
      `${medals[i]} **${e.name}** (${e.role})\n   💰 ${(e.thisMonth / 1_000_000).toFixed(1)}tr · 👥 ${e.customers} khách`
  );

  return [`👥 **Hiệu suất nhân viên tháng này**`, ``, ...lines].join("\n");
}

async function handleHotLeads(): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { columnId: { in: ["col-1", "col-2"] } },
    include: {
      column: { select: { title: true } },
      activities: { select: { completed: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!tasks.length)
    return "✅ Hiện không có khách hàng đang trong giai đoạn tư vấn.";

  const scored = tasks
    .map((t) => {
      let score = 0;
      if (["Giới thiệu", "Website"].includes(t.source ?? "")) score += 3;
      else if (t.source) score += 1;
      score += Math.min(t.activities.filter((a) => a.completed).length * 2, 4);
      const price = parseInt(t.price.replace(/\D/g, "")) || 0;
      if (price >= 50_000_000) score += 3;
      else if (price >= 20_000_000) score += 2;
      if (t.visaType) score += 1;
      return { ...t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const lines = scored.map(
    (t, i) =>
      `${i + 1}. **${t.content}** — ${t.visaType ?? "?"} — ${t.price}\n   📌 ${t.source ?? "?"} · 👨‍💼 ${t.assignedTo ?? "Chưa giao"} · 🗂 ${t.column?.title}`
  );

  return [`🔥 **Top khách hàng tiềm năng** (đang tư vấn)`, ``, ...lines].join("\n");
}

async function handleCustomerStage(text: string): Promise<string> {
  const name = extractName(text);
  if (!name)
    return "❓ Bạn muốn kiểm tra tiến độ của khách hàng nào? Hãy nêu **tên cụ thể**.";

  const tasks = await prisma.task.findMany({
    where: { content: { contains: name, mode: "insensitive" } },
    include: {
      column: { select: { title: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, summary: true, completed: true },
      },
    },
    take: 3,
  });

  if (!tasks.length)
    return `❌ Không tìm thấy khách hàng tên **"${name}"** trong hệ thống.`;

  const t = tasks[0];
  const actLines = t.activities.length
    ? t.activities.map((a) => `  ${a.completed ? "✅" : "⏳"} ${a.type}${a.summary ? ": " + a.summary : ""}`).join("\n")
    : "  Chưa có hoạt động nào.";

  return [
    `📋 **${t.content}**`,
    `🗂 Đang ở bước: **${t.column?.title ?? "Chưa xác định"}**`,
    `💼 Loại visa: ${t.visaType ?? "Chưa rõ"}`,
    `💰 Phí: ${t.price}`,
    `👨‍💼 Sale: ${t.assignedTo ?? "Chưa giao"}`,
    ``,
    `📌 Hoạt động gần nhất:`,
    actLines,
  ].join("\n");
}

async function handleAttendanceCheck(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, name: true, role: true } }),
    prisma.attendanceRecord.findMany({ where: { date: dateStr }, select: { employeeId: true, status: true, inTime: true } }),
  ]);

  const checkedInIds = new Set(records.map((r) => r.employeeId));
  const absent = employees.filter((e) => !checkedInIds.has(e.id));
  const present = employees.filter((e) => checkedInIds.has(e.id));

  const absentLines = absent.map((e) => `  ❌ **${e.name}** (${e.role})`).join("\n");
  const presentLines = records
    .map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return emp ? `  ✅ **${emp.name}** — vào ${r.inTime} — ${r.status}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return [
    `📋 **Điểm danh hôm nay (${dateStr})**`,
    ``,
    `✅ Đã điểm danh: **${present.length}/${employees.length} người**`,
    presentLines ? `\n${presentLines}` : "",
    absent.length > 0
      ? `\n❌ Chưa điểm danh: **${absent.length} người**\n${absentLines}`
      : `\n🎉 Tất cả nhân viên đã điểm danh hôm nay!`,
  ].filter(Boolean).join("\n");
}

function handleVisaKnowledge(text: string): string {
  const q = norm(text);

  // Tìm số visa trong câu hỏi
  const numMatch = q.match(/\b(407|482|500|600|186|189|190|491|820|309|801|100)\b/);
  if (numMatch) {
    const visaNum = numMatch[1];
    // Map 801→820, 100→309
    const key = visaNum === "801" ? "820" : visaNum === "100" ? "309" : visaNum;
    const visa = VISA_KB[key];
    if (visa) {
      const reqs = visa.req.map((r) => `  * ${r}`).join("\n");
      return [
        `🛂 **${visa.name}**`,
        ``,
        visa.desc,
        ``,
        `📋 **Hồ sơ cần thiết:**`,
        reqs,
        ``,
        `⏱ ${visa.time}`,
        `💵 ${visa.fee}`,
      ].join("\n");
    }
  }

  // Hỏi về quy trình chung
  if (hasAny(q, ["quy trinh", "buoc", "lam the nao", "thu tuc"])) {
    return [
      `📝 **Quy trình nộp hồ sơ visa Úc tại Fly Visa**`,
      ``,
      `* **Bước 1 — Tư vấn:** Xác định loại visa phù hợp với mục đích và hồ sơ khách hàng`,
      `* **Bước 2 — Thu thập hồ sơ:** Khách hàng cung cấp giấy tờ theo checklist`,
      `* **Bước 3 — Hoàn thiện hồ sơ:** Dịch thuật, công chứng, scan tài liệu`,
      `* **Bước 4 — Nộp đơn:** Nộp trực tuyến qua ImmiAccount của Bộ Nội vụ Úc`,
      `* **Bước 5 — Theo dõi:** Cập nhật trạng thái và phản hồi yêu cầu bổ sung`,
      `* **Bước 6 — Nhận kết quả:** Thông báo kết quả và hướng dẫn tiếp theo`,
      ``,
      `📌 Hỏi tôi về loại visa cụ thể: **visa 407, 482, 500, 600, 186, 189, 190, 491...**`,
    ].join("\n");
  }

  // Liệt kê các loại visa
  const list = Object.entries(VISA_KB)
    .map(([num, v]) => `  * **Visa ${num}** — ${v.name.split("—")[1]?.trim()}`)
    .join("\n");
  return [
    `🛂 **Các loại visa Úc phổ biến tại Fly Visa:**`,
    ``,
    list,
    ``,
    `💬 Hỏi chi tiết: "Visa 482 là gì?" hoặc "Điều kiện visa 500?"`,
  ].join("\n");
}

async function handleMissingDocs(text: string): Promise<string> {
  const name = extractName(text);
  if (!name) return "❓ Bạn muốn kiểm tra hồ sơ còn thiếu của khách hàng nào? Hãy nêu **tên cụ thể**.";

  const tasks = await prisma.task.findMany({
    where: { content: { contains: name, mode: "insensitive" } },
    select: { id: true, content: true, checklistType: true, documents: true, visaType: true, assignedTo: true },
    take: 3,
  });

  if (!tasks.length) return `❌ Không tìm thấy khách hàng **"${name}"** trong hệ thống.`;

  const task = tasks[0];
  const checklistType = task.checklistType ?? "tourism";
  const requiredDocs = REQUIRED_DOCS[checklistType] ?? REQUIRED_DOCS["tourism"];

  // documents là JSON: { [docId]: [{name, url, ...}] }
  const uploadedIds = new Set<string>();
  const docs = task.documents as Record<string, unknown[]> | null;
  if (docs && typeof docs === "object") {
    Object.entries(docs).forEach(([key, val]) => {
      if (Array.isArray(val) && val.length > 0) uploadedIds.add(key);
    });
  }

  const missing = requiredDocs.filter((d) => !uploadedIds.has(d.id));
  const uploaded = requiredDocs.filter((d) => uploadedIds.has(d.id));

  const checklistLabel: Record<string, string> = {
    tourism: "Du lịch / Thăm thân",
    labor: "Lao động xuất khẩu",
    study: "Du học",
  };

  if (missing.length === 0) {
    return [
      `✅ **${task.content}** — Hồ sơ đầy đủ!`,
      `📁 Loại: ${checklistLabel[checklistType] ?? checklistType} · Visa: ${task.visaType ?? "Chưa rõ"}`,
      ``,
      `Tất cả **${requiredDocs.length} tài liệu bắt buộc** đã được nộp.`,
      `👨‍💼 Sale phụ trách: ${task.assignedTo ?? "Chưa giao"}`,
    ].join("\n");
  }

  const missingLines = missing.map((d) => `  ❌ ${d.name}`).join("\n");
  const doneLines = uploaded.map((d) => `  ✅ ${d.name}`).join("\n");

  return [
    `📋 **Hồ sơ của ${task.content}** (${checklistLabel[checklistType] ?? checklistType})`,
    `💼 Visa: ${task.visaType ?? "Chưa xác định"} · 👨‍💼 ${task.assignedTo ?? "Chưa giao"}`,
    ``,
    `❌ **Còn thiếu ${missing.length} tài liệu:**`,
    missingLines,
    uploaded.length > 0 ? `\n✅ **Đã có (${uploaded.length}):**\n${doneLines}` : "",
    ``,
    `📌 Tổng: ${uploaded.length}/${requiredDocs.length} tài liệu bắt buộc đã nộp`,
  ].filter(Boolean).join("\n");
}

function handleHelp(): string {
  return [
    "💡 **Tôi có thể giúp bạn:**",
    ``,
    `🔍 **Tìm khách hàng** — "Tìm khách Nguyễn Thị Mai"`,
    `📊 **Tổng quan pipeline** — "Tổng quan pipeline hiện tại"`,
    `💰 **Doanh thu** — "Doanh thu tháng này bao nhiêu?"`,
    `👥 **Hiệu suất nhân viên** — "Nhân viên nào bán tốt nhất?"`,
    `🔥 **Khách tiềm năng** — "Danh sách khách hàng nóng"`,
    `📋 **Tiến độ hồ sơ** — "Khách Trần Văn Hùng đang ở bước nào?"`,
    `📋 **Hồ sơ còn thiếu** — "Khách Nguyễn Văn A còn thiếu hồ sơ gì?"`,
    `🛂 **Thông tin visa** — "Visa 482 là gì?" / "Visa 500 yêu cầu gì?"`,
    `📅 **Điểm danh** — "Hôm nay ai chưa điểm danh?"`,
    ``,
    `Hãy thử hỏi tôi nhé!`,
  ].join("\n");
}

// ─── Insights generator (rule-based) ─────────────────────────────────────────
export async function generateInsights(): Promise<
  { type: "warning" | "opportunity" | "success" | "info"; title: string; body: string; action: string }[]
> {
  const now = new Date();
  const months = [0, 1, 2].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59), label: `T${d.getMonth() + 1}` };
  });

  const [curTasks, prevTasks, columns, employees, salesRecords] = await Promise.all([
    prisma.task.findMany({ where: { createdAt: { gte: months[0].start, lte: months[0].end } }, select: { price: true, source: true, visaType: true, columnId: true, assignedTo: true } }),
    prisma.task.findMany({ where: { createdAt: { gte: months[1].start, lte: months[1].end } }, select: { price: true, source: true } }),
    prisma.column.findMany({ include: { tasks: { select: { price: true, createdAt: true } } }, orderBy: { order: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true } }),
    prisma.salesRecord.findMany({ where: { createdAt: { gte: months[0].start } }, select: { profit: true, employeeId: true } }),
  ]);

  const insights: { type: "warning" | "opportunity" | "success" | "info"; title: string; body: string; action: string }[] = [];

  const curRev = curTasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
  const prevRev = prevTasks.reduce((s, t) => s + (parseInt(t.price.replace(/\D/g, "")) || 0), 0);
  const revGrowth = prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : 0;

  // 1. Revenue trend
  if (revGrowth > 10) {
    insights.push({ type: "success", title: `Doanh thu tháng này tăng ${revGrowth}%`, body: `Giá trị hợp đồng tháng này đạt ${Math.round(curRev / 1_000_000)}tr đ, tăng ${revGrowth}% so với tháng trước (${Math.round(prevRev / 1_000_000)}tr đ). Đây là tín hiệu tích cực.`, action: `Duy trì chiến lược hiện tại và mở rộng thêm kênh ${curTasks.sort((a, b) => 0)[0]?.source ?? "hiệu quả"}` });
  } else if (revGrowth < -10) {
    insights.push({ type: "warning", title: `Doanh thu tháng này giảm ${Math.abs(revGrowth)}%`, body: `Giá trị hợp đồng tháng này chỉ đạt ${Math.round(curRev / 1_000_000)}tr đ, giảm ${Math.abs(revGrowth)}% so với tháng trước (${Math.round(prevRev / 1_000_000)}tr đ).`, action: "Tổ chức họp review nguyên nhân và điều chỉnh chiến lược bán hàng trong tuần tới" });
  } else {
    insights.push({ type: "info", title: `Doanh thu ổn định, đạt ${Math.round(curRev / 1_000_000)}tr đ`, body: `Tháng này có ${curTasks.length} khách hàng mới với tổng giá trị ${Math.round(curRev / 1_000_000)}tr đ, tương đương tháng trước (${revGrowth > 0 ? "+" : ""}${revGrowth}%).`, action: "Tìm cơ hội tăng trưởng bằng cách thúc đẩy các hợp đồng giá trị cao hơn" });
  }

  // 2. Source analysis
  const sourceMap: Record<string, number> = {};
  curTasks.forEach((t) => { sourceMap[t.source ?? "Khác"] = (sourceMap[t.source ?? "Khác"] || 0) + 1; });
  const topSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  if (topSources.length >= 2) {
    const [top1, top2] = topSources;
    insights.push({ type: "opportunity", title: `Nguồn "${top1[0]}" đang dẫn đầu với ${top1[1]} khách`, body: `Tháng này nguồn "${top1[0]}" mang lại ${top1[1]} khách hàng (${Math.round((top1[1] / curTasks.length) * 100)}%), tiếp theo là "${top2[0]}" với ${top2[1]} khách.`, action: `Tăng ngân sách và nỗ lực cho kênh "${top1[0]}" để tối ưu ROI` });
  }

  // 3. Pipeline bottleneck
  const stageCounts = columns.map((c) => ({ name: c.title, count: c.tasks.length }));
  const maxStage = stageCounts.reduce((a, b) => (a.count > b.count ? a : b));
  if (maxStage.count > 5) {
    insights.push({ type: "warning", title: `Tắc nghẽn tại giai đoạn "${maxStage.name}" (${maxStage.count} hồ sơ)`, body: `Giai đoạn "${maxStage.name}" đang tồn đọng nhiều nhất với ${maxStage.count} hồ sơ. Đây có thể là điểm nghẽn trong quy trình xử lý.`, action: `Phân công thêm nhân sự xử lý hồ sơ tại giai đoạn "${maxStage.name}" để tránh chậm trễ` });
  }

  // 4. Employee performance
  const empRevMap: Record<string, number> = {};
  salesRecords.forEach((r) => { empRevMap[r.employeeId] = (empRevMap[r.employeeId] || 0) + r.profit; });
  const empRanking = Object.entries(empRevMap).sort((a, b) => b[1] - a[1]);
  if (empRanking.length >= 1) {
    const topRev = Math.round(empRanking[0][1] / 1_000_000);
    insights.push({ type: "success", title: `Nhân viên xuất sắc tháng này đạt ${topRev}tr doanh số`, body: `Nhân viên có doanh số cao nhất tháng này đạt ${topRev}tr đ. Đây là nguồn cảm hứng và kinh nghiệm cho cả team.`, action: "Tổ chức chia sẻ kinh nghiệm bán hàng từ nhân viên xuất sắc cho cả nhóm" });
  }

  // 5. Visa type trend
  const visaMap: Record<string, number> = {};
  curTasks.forEach((t) => { visaMap[t.visaType ?? "Khác"] = (visaMap[t.visaType ?? "Khác"] || 0) + 1; });
  const topVisa = Object.entries(visaMap).sort((a, b) => b[1] - a[1])[0];
  if (topVisa) {
    insights.push({ type: "info", title: `Visa "${topVisa[0]}" chiếm ${Math.round((topVisa[1] / curTasks.length) * 100)}% hồ sơ tháng này`, body: `Loại visa "${topVisa[0]}" là phổ biến nhất với ${topVisa[1]}/${curTasks.length} hồ sơ tháng này. Nhu cầu thị trường đang tập trung vào loại này.`, action: `Chuẩn bị thêm tài liệu và quy trình chuyên biệt cho visa "${topVisa[0]}" để xử lý nhanh hơn` });
  }

  // Đảm bảo luôn có 6 insights
  while (insights.length < 6) {
    insights.push({ type: "info", title: "Theo dõi và cập nhật dữ liệu thường xuyên", body: "Dữ liệu đầy đủ và chính xác giúp AI phân tích chính xác hơn. Hãy đảm bảo mọi giao dịch và hoạt động được ghi nhận kịp thời.", action: "Nhắc nhở nhân viên cập nhật trạng thái hồ sơ và hoạt động hàng ngày" });
  }

  return insights.slice(0, 6);
}

// ─── Lead score (rule-based nâng cao) ────────────────────────────────────────
export async function scoreLeadDetailed(taskId: string): Promise<{ score: number; label: string; reason: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { activities: { select: { completed: true, type: true } } },
  });
  if (!task) return { score: 1, label: "Lạnh", reason: "Không tìm thấy hồ sơ khách hàng" };

  let score = 3;
  const pros: string[] = [];
  const cons: string[] = [];

  // Nguồn khách
  if (["Giới thiệu"].includes(task.source ?? "")) { score += 3; pros.push("nguồn giới thiệu uy tín"); }
  else if (["Website"].includes(task.source ?? "")) { score += 2; pros.push("tự tìm kiếm qua website"); }
  else if (["Facebook Ads", "Tiktok Ads"].includes(task.source ?? "")) { score += 1; pros.push(`tiếp cận qua ${task.source}`); }
  else if (!task.source) { cons.push("chưa rõ nguồn khách"); }

  // Hoạt động tương tác
  const completed = task.activities.filter((a) => a.completed).length;
  const total = task.activities.length;
  if (completed >= 3) { score += 2; pros.push(`${completed}/${total} hoạt động đã hoàn thành`); }
  else if (completed >= 1) { score += 1; pros.push(`có ${total} lần tương tác`); }
  else if (total === 0) { cons.push("chưa có tương tác nào"); }
  else { cons.push(`${total} hoạt động chưa hoàn thành`); }

  // Giá trị hợp đồng
  const price = parseInt(task.price.replace(/\D/g, "")) || 0;
  if (price >= 50_000_000) { score += 2; pros.push(`hợp đồng ${Math.round(price / 1_000_000)}tr`); }
  else if (price >= 20_000_000) { score += 1; pros.push(`phí dịch vụ ${Math.round(price / 1_000_000)}tr`); }
  else if (price === 0) { cons.push("chưa có thông tin phí"); }

  // Thông tin hồ sơ đầy đủ
  const filledFields = [task.visaType, task.educationLevel, task.workExperience, task.englishScore, task.maritalStatus].filter(Boolean).length;
  if (filledFields >= 4) { score += 1; pros.push("hồ sơ đầy đủ thông tin"); }
  else if (filledFields <= 1) { cons.push("hồ sơ thiếu nhiều thông tin"); }

  score = Math.min(10, Math.max(1, score));
  const label = score >= 8 ? "Nóng" : score >= 5 ? "Ấm" : "Lạnh";

  // Tạo reason rõ ràng luôn có nội dung
  let reason = "";
  if (pros.length > 0 && cons.length > 0) {
    reason = `Điểm mạnh: ${pros.join(", ")}. Cần cải thiện: ${cons.join(", ")}`;
  } else if (pros.length > 0) {
    reason = `Tích cực: ${pros.join(", ")}`;
  } else if (cons.length > 0) {
    reason = `Cần cải thiện: ${cons.join(", ")}`;
  } else {
    reason = "Cần bổ sung thêm thông tin để đánh giá chính xác";
  }

  return { score, label, reason };
}

