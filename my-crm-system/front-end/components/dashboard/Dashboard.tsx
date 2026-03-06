// import React from "react";
// import { Card } from "flowbite-react";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Legend,
// } from "recharts";
// import { initialData } from "../../src/data";

// const Dashboard: React.FC = () => {
//   // --- 1. TÍNH TOÁN TRỰC TIẾP (KHÔNG DÙNG USEEFFECT/USESTATE) ---
//   const allTasks = Object.values(initialData.tasks);

//   // Tính tổng doanh thu
//   const totalRevenue = allTasks.reduce((sum, task) => {
//     const priceString = task.price.replace(/[.đ]/g, "");
//     return sum + (parseInt(priceString) || 0);
//   }, 0);

//   // Tính số lượng Lead
//   const totalLeads = allTasks.length;

//   // Tính tỷ lệ chốt (Giả định khách ở cột 4 là thành công)
//   const wonCount = allTasks.filter((task) =>
//     initialData.columns["col-4"].taskIds.includes(task.id),
//   ).length;

//   const winRate =
//     totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : "0";

//   // --- 2. CHUẨN BỊ DỮ LIỆU BIỂU ĐỒ ---
//   const revenueData = [
//     { name: "T1", total: 120000000 },
//     { name: "T2", total: 210000000 },
//     { name: "T3", total: 180000000 },
//     { name: "T4", total: 320000000 },
//     { name: "T5", total: 250000000 },
//     { name: "T6 (Nay)", total: totalRevenue },
//   ];

//   const serviceData = [
//     { name: "Visa Úc", value: 45 },
//     { name: "Định cư Canada", value: 30 },
//     { name: "Du học Mỹ", value: 25 },
//   ];

//   const COLORS = ["#F5A21B", "#1d4ed8", "#10b981"];

//   const formatVNĐ = (value: number): string => {
//     if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)} Tỷ`;
//     if (value >= 1000000) return `${(value / 1000000).toFixed(0)} Tr`;
//     return value.toString();
//   };

//   return (
//     <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50">
//       {/* KPI CARDS */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         <Card>
//           <p className="text-sm font-medium text-gray-500">
//             Tổng Doanh Thu Dự Kiến
//           </p>
//           <h4 className="text-2xl font-bold text-gray-900 mt-1">
//             {new Intl.NumberFormat("vi-VN").format(totalRevenue)}đ
//           </h4>
//         </Card>

//         <Card>
//           <p className="text-sm font-medium text-gray-500">
//             Khách Hàng (Leads)
//           </p>
//           <h4 className="text-2xl font-bold text-gray-900 mt-1">
//             {totalLeads}
//           </h4>
//         </Card>

//         <Card>
//           <p className="text-sm font-medium text-gray-500">
//             Tỷ lệ Chốt Hợp Đồng
//           </p>
//           <h4 className="text-2xl font-bold text-gray-900 mt-1">{winRate}%</h4>
//         </Card>

//         <Card>
//           <p className="text-sm font-medium text-gray-500">Chế độ Dữ liệu</p>
//           <h4 className="text-lg font-bold text-blue-600 mt-1 italic">
//             Dữ liệu Hệ thống
//           </h4>
//         </Card>
//       </div>

//       {/* BIỂU ĐỒ */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         <Card className="lg:col-span-2 shadow-sm border-none">
//           <h5 className="text-lg font-bold text-gray-800 mb-4">
//             Biến động doanh thu
//           </h5>
//           <div className="h-[300px]">
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={revenueData}>
//                 <CartesianGrid
//                   strokeDasharray="3 3"
//                   vertical={false}
//                   stroke="#f0f0f0"
//                 />
//                 <XAxis dataKey="name" axisLine={false} tickLine={false} />
//                 <YAxis
//                   tickFormatter={formatVNĐ}
//                   width={60}
//                   axisLine={false}
//                   tickLine={false}
//                 />
//                 <Tooltip
//                   cursor={{ fill: "#f9fafb" }}
//                   formatter={(value: number) =>
//                     new Intl.NumberFormat("vi-VN").format(value) + "đ"
//                   }
//                 />
//                 <Bar
//                   dataKey="total"
//                   fill="#F5A21B"
//                   radius={[4, 4, 0, 0]}
//                   barSize={40}
//                 />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </Card>

//         <Card className="shadow-sm border-none">
//           <h5 className="text-lg font-bold text-gray-800 mb-4">
//             Cơ cấu dịch vụ
//           </h5>
//           <div className="h-[300px]">
//             <ResponsiveContainer width="100%" height="100%">
//               <PieChart>
//                 <Pie
//                   data={serviceData}
//                   innerRadius={60}
//                   outerRadius={80}
//                   dataKey="value"
//                   stroke="none"
//                 >
//                   {serviceData.map((_, index) => (
//                     <Cell
//                       key={`cell-${index}`}
//                       fill={COLORS[index % COLORS.length]}
//                     />
//                   ))}
//                 </Pie>
//                 <Tooltip />
//                 <Legend iconType="circle" />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </Card>
//       </div>
//     </div>
//   );
// };

// export default Dashboard;
