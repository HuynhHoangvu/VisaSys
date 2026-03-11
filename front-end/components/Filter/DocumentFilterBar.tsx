import React from "react";
import { Select } from "flowbite-react";

interface DocumentFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  onReset: () => void;
}

const DocumentFilterBar: React.FC<DocumentFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterChange,
  filteredCount,
  totalCount,
  onReset,
}) => {
  const hasActiveFilter = searchQuery !== "" || filterStatus !== "all";

  return (
    <div className="px-5 py-3 bg-white flex flex-col sm:flex-row items-center gap-3 border-b border-gray-100 shrink-0">
      {/* Ô Tìm kiếm */}
      <div className="relative w-full sm:w-auto flex-1 max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Tìm giấy tờ (VD: CCCD, Khai sinh...)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Select Trạng thái */}
      <Select
        sizing="sm"
        value={filterStatus}
        onChange={(e) => onFilterChange(e.target.value)}
        className="w-full sm:w-48 shadow-sm"
      >
        <option value="all">📁 Tất cả trạng thái</option>
        <option value="uploaded">✅ Đã nộp file</option>
        <option value="missing">⚠️ Còn thiếu file</option>
      </Select>

      {/* Thông tin số lượng & Nút Xóa bộ lọc */}
      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 ml-auto">
        {hasActiveFilter && (
          <button
            onClick={onReset}
            className="text-[12px] font-semibold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
        <div className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 shadow-sm whitespace-nowrap">
          <span className="font-bold text-blue-600">{filteredCount}</span> /{" "}
          {totalCount} giấy tờ
        </div>
      </div>
    </div>
  );
};

export default DocumentFilterBar;
