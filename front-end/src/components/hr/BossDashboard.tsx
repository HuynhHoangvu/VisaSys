import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Button,
  Badge,
  Modal,
  Select,
  Textarea,
  Spinner,
  Progress,
} from "flowbite-react";
import type { AuthUser, Task } from "../../types";
import socket from "../../services/socket";
import SearchFilterBar from "../filter/SearchFilterBar";
import { FaceAvatar } from "../ui/FaceAvatar";

interface BossDashboardProps {
  currentUser: AuthUser;
}

interface ProfileData extends Task {
  columnId: string;
  columnName: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const BossDashboard: React.FC<BossDashboardProps> = ({ currentUser }) => {
  const [allProfiles, setAllProfiles] = useState<ProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<AuthUser[]>([]);

  // ==========================================
  // SEARCH & FILTER STATE
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterColumn, setFilterColumn] = useState("all");
  const [filterVisa, setFilterVisa] = useState("all");

  // Modal state
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
  // FETCH
  // ==========================================
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/hr/employees`);
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách nhân viên:", error);
    }
  }, []);

  const fetchAllProfiles = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/board`);
      const boardData = await res.json();
      const profilesList: ProfileData[] = [];

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

  useEffect(() => {
    fetchEmployees();
    fetchAllProfiles(true);
    socket.on("data_changed", () => fetchAllProfiles(false));
    const handleInstantRefresh = () => fetchAllProfiles(false);
    window.addEventListener("refreshBoard", handleInstantRefresh);
    return () => {
      socket.off("data_changed");
      window.removeEventListener("refreshBoard", handleInstantRefresh);
    };
  }, [fetchEmployees, fetchAllProfiles]);

  // ==========================================
  // BUILD FILTER OPTIONS TỪ DỮ LIỆU THỰC TẾ
  // ==========================================
  const filterOptions = useMemo(() => {
    const sales = [
      ...new Set(allProfiles.map((p) => p.assignedTo).filter(Boolean)),
    ]
      .sort()
      .map((name) => ({ value: name, label: name }));

    const columns = [
      ...new Map(allProfiles.map((p) => [p.columnId, p.columnName])).entries(),
    ].map(([value, label]) => ({ value, label }));

    const visaTypes = [
      ...new Set(allProfiles.map((p) => p.visaType).filter(Boolean)),
    ]
      .sort()
      .map((v) => ({ value: v!, label: v! }));

    return { sales, columns, visaTypes };
  }, [allProfiles]);

  // ==========================================
  // LỌC PROFILES
  // ==========================================
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter((profile) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = profile.content?.toLowerCase().includes(q);
        const matchPhone = profile.phone?.toLowerCase().includes(q);
        const matchSale = profile.assignedTo?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchSale) return false;
      }
      if (filterSale !== "all" && profile.assignedTo !== filterSale)
        return false;
      if (filterColumn !== "all" && profile.columnId !== filterColumn)
        return false;
      if (filterVisa !== "all" && profile.visaType !== filterVisa) return false;
      return true;
    });
  }, [allProfiles, searchQuery, filterSale, filterColumn, filterVisa]);

  const hasActiveFilter =
    searchQuery !== "" ||
    filterSale !== "all" ||
    filterColumn !== "all" ||
    filterVisa !== "all";

  const handleResetFilter = () => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterColumn("all");
    setFilterVisa("all");
  };

  // ==========================================
  // ACTIONS
  // ==========================================
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
      const response = await fetch(`${API_URL}/api/notifications/send`, {
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
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
      {/* HEADER */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Báo cáo Tổng hợp Khách hàng
          </h2>
          <p className="text-gray-500 mt-1">
            Quản lý ngày tạo, người phụ trách và tiến độ thu hồ sơ
          </p>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <SearchFilterBar
        searchPlaceholder="Tìm tên khách, số điện thoại, sale..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={[
          {
            key: "sale",
            placeholder: "👤 Tất cả Sale",
            value: filterSale,
            options: filterOptions.sales,
            onChange: setFilterSale,
          },
          {
            key: "column",
            placeholder: "📋 Tất cả trạng thái",
            value: filterColumn,
            options: filterOptions.columns,
            onChange: setFilterColumn,
          },
          {
            key: "visa",
            placeholder: "🛂 Loại visa",
            value: filterVisa,
            options: filterOptions.visaTypes,
            onChange: setFilterVisa,
          },
        ]}
        resultCount={filteredProfiles.length}
        totalCount={allProfiles.length}
        onReset={handleResetFilter}
        hasActiveFilter={hasActiveFilter}
      />

      {/* TABLE */}
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
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-400 italic"
                  >
                    {hasActiveFilter
                      ? "Không tìm thấy khách hàng phù hợp."
                      : "Chưa có dữ liệu khách hàng."}
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const totalCount = 17;
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
                          {/* Highlight search term */}
                          {searchQuery
                            ? profile.content
                                .split(" - ")[0]
                                .split(new RegExp(`(${searchQuery})`, "gi"))
                                .map((part, i) =>
                                  part.toLowerCase() ===
                                  searchQuery.toLowerCase() ? (
                                    <mark
                                      key={i}
                                      className="bg-yellow-200 rounded px-0.5"
                                    >
                                      {part}
                                    </mark>
                                  ) : (
                                    part
                                  ),
                                )
                            : profile.content.split(" - ")[0]}
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
                            <FaceAvatar
                              name={profile.assignedTo}
                              size={32}
                              showInitial={false}
                              className="rounded-full"
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
