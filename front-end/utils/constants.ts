import type { DepartmentTemplate } from "../types";

export const VISA_SERVICES = [
  { id: "v1", name: "Du lịch visa 600 (Úc)", flag: "🇦🇺" },
  { id: "v2", name: "Du học visa 500 (Úc)", flag: "🇦🇺" },
  { id: "v3", name: "Lao động visa 407 (Úc)", flag: "🇦🇺" },
  { id: "v4", name: "Lao động visa 482 (Úc)", flag: "🇦🇺" },
  { id: "v5", name: "Du lịch (Canada)", flag: "🇨🇦" },
  { id: "v6", name: "Du học (Canada)", flag: "🇨🇦" },
  { id: "v7", name: "Work permit (Canada)", flag: "🇨🇦" },
  { id: "v8", name: "Lao động châu Âu", flag: "🇪🇺" },
];

export const CUSTOMER_SOURCES = [
  "Facebook", "Cá Nhân", "Tik Tok", "Website", "Giới thiệu", "Zalo", "Hotline",
];
  export const getRequirementsList = (jobType: string) => {
    const reqs = [
      {
        id: "p1",
        section: "1. Hồ sơ nhân thân",
        name: "Hộ chiếu",
        note: "Còn hạn > 6 tháng (Màu)",
        required: true,
      },
      {
        id: "p2",
        section: "1. Hồ sơ nhân thân",
        name: "CCCD / CMND",
        note: "Scan 2 mặt (Màu)",
        required: true,
      },
      {
        id: "p3",
        section: "1. Hồ sơ nhân thân",
        name: "Ảnh thẻ 4x6",
        note: "Nền trắng, trong 6 tháng (JPG)",
        required: true,
      },
      {
        id: "p4",
        section: "1. Hồ sơ nhân thân",
        name: "Tờ khai visa online",
        note: "Khai trên ImmiAccount (PDF)",
        required: true,
        templateUrl: "/templates/to-khai-visa-uc.pdf",
      },
      {
        id: "p14",
        section: "1. Hồ sơ nhân thân",
        name: "Giấy đăng ký kết hôn",
        note: "Nếu đã kết hôn (Scan)",
        required: false,
      },
      {
        id: "p15",
        section: "1. Hồ sơ nhân thân",
        name: "Giấy khai sinh con",
        note: "Nếu có con (Scan)",
        required: false,
      },
      {
        id: "t5",
        section: "2. Hồ sơ chuyến đi",
        name: "Lịch trình du lịch",
        note: "Rõ ngày đi, về, địa điểm (PDF/Word)",
        required: true,
      },
      {
        id: "t6",
        section: "2. Hồ sơ chuyến đi",
        name: "Booking vé máy bay",
        note: "Chưa cần xuất vé (PDF)",
        required: false,
      },
      {
        id: "t7",
        section: "2. Hồ sơ chuyến đi",
        name: "Booking khách sạn",
        note: "Hoặc địa chỉ nhà người thân (PDF)",
        required: false,
      },
      {
        id: "f8",
        section: "3. Hồ sơ tài chính",
        name: "Sao kê tài khoản",
        note: "3-6 tháng, dư 100-150tr (PDF có mộc)",
        required: true,
      },
      {
        id: "f9",
        section: "3. Hồ sơ tài chính",
        name: "Sổ tiết kiệm",
        note: "Photo + xác nhận số dư (Scan)",
        required: false,
      },
      {
        id: "f13",
        section: "3. Hồ sơ tài chính",
        name: "Giấy tờ tài sản",
        note: "Nhà đất, xe, cổ phần (Scan)",
        required: false,
      },
    ];

    if (jobType === "Nhân viên") {
      reqs.push(
        {
          id: "j10",
          section: "4. Hồ sơ công việc",
          name: "Giấy xác nhận công việc",
          note: "Hợp đồng LĐ / QĐ bổ nhiệm (Scan)",
          required: true,
        },
        {
          id: "j11",
          section: "4. Hồ sơ công việc",
          name: "Đơn xin nghỉ phép",
          note: "Có xác nhận công ty (Scan)",
          required: true,
        },
      );
    } else if (jobType === "Chủ doanh nghiệp") {
      reqs.push({
        id: "j12",
        section: "4. Hồ sơ công việc",
        name: "Giấy đăng ký kinh doanh",
        note: "Bản Scan",
        required: true,
      });
    }

    reqs.push(
      {
        id: "inv16",
        section: "5. Người bảo lãnh (Thăm thân)",
        name: "Thư mời",
        note: "Bắt buộc nếu đi thăm thân (Scan)",
        required: false,
      },
      {
        id: "inv17",
        section: "5. Người bảo lãnh (Thăm thân)",
        name: "Giấy tờ người mời",
        note: "Visa/Passport Úc của người mời (Scan)",
        required: false,
      },
    );

    return reqs;
  };
  // Thêm 2 hàm này vào cuối file constants.ts của bạn

  export const getLaborRequirements = () => {
    return [
      { id: "lb1", section: "1. Giấy tờ cá nhân", name: "Hộ chiếu (Passport)", note: "Còn hạn tối thiểu 2–3 năm (Scan màu tất cả trang)", required: true },
      { id: "lb2", section: "1. Giấy tờ cá nhân", name: "CCCD / CMND", note: "Scan 2 mặt (Scan PDF)", required: true },
      { id: "lb3", section: "1. Giấy tờ cá nhân", name: "Giấy khai sinh", note: "Bản sao công chứng (Scan)", required: true },
      { id: "lb4", section: "1. Giấy tờ cá nhân", name: "Sổ hộ khẩu / Xác nhận cư trú", note: "Xác nhận nơi ở hiện tại (Scan)", required: true },
      { id: "lb5", section: "1. Giấy tờ cá nhân", name: "Giấy đăng ký kết hôn", note: "Nếu đã kết hôn (Scan)", required: false },
      { id: "lb6", section: "1. Giấy tờ cá nhân", name: "Giấy khai sinh con", note: "Nếu có con (Scan)", required: false },
      { id: "lb7", section: "1. Giấy tờ cá nhân", name: "Ảnh thẻ nền trắng", note: "4x6 hoặc 3.5x4.5 (File JPG + bản in)", required: true },
      { id: "lb27", section: "1. Giấy tờ cá nhân", name: "Lý lịch tư pháp", note: "Xác nhận không tiền án (Bản scan)", required: true },
      
      { id: "lb8", section: "2. Học vấn & Kỹ năng", name: "Bằng tốt nghiệp THPT", note: "Bằng cấp tối thiểu (Scan)", required: true },
      { id: "lb9", section: "2. Học vấn & Kỹ năng", name: "Bằng trung cấp/cao đẳng/đại học", note: "Nếu có (Scan)", required: false },
      { id: "lb10", section: "2. Học vấn & Kỹ năng", name: "Bảng điểm", note: "Đi kèm bằng cấp (Scan)", required: false },
      { id: "lb11", section: "2. Học vấn & Kỹ năng", name: "Chứng chỉ nghề", note: "Nấu ăn, cơ khí, điện, nông nghiệp... (Scan)", required: false },
      { id: "lb20", section: "2. Học vấn & Kỹ năng", name: "Chứng chỉ ngoại ngữ (Tiếng Anh)", note: "IELTS, PTE (Tùy chương trình)", required: false },
      { id: "lb21", section: "2. Học vấn & Kỹ năng", name: "Chứng chỉ tiếng khác", note: "Nhật, Đức, Hàn (Tùy thị trường)", required: false },
      
      { id: "lb12", section: "3. Kinh nghiệm làm việc", name: "CV chi tiết", note: "Mô tả kinh nghiệm làm việc (File PDF/Word)", required: true },
      { id: "lb13", section: "3. Kinh nghiệm làm việc", name: "Hợp đồng lao động cũ", note: "Chứng minh kinh nghiệm (Scan)", required: false },
      { id: "lb14", section: "3. Kinh nghiệm làm việc", name: "Giấy xác nhận công việc", note: "Do công ty cũ cấp (Scan)", required: false },
      { id: "lb15", section: "3. Kinh nghiệm làm việc", name: "Payslips (phiếu lương)", note: "3–6 tháng gần nhất (Scan)", required: false },
      { id: "lb16", section: "3. Kinh nghiệm làm việc", name: "Sao kê ngân hàng nhận lương", note: "Xác nhận thu nhập (PDF có dấu ngân hàng)", required: false },
      { id: "lb17", section: "3. Kinh nghiệm làm việc", name: "Hình ảnh đang làm việc", note: "Chứng minh kỹ năng nghề (File JPG)", required: false },
      { id: "lb18", section: "3. Kinh nghiệm làm việc", name: "Video thao tác nghề", note: "Nấu ăn, cơ khí, xây dựng... (File MP4)", required: false },
      { id: "lb19", section: "3. Kinh nghiệm làm việc", name: "Hình ảnh nơi làm việc", note: "Nhà xưởng, bếp, công trình (File JPG)", required: false },
      
      { id: "lb22", section: "4. Tài chính & Khác", name: "Sổ tiết kiệm", note: "Chứng minh tài chính (Scan)", required: false },
      { id: "lb23", section: "4. Tài chính & Khác", name: "Sao kê ngân hàng", note: "3–6 tháng gần nhất (PDF)", required: false },
      { id: "lb24", section: "4. Tài chính & Khác", name: "Giấy tờ nhà đất", note: "Chứng minh tài sản (Scan)", required: false },
      { id: "lb25", section: "4. Tài chính & Khác", name: "Đăng ký xe", note: "Xe máy hoặc ô tô (Scan)", required: false },
      { id: "lb26", section: "4. Tài chính & Khác", name: "Giấy phép kinh doanh", note: "Nếu là chủ kinh doanh (Scan)", required: false },
      { id: "lb28", section: "4. Tài chính & Khác", name: "Giấy khám sức khỏe", note: "Theo tiêu chuẩn xuất khẩu lao động (Scan)", required: true },
      { id: "lb29", section: "4. Tài chính & Khác", name: "Hồ sơ bệnh án", note: "Nếu có bệnh lý trước đây (Scan)", required: false },
    ];
  };

  export const getStudyAbroadRequirements = () => {
    return [
      { id: "sa1", section: "1. Hồ sơ cá nhân", name: "Hộ chiếu (Passport)", note: "Còn hạn tối thiểu 2–3 năm (Scan màu)", required: true },
      { id: "sa2", section: "1. Hồ sơ cá nhân", name: "CCCD / CMND", note: "Scan 2 mặt (Scan PDF)", required: true },
      { id: "sa3", section: "1. Hồ sơ cá nhân", name: "Giấy khai sinh", note: "Bản sao công chứng (Scan)", required: true },
      { id: "sa4", section: "1. Hồ sơ cá nhân", name: "Sổ hộ khẩu / Xác nhận cư trú", note: "Xác nhận nơi ở (Scan)", required: true },
      { id: "sa5", section: "1. Hồ sơ cá nhân", name: "Ảnh thẻ nền trắng", note: "4x6 hoặc 3.5x4.5 (File JPG + bản in)", required: true },
      { id: "sa6", section: "1. Hồ sơ cá nhân", name: "Giấy đăng ký kết hôn", note: "Nếu đã lập gia đình (Scan)", required: false },
      { id: "sa30", section: "1. Hồ sơ cá nhân", name: "Giấy khám sức khỏe", note: "Theo yêu cầu visa (Scan)", required: true },

      { id: "sa7", section: "2. Hồ sơ học tập", name: "Học bạ cấp 2 / cấp 3", note: "Dùng khi du học THPT (Scan)", required: false },
      { id: "sa8", section: "2. Hồ sơ học tập", name: "Bảng điểm học tập", note: "Theo bậc học đăng ký (Scan)", required: true },
      { id: "sa9", section: "2. Hồ sơ học tập", name: "Bằng tốt nghiệp THPT", note: "Khi du học đại học (Scan)", required: true },
      { id: "sa10", section: "2. Hồ sơ học tập", name: "Bằng đại học", note: "Khi du học thạc sĩ (Scan)", required: false },
      { id: "sa11", section: "2. Hồ sơ học tập", name: "Bảng điểm đại học", note: "Dùng cho hồ sơ thạc sĩ (Scan)", required: false },
      { id: "sa12", section: "2. Hồ sơ học tập", name: "Chứng chỉ tiếng Anh", note: "IELTS hoặc PTE (Tùy trường yêu cầu)", required: true },
      { id: "sa24", section: "2. Hồ sơ học tập", name: "CV học tập", note: "Tóm tắt quá trình học (File PDF)", required: false },
      { id: "sa25", section: "2. Hồ sơ học tập", name: "Personal Statement", note: "Bài luận cá nhân (File PDF)", required: false },
      { id: "sa26", section: "2. Hồ sơ học tập", name: "Study Plan", note: "Kế hoạch học tập (File PDF)", required: false },

      { id: "sa27", section: "3. Giấy tờ trường học & Visa", name: "Thư mời nhập học", note: "Do trường cấp (Scan)", required: true },
      { id: "sa28", section: "3. Giấy tờ trường học & Visa", name: "COE (Xác nhận đăng ký học)", note: "Tùy quốc gia (Scan)", required: true },
      { id: "sa29", section: "3. Giấy tờ trường học & Visa", name: "Đơn xin visa du học", note: "Điền theo form online (PDF)",templateUrl: "/templates/to-khai-visa-uc.pdf", required: true },

      { id: "sa13", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Sổ tiết kiệm", note: "Chứng minh tài chính (Scan)", required: true },
      { id: "sa14", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Sao kê ngân hàng", note: "3–6 tháng gần nhất (PDF)", required: false },
      { id: "sa15", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Giấy xác nhận số dư tài khoản", note: "Do ngân hàng cấp (Scan)", required: false },
      { id: "sa16", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Hợp đồng lao động người bảo trợ", note: "Chứng minh thu nhập (Scan)", required: false },
      { id: "sa17", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Sao kê lương người bảo trợ", note: "PDF", required: false },
      { id: "sa18", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Giấy phép kinh doanh", note: "Nếu gia đình kinh doanh (Scan)", required: false },
      { id: "sa19", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Báo cáo thuế", note: "Chứng minh nguồn thu nhập (Scan)", required: false },
      { id: "sa20", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Giấy chứng nhận QSDĐ", note: "Chứng minh tài sản (Scan)", required: false },
      { id: "sa21", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Giấy tờ nhà", note: "Tài sản sở hữu (Scan)", required: false },
      { id: "sa22", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Đăng ký xe", note: "Xe máy hoặc ô tô (Scan)", required: false },
      { id: "sa23", section: "4. Hồ sơ tài chính & Bảo trợ", name: "Hợp đồng cho thuê nhà", note: "Nếu có (Scan)", required: false },
    ];
};
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; 

// Các định dạng file được phép tải lên hệ thống nội bộ
export const ALLOWED_FILE_TYPES = [
  "application/pdf", // .pdf
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "image/jpeg", // .jpg, .jpeg
  "image/png", // .png
];
export const INITIAL_DEPARTMENTS: DepartmentTemplate[] = [
  {
    id: "marketing",
    name: "Bộ phận Marketing",
    goal: "Tạo khách hàng (lead)",
    color: "#7c3aed",
    accent: "#ede9fe",
    tasks: [
      { id: "m1", name: "Bài viết Facebook", target: "≥ 5 bài", actual: "", unit: "bài" },
      { id: "m2", name: "Video TikTok / Reels", target: "≥ 4 video", actual: "", unit: "video" },
      { id: "m3", name: "Poster tuyển dụng", target: "≥ 4 thiết kế", actual: "", unit: "thiết kế" },
      { id: "m4", name: "Lead khách hàng", target: "25 – 40 khách", actual: "", unit: "khách" },
      { id: "m5", name: "Tương tác inbox", target: "100%", actual: "", unit: "%" },
    ],
    weeklyReport: ["Tổng số lead", "Nguồn lead", "Bài nào hiệu quả"],
  },
  {
    id: "sale",
    name: "Trưởng phòng Sale",
    goal: "Quản lý doanh thu",
    color: "#0284c7",
    accent: "#e0f2fe",
    tasks: [
      { id: "s1", name: "Họp sale", target: "2 buổi", actual: "", unit: "buổi" },
      { id: "s2", name: "Kiểm tra CRM", target: "2 lần", actual: "", unit: "lần" },
      { id: "s3", name: "Hỗ trợ chốt khách", target: "≥ 3 case", actual: "", unit: "case" },
      { id: "s4", name: "Đào tạo sale", target: "1 buổi", actual: "", unit: "buổi" },
      { id: "s5", name: "Tổng hợp doanh số", target: "1 báo cáo", actual: "", unit: "báo cáo" },
    ],
    weeklyReport: ["Doanh số đội: ≥ 2 – 4 hợp đồng"],
  },
  {
    id: "hoso",
    name: "Bộ phận Hồ sơ",
    goal: "Xử lý hồ sơ",
    color: "#0d9488",
    accent: "#ccfbf1",
    tasks: [
      { id: "h1", name: "Nhận khách mới", target: "2 – 5", actual: "", unit: "khách" },
      { id: "h2", name: "Kiểm tra hồ sơ", target: "5 – 10", actual: "", unit: "hồ sơ" },
      { id: "h3", name: "Chuẩn bị hồ sơ", target: "3 – 5", actual: "", unit: "bộ" },
      { id: "h4", name: "Nộp hồ sơ visa", target: "2 – 4", actual: "", unit: "bộ" },
      { id: "h5", name: "Cập nhật CRM", target: "100%", actual: "", unit: "%" },
    ],
    weeklyReport: ["Hồ sơ mới", "Hồ sơ thiếu", "Hồ sơ đang nộp"],
  },
  {
    id: "troly",
    name: "Trợ lý Điều hành",
    goal: "Hỗ trợ vận hành",
    color: "#b45309",
    accent: "#fef3c7",
    tasks: [
      { id: "t1", name: "Tìm đối tác mới", target: "8 – 10", actual: "", unit: "đối tác" },
      { id: "t2", name: "Email hợp tác", target: "5 – 10", actual: "", unit: "email" },
      { id: "t3", name: "Cuộc họp Zoom", target: "1 – 2", actual: "", unit: "buổi" },
      { id: "t4", name: "Employer mới", target: "1", actual: "", unit: "employer" },
      { id: "t5", name: "Báo cáo thị trường", target: "1", actual: "", unit: "báo cáo" },
    ],
    weeklyReport: [],
  },
];

export const DEPT_TO_TEMPLATE_ID: Record<string, string> = {
  Sale: "sale",
  "Xử lý hồ sơ": "hoso",
  "Ban Giám đốc": "sale",
  "Kế toán": "troly",
  Marketing: "marketing",
};