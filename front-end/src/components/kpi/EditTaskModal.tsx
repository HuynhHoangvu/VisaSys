import React, { useState } from "react";
import type { KPITask } from "../../types";

interface EditTaskModalProps {
  task: KPITask;
  deptColor: string;
  onClose: () => void;
  onSave: (updated: KPITask) => void;
  onDelete: () => void;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  deptColor,
  onClose,
  onSave,
  onDelete,
}) => {
  const [form, setForm] = useState({ ...task });
  const inp: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          width: "420px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 800,
              color: "#1f2937",
              margin: 0,
            }}
          >
            ✏️ Chỉnh sửa công việc
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              color: "#9ca3af",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#6b7280",
                marginBottom: "4px",
                display: "block",
                textTransform: "uppercase",
              }}
            >
              Tên công việc
            </label>
            <input
              style={inp}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          {/* DÒNG MỚI THÊM: NGƯỜI PHỤ TRÁCH */}
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#6b7280",
                marginBottom: "4px",
                display: "block",
                textTransform: "uppercase",
              }}
            >
              Người phụ trách
            </label>
            <input
              style={inp}
              value={form.assignee || ""}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              placeholder="VD: Nguyễn Văn A..."
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#6b7280",
                  marginBottom: "4px",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                KPI / Mục tiêu
              </label>
              <input
                style={inp}
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="VD: ≥ 5, 2 buổi..."
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#6b7280",
                  marginBottom: "4px",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                Đơn vị
              </label>
              <input
                style={inp}
                value={form.unit || ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="bài, buổi, %..."
              />
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            background: "#fafafa",
            borderRadius: "0 0 16px 16px",
          }}
        >
          <button
            onClick={() => {
              if (window.confirm("Xóa công việc này?")) {
                onDelete();
                onClose();
              }
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🗑 Xóa
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              onClick={() => {
                onSave(form);
                onClose();
              }}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "none",
                background: deptColor,
                color: "white",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTaskModal;
