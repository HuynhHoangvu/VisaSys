import React, { useState, useEffect } from "react";
import type { AuthUser, DepartmentTemplate } from "../../types";
import DepartmentCard from "./DepartmentCard";
import { INITIAL_DEPARTMENTS, DEPT_TO_TEMPLATE_ID } from "../../utils/constants";
import { getProgress } from "../../utils/helpers";
import api from "../../services/api";

interface Props {
  currentUser: AuthUser;
}

const WeeklyTaskAssignment: React.FC<Props> = ({ currentUser }) => {
  const isDirector =
    currentUser.role.toLowerCase().includes("giám đốc") ||
    currentUser.role.toLowerCase().includes("phó giám đốc") ||
    currentUser.id === "admin";
  const isManager =
    currentUser.role.toLowerCase().includes("quản lý") ||
    currentUser.role.toLowerCase().includes("trưởng phòng");
  const canEditAll = isDirector || isManager;

  const myTemplateId = DEPT_TO_TEMPLATE_ID[currentUser.department] || "";

  const [departments, setDepartments] = useState<DepartmentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // STATE MỚI: Quản lý ngày đang xem (Mặc định là hôm nay)
  const [currentDate, setCurrentDate] = useState(new Date());

  // STATE MỚI: Tab đang chọn (Dành cho Sếp)
  const [activeTab, setActiveTab] = useState<string>("all");

  // Tính toán tuần dựa trên currentDate
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekLabel = `${startOfWeek.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${endOfWeek.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  // HÀM CHUYỂN TUẦN
  const goToPreviousWeek = () => {
    setCurrentDate(
      (prev) => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000),
    );
  };
  const goToNextWeek = () => {
    setCurrentDate(
      (prev) => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
  };
  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        setIsLoading(true);
        const { data } = await api.get(
          `/api/kpi?weekLabel=${encodeURIComponent(weekLabel)}`,
        );
        if (data) {
          setDepartments(data);
        } else {
          setDepartments(INITIAL_DEPARTMENTS);
        }
      } catch (error) {
        console.error("Lỗi lấy KPI:", error);
        setDepartments(INITIAL_DEPARTMENTS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKPI();
  }, [weekLabel]);

  const updateDept = async (updated: DepartmentTemplate) => {
    const newDepartments = departments.map((d) =>
      d.id === updated.id ? updated : d,
    );
    setDepartments(newDepartments);

    try {
      await api.post("/api/kpi", {
        weekLabel: weekLabel,
        data: newDepartments,
      });
    } catch (error) {
      console.error("Lỗi lưu KPI:", error);
    }
  };

  const allTasks = departments.flatMap((d) => d.tasks);
  const totalProgress =
    allTasks.length > 0
      ? Math.round(
          allTasks.reduce(
            (sum, t) => sum + getProgress(t.actual, t.target),
            0,
          ) / allTasks.length,
        )
      : 0;

  // Xử lý hiển thị Tab: Nhân viên thường chỉ thấy bộ phận mình. Sếp thấy theo Tab.
  let visibleDepts = departments;
  if (!canEditAll) {
    visibleDepts = departments.filter((d) => d.id === myTemplateId);
  } else if (activeTab !== "all") {
    visibleDepts = departments.filter((d) => d.id === activeTab);
  }

  if (isLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        Đang tải dữ liệu công việc...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#f8f9fa",
        padding: "24px",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: "#1f2937",
                margin: 0,
              }}
            >
              {canEditAll
                ? "📋 Quản lý Công việc & KPI"
                : "📋 Công việc của tôi"}
            </h2>

            {/* KHU VỰC ĐIỀU HƯỚNG TUẦN */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "12px",
              }}
            >
              <button
                onClick={goToPreviousWeek}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ❮ Tuần trước
              </button>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#374151",
                  background: "#e5e7eb",
                  padding: "6px 16px",
                  borderRadius: "999px",
                }}
              >
                {weekLabel}
              </span>
              <button
                onClick={goToNextWeek}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Tuần sau ❯
              </button>
              <button
                onClick={goToCurrentWeek}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#f3f4f6",
                  color: "#4b5563",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12px",
                  marginLeft: "8px",
                }}
              >
                Về hiện tại
              </button>
            </div>
          </div>

          {canEditAll && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  color:
                    totalProgress >= 80
                      ? "#16a34a"
                      : totalProgress >= 50
                        ? "#2563eb"
                        : "#f97316",
                }}
              >
                {totalProgress}%
              </div>
              <div
                style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}
              >
                Tiến độ toàn công ty
              </div>
            </div>
          )}
        </div>

        {/* KHU VỰC TAB CHỌN BỘ PHẬN (CHỈ DÀNH CHO SẾP) */}
        {canEditAll && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "24px",
              overflowX: "auto",
              paddingBottom: "8px",
            }}
          >
            <button
              onClick={() => setActiveTab("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                border: "none",
                whiteSpace: "nowrap",
                background: activeTab === "all" ? "#1f2937" : "#e5e7eb",
                color: activeTab === "all" ? "white" : "#4b5563",
                transition: "all 0.2s",
              }}
            >
              Tất cả phòng ban
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setActiveTab(dept.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  border: `1px solid ${activeTab === dept.id ? dept.color : "transparent"}`,
                  whiteSpace: "nowrap",
                  background: activeTab === dept.id ? dept.accent : "white",
                  color: activeTab === dept.id ? dept.color : "#6b7280",
                  transition: "all 0.2s",
                }}
              >
                {dept.name.replace("Bộ phận ", "").replace("Trưởng phòng ", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      {visibleDepts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#9ca3af",
            padding: "60px 0",
            fontSize: "14px",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
          <p>Chưa có công việc được giao.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {visibleDepts.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              isDirector={canEditAll}
              weekLabel={weekLabel}
              onUpdate={updateDept}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklyTaskAssignment;
