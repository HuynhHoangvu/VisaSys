import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Avatar,
  Badge,
  Modal,
  Select,
  Textarea,
  Spinner,
  Progress,
} from "flowbite-react";
import type { AuthUser, Task } from "../../types";
import { io } from "socket.io-client";
interface BossDashboardProps {
  currentUser: AuthUser;
}

interface ProfileData extends Task {
  columnId: string;
  columnName: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL); 
const BossDashboard: React.FC<BossDashboardProps> = ({ currentUser }) => {
  const [allProfiles, setAllProfiles] = useState<ProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<AuthUser[]>([]);

  // State cho Modal Gửi Nhắc Nhở
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(
    null,
  );
  const [reminderType, setReminderType] = useState(
    "Khách này đang thiếu hồ sơ, em bổ sung gấp nhé!",
  );
  const [customText, setCustomText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // ==========================================
  // HÀM LẤY DANH SÁCH NHÂN VIÊN
  // ==========================================
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/hr/employees`);
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách nhân viên:", error);
    }
  }, []);

  // ==========================================
  // HÀM LẤY DỮ LIỆU BÁO CÁO (CÓ POLLING)
  // ==========================================
  const fetchAllProfiles = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/board`);
      const boardData = await res.json();

      const profilesList: ProfileData[] = [];

      // Gom tất cả khách hàng từ các cột lại thành 1 danh sách
      Object.keys(boardData.columns).forEach((colId) => {
        const col = boardData.columns[colId];
        col.taskIds.forEach((taskId: string) => {
          const task = boardData.tasks[taskId];
          profilesList.push({
            ...task,
            columnId: colId,
            columnName: col.title,
          });
        });
      });

      // Sắp xếp: Khách hàng mới tạo xếp lên đầu
      profilesList.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setAllProfiles(profilesList);
    } catch (error) {
      console.error("Lỗi lấy báo cáo:", error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  // ==========================================
  // TỰ ĐỘNG TẢI DỮ LIỆU & LẮNG NGHE SỰ KIỆN REFRESH
  // ==========================================
  useEffect(() => {
    fetchEmployees();
    fetchAllProfiles(true);

    // THAY INTERVAL BẰNG SOCKET LẮNG NGHE
    socket.on("data_changed", () => {
      fetchAllProfiles(false);
    });

    const handleInstantRefresh = () => fetchAllProfiles(false);
    window.addEventListener("refreshBoard", handleInstantRefresh);

    return () => {
      socket.off("data_changed");
      window.removeEventListener("refreshBoard", handleInstantRefresh);
    };
  }, [fetchEmployees, fetchAllProfiles]);

  const openReminderModal = (profile: ProfileData) => {
    if (!profile.assignedTo) {
      alert(
        "Khách hàng này chưa có Sale chăm sóc. Sếp vui lòng phân bổ trước!",
      );
      return;
    }
    setSelectedProfile(profile);
    setReminderType("Khách này đang thiếu hồ sơ, em bổ sung gấp nhé!");
    setCustomText("");
    setIsModalOpen(true);
  };

  const handleSendReminder = async () => {
    if (!selectedProfile) return;
    setIsSending(true);

    const finalMessage = reminderType === "Khác" ? customText : reminderType;

    try {
      const response = await fetch(`${API_URL}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: selectedProfile.content.split(" - ")[0],
          saleName: selectedProfile.assignedTo,
          sender: currentUser.name,
          customMessage: finalMessage,
          taskId: selectedProfile.id,
        }),
      });

      if (!response.ok) throw new Error("Không thể gửi thông báo");

      setIsModalOpen(false);
      alert(`Đã gửi nhắc nhở đến Sale: ${selectedProfile.assignedTo}`);
      fetchAllProfiles(false);
    } catch (error) {
      alert("Lỗi khi gửi thông báo: " + error);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (columnId: string) => {
    switch (columnId) {
      case "col-1":
        return "gray";
      case "col-2":
        return "info";
      case "col-3":
        return "warning";
      case "col-4":
        return "success";
      default:
        return "dark";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getEmployeeAvatar = (employeeName: string) => {
    const employee = employees.find((e) => e.name === employeeName);
    return employee?.name?.charAt(0) || employeeName?.charAt(0) || "?";
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-y-auto h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Báo cáo Tổng hợp Khách hàng
          </h2>
          <p className="text-gray-500 mt-1">
            Quản lý ngày tạo, người phụ trách và tiến độ thu hồ sơ
          </p>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-xl overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 font-bold">Ngày tạo</th>
                <th className="px-5 py-4 font-bold">Khách hàng / Dịch vụ</th>
                <th className="px-5 py-4 font-bold">Sale quản lý</th>
                <th className="px-5 py-4 font-bold min-w-50">
                  Trạng thái & Tiến độ hồ sơ
                </th>
                <th className="px-5 py-4 font-bold text-right">
                  Lệnh điều hành
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allProfiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-400 italic"
                  >
                    Chưa có dữ liệu khách hàng.
                  </td>
                </tr>
              ) : (
                allProfiles.map((profile) => {
                  // ==========================================
                  // LOGIC TÍNH TIẾN ĐỘ HỒ SƠ ĐÃ ĐỒNG BỘ
                  // ==========================================
                  const totalCount = 17; // Tạm fix cứng tổng số checklist theo DocumentModal là 17
                  const doneCount = profile.documents
                    ? Object.keys(profile.documents).length
                    : 0;
                  const percent = Math.min(
                    Math.round((doneCount / totalCount) * 100),
                    100,
                  );

                  return (
                    <tr
                      key={profile.id}
                      className="bg-white hover:bg-orange-50/30 transition-colors"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-700">
                          {formatDate(profile.createdAt)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900 text-base">
                          {profile.content.split(" - ")[0]}
                        </p>
                        <p className="text-xs font-medium text-gray-500">
                          {profile.content.split(" - ")[1]}
                        </p>
                        <p className="text-xs font-bold text-blue-600 mt-1">
                          SĐT: {profile.phone}
                        </p>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {profile.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              size="sm"
                              rounded
                              placeholderInitials={getEmployeeAvatar(
                                profile.assignedTo,
                              )}
                              className="bg-indigo-100 text-indigo-600"
                            />
                            <span className="font-bold text-gray-800">
                              {profile.assignedTo}
                            </span>
                          </div>
                        ) : (
                          <Badge color="failure" className="w-fit">
                            Chưa phân bổ
                          </Badge>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          <Badge
                            color={getStatusColor(profile.columnId)}
                            className="w-fit"
                          >
                            {profile.columnName}
                          </Badge>

                          {/* HIỂN THỊ TIẾN ĐỘ */}
                          <div className="mt-1">
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span
                                className={
                                  percent === 100
                                    ? "text-green-600"
                                    : "text-gray-500"
                                }
                              >
                                {percent === 100 ? "✅ Đã đủ hồ sơ" : "Đã thu:"}
                              </span>
                              <span
                                className={
                                  percent === 100
                                    ? "text-green-600"
                                    : "text-gray-500"
                                }
                              >
                                {doneCount}/{totalCount} mục
                              </span>
                            </div>
                            <Progress
                              progress={percent}
                              color={percent === 100 ? "green" : "blue"}
                              size="sm"
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          color="warning"
                          outline
                          onClick={() => openReminderModal(profile)}
                          className="ml-auto focus:ring-0 shadow-sm"
                        >
                          ⚡ Gửi nhắc nhở
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL GỬI LỜI NHẮC */}
      <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)} size="md">
        <div className="p-5 border-b border-gray-200 bg-orange-50 rounded-t-lg">
          <h3 className="text-xl font-bold text-orange-700 flex items-center gap-2">
            ⚡ Lệnh điều hành nhanh
          </h3>
          <p className="text-sm text-orange-600 mt-1 font-medium">
            Gửi trực tiếp đến Sale:{" "}
            <strong className="text-gray-900">
              {selectedProfile?.assignedTo}
            </strong>
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block mb-2 text-sm font-bold text-gray-900">
              Nội dung nhắc nhở:
            </label>
            <Select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value)}
            >
              <option value="Khách này đang thiếu hồ sơ, em bổ sung gấp nhé!">
                📑 Yêu cầu: Đòi đủ hồ sơ khách hàng
              </option>
              <option value="Gọi điện chăm sóc lại khách hàng này ngay!">
                📞 Yêu cầu: Gọi lại cho khách ngay
              </option>
              <option value="Hồ sơ đang bị ngâm lâu, đẩy nhanh tiến độ chốt sale!">
                🔥 Yêu cầu: Đẩy nhanh chốt Sale
              </option>
              <option value="Khác">✏️ Khác (Tự gõ nội dung)...</option>
            </Select>
          </div>

          {reminderType === "Khác" && (
            <div>
              <label className="block mb-2 text-sm font-bold text-gray-900">
                Nhập nội dung nhắc nhở:
              </label>
              <Textarea
                rows={3}
                placeholder="Ví dụ: Khách này thiếu sao kê ngân hàng, đòi ngay nhé!"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
          <Button color="gray" onClick={() => setIsModalOpen(false)}>
            Hủy
          </Button>
          <Button
            color="failure"
            onClick={handleSendReminder}
            disabled={isSending}
          >
            {isSending ? "Đang gửi..." : "Gửi lệnh ngay"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default BossDashboard;
