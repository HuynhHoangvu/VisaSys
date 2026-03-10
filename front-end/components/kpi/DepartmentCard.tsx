import React, { useState } from "react";
import EditTaskModal from "./EditTaskModal";
import type { DepartmentTemplate, KPITask } from "../../types";
import { getProgress } from "../../utils/helpers"; // Chỉnh sửa đường dẫn tới helpers của bạn

const ProgressBar: React.FC<{ value: number; color: string }> = ({
  value,
  color,
}) => (
  <div
    style={{
      width: "100%",
      height: "6px",
      background: "#e5e7eb",
      borderRadius: "999px",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${value}%`,
        height: "100%",
        borderRadius: "999px",
        background: value >= 100 ? "#16a34a" : value >= 50 ? color : "#f97316",
        transition: "width 0.3s ease",
      }}
    />
  </div>
);

interface DepartmentCardProps {
  dept: DepartmentTemplate;
  isDirector: boolean;
  weekLabel: string;
  onUpdate: (updated: DepartmentTemplate) => void;
}

const DepartmentCard: React.FC<DepartmentCardProps> = ({
  dept,
  isDirector,
  weekLabel,
  onUpdate,
}) => {
  const [editingTask, setEditingTask] = useState<KPITask | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTarget, setNewTaskTarget] = useState("");
  const [newTaskUnit, setNewTaskUnit] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(dept.goal);

  const completedCount = dept.tasks.filter(
    (t) => t.actual && parseFloat(t.actual.replace(/[^\d.]/g, "")) > 0,
  ).length;
  const overallProgress =
    dept.tasks.length > 0
      ? Math.round(
          dept.tasks.reduce(
            (sum, t) => sum + getProgress(t.actual, t.target),
            0,
          ) / dept.tasks.length,
        )
      : 0;

  const updateActual = (taskId: string, value: string) => {
    onUpdate({
      ...dept,
      tasks: dept.tasks.map((t) =>
        t.id === taskId ? { ...t, actual: value } : t,
      ),
    });
  };

  const saveTask = (updated: KPITask) => {
    onUpdate({
      ...dept,
      tasks: dept.tasks.map((t) => (t.id === updated.id ? updated : t)),
    });
  };

  const deleteTask = (taskId: string) => {
    onUpdate({ ...dept, tasks: dept.tasks.filter((t) => t.id !== taskId) });
  };

  const addTask = () => {
    if (!newTaskName || !newTaskTarget) return;
    const newTask: KPITask = {
      id: `${dept.id}-${Date.now()}`,
      name: newTaskName,
      target: newTaskTarget,
      actual: "",
      unit: newTaskUnit,
    };
    onUpdate({ ...dept, tasks: [...dept.tasks, newTask] });
    setNewTaskName("");
    setNewTaskTarget("");
    setNewTaskUnit("");
    setAddingTask(false);
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* HEADER CARD */}
      <div
        style={{
          background: dept.accent,
          padding: "16px 20px",
          borderBottom: `3px solid ${dept.color}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 900,
                color: dept.color,
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {dept.name}
            </h3>
            {editingGoal && isDirector ? (
              <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <input
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: `1.5px solid ${dept.color}`,
                    fontSize: "12px",
                    outline: "none",
                    flex: 1,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onUpdate({ ...dept, goal: goalDraft });
                      setEditingGoal(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    onUpdate({ ...dept, goal: goalDraft });
                    setEditingGoal(false);
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: dept.color,
                    color: "white",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </button>
              </div>
            ) : (
              <p
                style={{
                  fontSize: "12px",
                  color: dept.color,
                  margin: "4px 0 0",
                  fontWeight: 600,
                  opacity: 0.8,
                  cursor: isDirector ? "pointer" : "default",
                }}
                onClick={() => isDirector && setEditingGoal(true)}
              >
                Mục tiêu: {dept.goal}{" "}
                {isDirector && <span style={{ opacity: 0.5 }}>✏️</span>}
              </p>
            )}
          </div>
          <div style={{ textAlign: "center", marginLeft: "12px" }}>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color:
                  overallProgress >= 80
                    ? "#16a34a"
                    : overallProgress >= 50
                      ? dept.color
                      : "#f97316",
              }}
            >
              {overallProgress}%
            </div>
            <div
              style={{
                fontSize: "10px",
                color: dept.color,
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              {completedCount}/{dept.tasks.length} việc
            </div>
          </div>
        </div>
        <div style={{ marginTop: "10px" }}>
          <ProgressBar value={overallProgress} color={dept.color} />
        </div>
      </div>

      <div
        style={{
          padding: "8px 20px",
          background: "#f9fafb",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          📅 Công việc tuần — {weekLabel}
        </span>
        <div
          style={{
            display: "flex",
            gap: "6px",
            fontSize: "10px",
            color: "#9ca3af",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "#16a34a" }}>■</span> Đạt &nbsp;
          <span style={{ color: "#f97316" }}>■</span> Chưa đạt
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#fafafa",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <th
                style={{
                  padding: "10px 16px",
                  textAlign: "left",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                }}
              >
                Công việc
              </th>
              <th
                style={{
                  padding: "10px 16px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                KPI / Mục tiêu
              </th>
              <th
                style={{
                  padding: "10px 16px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Thực tế
              </th>
              <th
                style={{
                  padding: "10px 16px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                }}
              >
                Tiến độ
              </th>
              {isDirector && (
                <th style={{ padding: "10px 16px", width: "40px" }}></th>
              )}
            </tr>
          </thead>
          <tbody>
            {dept.tasks.map((task, i) => {
              const progress = getProgress(task.actual, task.target);
              const isDone = progress >= 100;
              return (
                <tr
                  key={task.id}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: i % 2 === 0 ? "white" : "#fafafa",
                  }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#1f2937" }}>
                        {task.name}
                      </span>
                      {/* HIỂN THỊ NGƯỜI PHỤ TRÁCH */}
                      {task.assignee && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          👤 {task.assignee}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: dept.color,
                        background: dept.accent,
                        padding: "3px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      {task.target}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <input
                        value={task.actual}
                        onChange={(e) => updateActual(task.id, e.target.value)}
                        placeholder="—"
                        style={{
                          width: "70px",
                          padding: "5px 8px",
                          borderRadius: "8px",
                          textAlign: "center",
                          border: `1.5px solid ${isDone ? "#86efac" : task.actual ? "#fde68a" : "#e5e7eb"}`,
                          background: isDone
                            ? "#f0fdf4"
                            : task.actual
                              ? "#fffbeb"
                              : "white",
                          fontSize: "13px",
                          fontWeight: 700,
                          outline: "none",
                          color: isDone
                            ? "#16a34a"
                            : task.actual
                              ? "#d97706"
                              : "#9ca3af",
                        }}
                      />
                      {task.unit && (
                        <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                          {task.unit}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", minWidth: "100px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      <ProgressBar value={progress} color={dept.color} />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: isDone ? "#16a34a" : "#6b7280",
                        }}
                      >
                        {isDone
                          ? "✅ Đạt"
                          : task.actual
                            ? `${progress}%`
                            : "Chưa cập nhật"}
                      </span>
                    </div>
                  </td>
                  {isDirector && (
                    <td style={{ padding: "12px 8px" }}>
                      <button
                        onClick={() => setEditingTask(task)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          color: "#d1d5db",
                          padding: "4px",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            dept.color)
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            "#d1d5db")
                        }
                      >
                        ✏️
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {isDirector && addingTask && (
              <tr
                style={{
                  borderBottom: "1px solid #f3f4f6",
                  background: dept.accent,
                }}
              >
                <td style={{ padding: "8px 16px" }}>
                  <input
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Tên công việc..."
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: `1.5px solid ${dept.color}`,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </td>
                <td style={{ padding: "8px 16px" }}>
                  <input
                    value={newTaskTarget}
                    onChange={(e) => setNewTaskTarget(e.target.value)}
                    placeholder="KPI: ≥ 5..."
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: `1.5px solid ${dept.color}`,
                      fontSize: "12px",
                      outline: "none",
                      textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  />
                </td>
                <td style={{ padding: "8px 16px" }}>
                  <input
                    value={newTaskUnit}
                    onChange={(e) => setNewTaskUnit(e.target.value)}
                    placeholder="Đơn vị..."
                    style={{
                      width: "80px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: `1.5px solid ${dept.color}`,
                      fontSize: "12px",
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                </td>
                <td
                  colSpan={isDirector ? 2 : 1}
                  style={{ padding: "8px 16px" }}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={addTask}
                      style={{
                        padding: "5px 14px",
                        borderRadius: "6px",
                        border: "none",
                        background: dept.color,
                        color: "white",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Thêm
                    </button>
                    <button
                      onClick={() => setAddingTask(false)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "#fafafa",
        }}
      >
        {dept.weeklyReport && dept.weeklyReport.length > 0 && (
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#6b7280",
                margin: "0 0 4px",
                textTransform: "uppercase",
              }}
            >
              Báo cáo tuần gồm:
            </p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {dept.weeklyReport.map((r, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: dept.accent,
                    color: dept.color,
                    fontWeight: 600,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
        {isDirector && (
          <button
            onClick={() => setAddingTask(true)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: `1.5px dashed ${dept.color}`,
              background: "transparent",
              color: dept.color,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginLeft: "auto",
            }}
          >
            + Thêm việc
          </button>
        )}
      </div>
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          deptColor={dept.color}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}
    </div>
  );
};

export default DepartmentCard;
