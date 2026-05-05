import React from "react";
import { Modal } from "flowbite-react";
import type { Activity } from "../../types";

interface ActivityListModalProps {
  show: boolean;
  onClose: () => void;
  onOpenScheduleForm: () => void;
  activities: Activity[];
  onCompleteActivity: (id: string) => void;
  onDeleteActivity: (id: string) => void;
  onEditActivity: (id: string) => void;
}

const ActivityListModal: React.FC<ActivityListModalProps> = ({
  show,
  onClose,
  onOpenScheduleForm,
  activities,
  onCompleteActivity,
  onDeleteActivity,
  onEditActivity,
}) => {
  const todayActivities = activities.filter((a) => a.status === "Hôm nay");
  const plannedActivities = activities.filter(
    (a) => a.status === "Đã lên kế hoạch",
  );

  const renderActivityItem = (act: Activity) => (
    <div
      key={act.id}
      className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 hover:bg-gray-50 transition-colors"
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-500 text-white rounded flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
        {act.assignee.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs sm:text-sm text-gray-800 truncate">
          {act.type}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500 truncate">
          {act.assignee} - {act.summary || act.dueText}
        </p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 shrink-0">
        <button
          onClick={() => onCompleteActivity(act.id)}
          className="p-1 hover:text-green-500"
          title="Đánh dấu hoàn thành"
        >
          <svg
            className="w-4 h-4 sm:w-4 sm:h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button
          onClick={() => {
            onEditActivity(act.id);
          }}
          className="p-1 hover:text-flygold"
          title="Sửa"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onClick={() => onDeleteActivity(act.id)}
          className="p-1 hover:text-red-500"
          title="Xóa"
        >
          <svg
            className="w-4 h-4 sm:w-4 sm:h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      size="sm"
      position="center"
      className="md:p-4"
      dismissible
    >
      <div className="bg-white rounded-lg flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-800 text-sm sm:text-base">
            Hoạt động đã lên lịch
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 p-1 rounded-md hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1">
          {todayActivities.length > 0 && (
            <div>
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-flygold font-semibold text-xs sm:text-sm">
                  Hôm nay
                </span>
                <span className="bg-flygold text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {todayActivities.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {todayActivities.map(renderActivityItem)}
              </div>
            </div>
          )}
          {plannedActivities.length > 0 && (
            <div>
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-y border-gray-200 mt-2">
                <span className="text-green-600 font-semibold text-xs sm:text-sm">
                  Đã lên kế hoạch
                </span>
                <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {plannedActivities.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {plannedActivities.map(renderActivityItem)}
              </div>
            </div>
          )}
          {todayActivities.length === 0 && plannedActivities.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-xs sm:text-sm">
              Chưa có hoạt động nào.
            </div>
          )}
        </div>
        <div
          onClick={() => {
            onOpenScheduleForm();
          }}
          className="p-3 bg-gray-100 text-center text-gray-800 font-bold text-xs sm:text-sm cursor-pointer hover:bg-gray-200 border-t border-gray-200 mt-auto"
        >
          + Lên lịch một hoạt động
        </div>
      </div>
    </Modal>
  );
};

export default ActivityListModal;
