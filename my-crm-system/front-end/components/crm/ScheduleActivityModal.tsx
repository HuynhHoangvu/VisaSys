import React, { useState } from "react";
import { Modal, Button, Label, TextInput } from "flowbite-react";
import type { Activity, ActivityType } from "../../types";

interface ScheduleActivityModalProps {
  show: boolean;
  onClose: () => void;
  taskId: string | null;
  onAddActivity: (activity: Omit<Activity, "id" | "taskId">) => void;
  activityToEdit?: Activity | null;
  onEditActivity?: (updatedActivity: Activity) => void;
}

const ScheduleActivityModal: React.FC<ScheduleActivityModalProps> = ({
  show,
  onClose,
  taskId,
  onAddActivity,
  activityToEdit,
  onEditActivity,
}) => {
  const [activeTab, setActiveTab] = useState<ActivityType>("Việc cần làm");
  const [summary, setSummary] = useState("");
  const [dueDate, setDueDate] = useState("");

  // KỸ THUẬT DERIVED STATE: Theo dõi sự thay đổi của Prop mà không dùng useEffect
  const [prevActivityToEdit, setPrevActivityToEdit] = useState<
    Activity | null | undefined
  >(undefined);
  const [prevShow, setPrevShow] = useState(false);

  if (show !== prevShow || activityToEdit !== prevActivityToEdit) {
    setPrevShow(show);
    setPrevActivityToEdit(activityToEdit);

    if (show) {
      if (activityToEdit) {
        setActiveTab(activityToEdit.type);
        setSummary(activityToEdit.summary);

        let parsedDate = "";
        if (
          activityToEdit.dueText &&
          activityToEdit.dueText.startsWith("Hạn: ")
        ) {
          const datePart = activityToEdit.dueText.replace("Hạn: ", "").trim();
          const [day, month, year] = datePart.split("/");
          if (day && month && year) {
            parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
        }
        setDueDate(parsedDate);
      } else {
        setActiveTab("Việc cần làm");
        setSummary("");
        setDueDate("");
      }
    }
  }

  const activityTypes: { id: ActivityType; label: string }[] = [
    { id: "Việc cần làm", label: "Việc cần làm" },
    { id: "Email", label: "Email" },
    { id: "Gọi", label: "Gọi" },
    { id: "Cuộc họp", label: "Cuộc họp" },
    { id: "Tài liệu", label: "Tài liệu" },
  ];

  const handleSave = () => {
    if (!taskId) return;

    const finalDueText = dueDate
      ? `Hạn: ${new Date(dueDate).toLocaleDateString("vi-VN")}`
      : "Chưa có hạn";

    if (activityToEdit && onEditActivity) {
      const updatedActivity: Activity = {
        ...activityToEdit,
        type: activeTab,
        summary: summary.trim() || `Thực hiện ${activeTab.toLowerCase()}`,
        dueText: finalDueText,
      };
      onEditActivity(updatedActivity);
    } else {
      const newActivityData: Omit<Activity, "id" | "taskId"> = {
        type: activeTab,
        summary: summary.trim() || `Thực hiện ${activeTab.toLowerCase()}`,
        assignee: "HoangVu",
        status: "Đã lên kế hoạch",
        completed: false,
        dueText: finalDueText,
        createdAt: new Date().toISOString(),
      };
      onAddActivity(newActivityData);
    }

    onClose();
  };

  const isEditMode = !!activityToEdit;

  return (
    <Modal show={show} onClose={onClose} size="2xl">
      <div className="flex items-start justify-between rounded-t border-b border-gray-200 p-5">
        <div>
          <h3 className="text-xl font-bold text-gray-800">
            {isEditMode ? "Sửa hoạt động" : "Lên lịch hoạt động"}
          </h3>
          {taskId && (
            <p className="text-sm text-gray-500 mt-1 font-mono">
              Đang xử lý thẻ: {taskId}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          {activityTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === type.id
                  ? "bg-blue-50 text-blue-700 border-b-2 border-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <form className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-32 font-medium text-gray-700">Tóm tắt</Label>
            <TextInput
              className="flex-1"
              placeholder="Nhập tóm tắt công việc..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <Label className="w-32 font-medium text-gray-700">
              Ngày đến hạn
            </Label>
            <TextInput
              type="date"
              className="flex-1 max-w-50"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <Label className="w-32 font-medium text-gray-700">
              Phân công cho
            </Label>
            <div className="flex items-center gap-2 bg-gray-100 pr-3 rounded-full overflow-hidden border border-gray-200 w-fit">
              <div className="w-8 h-8 bg-gray-500 text-white flex items-center justify-center font-bold text-sm">
                {activityToEdit ? activityToEdit.assignee.charAt(0) : "H"}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {activityToEdit ? activityToEdit.assignee : "HoangVu"}
              </span>
            </div>
          </div>
        </form>
      </div>

      <div className="flex items-center gap-3 rounded-b border-t border-gray-200 p-6 bg-gray-50">
        <Button style={{ backgroundColor: "#1d4ed8" }} onClick={handleSave}>
          {isEditMode ? "Cập nhật" : "Lưu"}
        </Button>
        <Button color="light" onClick={onClose}>
          Hủy bỏ
        </Button>
      </div>
    </Modal>
  );
};

export default ScheduleActivityModal;
