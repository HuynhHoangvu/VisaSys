import React from "react";

const FlyServicesDashboard: React.FC = () => {
  const services = [
    {
      icon: "✈️",
      title: "Visa Du lịch",
      desc: "Tư vấn và hỗ trợ hồ sơ visa du lịch các quốc gia Schengen, Mỹ, Úc, Canada, Nhật, Hàn...",
      color: "bg-blue-50 border-blue-200",
      badge: "bg-blue-100 text-blue-700",
    },
    {
      icon: "🎓",
      title: "Visa Du học",
      desc: "Hỗ trợ hồ sơ visa du học, chứng minh tài chính, xác nhận nhập học các trường uy tín.",
      color: "bg-purple-50 border-purple-200",
      badge: "bg-purple-100 text-purple-700",
    },
    {
      icon: "💼",
      title: "Visa Lao động",
      desc: "Tư vấn visa lao động định cư, chuẩn bị hồ sơ HĐLĐ, bằng cấp, BHXH đầy đủ.",
      color: "bg-orange-50 border-orange-200",
      badge: "bg-orange-100 text-orange-700",
    },
    {
      icon: "🏠",
      title: "Visa Định cư",
      desc: "Hỗ trợ hồ sơ định cư diện đầu tư, tay nghề, đoàn tụ gia đình tại các nước phát triển.",
      color: "bg-green-50 border-green-200",
      badge: "bg-green-100 text-green-700",
    },
    {
      icon: "📋",
      title: "Chứng minh tài chính",
      desc: "Chuẩn bị sao kê ngân hàng, xác nhận số dư, giấy tờ tài sản theo yêu cầu đại sứ quán.",
      color: "bg-yellow-50 border-yellow-200",
      badge: "bg-yellow-100 text-yellow-700",
    },
    {
      icon: "🔍",
      title: "Tư vấn hồ sơ",
      desc: "Kiểm tra, đánh giá và hoàn thiện toàn bộ hồ sơ trước khi nộp đại sứ quán.",
      color: "bg-red-50 border-red-200",
      badge: "bg-red-100 text-red-700",
    },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 h-full custom-scrollbar">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl">✈️</span>
          Dịch Vụ Fly Visa
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Danh mục dịch vụ tư vấn visa và hồ sơ định cư chuyên nghiệp.
        </p>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((svc, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-5 flex flex-col gap-3 ${svc.color}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{svc.icon}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${svc.badge}`}>
                {svc.title}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{svc.desc}</p>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Lưu ý nội bộ</p>
          <p className="text-xs text-amber-700 mt-1">
            Báo giá cụ thể theo từng trường hợp khách hàng. Liên hệ Trưởng phòng để xác nhận mức giá trước khi tư vấn.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FlyServicesDashboard;
