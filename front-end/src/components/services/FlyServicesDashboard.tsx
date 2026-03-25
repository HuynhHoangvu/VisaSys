import React from "react";
import { Card, Badge } from "flowbite-react";

const FlyServicesDashboard: React.FC = () => {
  // DỮ LIỆU BẰNG CẤP
  const degreeServices = [
    { name: "Bằng cấp Trung cấp nghề", price: "45.000.000" },
    { name: "Bằng Cao đẳng", price: "56.000.000" },
  ];

  // DỮ LIỆU HỒ SƠ HĐLĐ
  const financialDocs = [
    {
      id: 1,
      name: "Hợp đồng lao động",
      desc: "Ghi rõ vị trí, mức lương, thời hạn, chữ ký",
      price: "2.500.000 - 4.500.000",
    },
    {
      id: 2,
      name: "Quyết định bổ nhiệm",
      desc: "Xác nhận vị trí, chức vụ trong công ty",
      price: "1.000.000",
    },
    {
      id: 3,
      name: "Xác nhận lương",
      desc: "Mức lương nhận hàng tháng, có đóng dấu Cty",
      price: "1.000.000",
    },
    {
      id: 4,
      name: "Sao kê lương",
      desc: "Dòng tiền chuyển khoản 6 - 12 tháng gần nhất",
      price: "6.000.000 - 8.000.000",
    },
    {
      id: 5,
      name: "Tham gia BHXH",
      desc: "Giấy xác nhận đóng bảo hiểm xã hội 2 đến 3 năm",
      price: "6.000.000 - 8.000.000",
    },
    {
      id: 6,
      name: "Chứng minh kinh nghiệm",
      desc: "Chứng minh kinh nghiệm làm việc liên quan đến ngành nghề lao động định cư",
      price: "15.000.000",
    },
  ];

  // DỮ LIỆU DỊCH VỤ HỖ TRỢ KHÁC
  const otherServices = [
    { id: 1, name: "Sổ đất", desc: "Giấy chứng nhận quyền sử dụng đất (Chính chủ)", price: "4.000.000 - 6.000.000" },
    { id: 2, name: "Xe", desc: "Giấy tờ xe (ô tô, xe máy)", price: "2.000.000 - 4.000.000" },
    { id: 3, name: "Sổ tiết kiệm", desc: "Có sổ tiết kiệm & Xác nhận số dư sổ tiết kiệm", price: "2.500.000 - 10.000.000" },
  ];

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-50 h-full relative custom-scrollbar">
      {/* HEADER */}
      <div className="mb-4 sm:mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          Bảng Giá Dịch Vụ - Fly Visa
        </h2>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          Tài liệu nội bộ dành cho bộ phận Sale tra cứu giá dịch vụ tư vấn.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        {/* CỘT TRÁI: CÁC DỊCH VỤ CHÍNH */}
        <div className="xl:col-span-8 space-y-4 sm:space-y-6">
          {/* 2. CHỨNG MINH TÀI CHÍNH */}
          <Card className="shadow-sm border-none rounded-xl overflow-hidden p-0">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-bold text-white uppercase text-center sm:text-left">
                📄 Hồ Sơ Hợp Đồng Lao Động Trọn Bộ
              </h3>
            </div>
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-orange-50/50 border-b border-orange-100">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">STT</th>
                    <th className="px-4 py-3 font-bold">Thành phần hồ sơ</th>
                    <th className="px-4 py-3 font-bold w-1/2">Mô tả</th>
                    <th className="px-4 py-3 font-bold text-right">
                      Giá (VNĐ)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {financialDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-center font-bold text-gray-400">
                        {doc.id}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800">
                        {doc.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.desc}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600 whitespace-nowrap">
                        {doc.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-orange-100/50 border-t-2 border-orange-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center">
                      <span className="text-base sm:text-lg font-bold text-orange-800 uppercase tracking-wide">
                        BỘ HỒ SƠ HĐLĐ TỪ 15.000.000 VNĐ - 20.000.000 VNĐ / BỘ
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* 3. DỊCH VỤ HỖ TRỢ KHÁC */}
          <Card className="shadow-sm border-none rounded-xl overflow-hidden p-0">
            <div className="bg-gradient-to-r from-orange-400 to-orange-500 p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-bold text-white uppercase text-center">
                🏠 Các Dịch Vụ Hỗ Trợ Khác
              </h3>
            </div>
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-sm text-left text-gray-600">
                <tbody className="divide-y divide-gray-100">
                  {otherServices.map((srv) => (
                    <tr
                      key={srv.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-center font-bold text-gray-400 bg-gray-50 w-12">
                        {srv.id}
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-800 w-1/4">
                        {srv.name}
                      </td>
                      <td className="px-4 py-4 text-gray-600">{srv.desc}</td>
                      <td className="px-4 py-4 text-right font-bold text-orange-600 whitespace-nowrap">
                        {srv.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {/* 1. DỊCH VỤ BẰNG CẤP */}
          <Card className="shadow-sm border-none rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-bold text-white uppercase flex items-center gap-2">
                🎓 Dịch Vụ Cung Cấp Bằng Cấp
              </h3>
            </div>
            <div className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                {degreeServices.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      {item.name}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-blue-700">
                      {item.price} VNĐ
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-red-50 p-3 sm:p-4 border-t border-red-100 flex items-center justify-center gap-2">
                <Badge color="failure" className="text-xs px-2 py-1">
                  Lưu ý
                </Badge>
                <span className="text-sm font-bold text-red-700">
                  Trường hợp KHÔNG CÓ Bằng cấp 3: Phụ thu thêm +25.000.000 VNĐ
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* CỘT PHẢI: LƯU Ý QUAN TRỌNG (Gắn dính trên màn to) */}
        <div className="xl:col-span-4 space-y-4 sm:space-y-6">
          <div className="sticky top-6 space-y-4 sm:space-y-6">
            {/* Box Phí Apply Visa */}
            <Card className="border-l-[6px] border-l-blue-600 shadow-sm border-y-0 border-r-0 rounded-xl bg-blue-50/30">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-base sm:text-lg mb-1">
                    Phí Dịch vụ Apply Visa
                  </h4>
                  <p className="text-xl sm:text-2xl font-black text-blue-700 mb-2">
                    150$
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-medium">
                    Sẽ thanh toán{" "}
                    <strong className="text-gray-800">
                      khi khách hàng CÓ VISA
                    </strong>
                    .
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs sm:text-sm text-gray-600">
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>
                        Trường hợp khách hàng bị từ chối visa sẽ{" "}
                        <strong>KHÔNG MẤT PHÍ</strong> dịch vụ.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>Ngoài ra hỗ trợ Apply lại cho quý khách hàng.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Box Lệ Phí & Dịch Thuật */}
            <Card className="border-l-[6px] border-l-red-500 shadow-sm border-y-0 border-r-0 rounded-xl bg-red-50/30">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-lg text-red-500 shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-red-800 text-base mb-2">
                    LƯU Ý CÁC KHOẢN NGOÀI PHÍ
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                    Các chi phí dịch vụ trên <strong>CHƯA BAO GỒM</strong>:
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="bg-white p-2.5 rounded border border-red-100 flex justify-between items-center shadow-sm">
                      <span className="text-xs sm:text-sm font-semibold text-gray-600">
                        Lệ phí chính phủ
                      </span>
                      <span className="text-sm font-bold text-red-600">
                        195 AUD{" "}
                        <span className="text-xs text-gray-400 font-normal">
                          (Đô la Úc)
                        </span>
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-red-100 flex justify-between items-center shadow-sm">
                      <span className="text-xs sm:text-sm font-semibold text-gray-600">
                        Chi phí dịch thuật
                      </span>
                      <span className="text-sm font-bold text-red-600">
                        85.000 VNĐ{" "}
                        <span className="text-xs text-gray-400 font-normal">
                          / 1 trang
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlyServicesDashboard;