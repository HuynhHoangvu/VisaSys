import React from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface SearchFilterConfig {
  // Tìm kiếm
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;

  // Các bộ filter — mảng filter tùy ý, mỗi filter là 1 select
  filters?: {
    key: string;
    placeholder: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    icon?: React.ReactNode;
  }[];

  // Hiện số kết quả
  resultCount?: number;
  totalCount?: number;

  // Nút reset
  onReset?: () => void;
  hasActiveFilter?: boolean;
}

const SearchFilterBar: React.FC<SearchFilterConfig> = ({
  searchPlaceholder = "Tìm kiếm...",
  searchValue,
  onSearchChange,
  filters = [],
  resultCount,
  totalCount,
  onReset,
  hasActiveFilter = false,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
      {/* SEARCH INPUT */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
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
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent placeholder:text-gray-400 shadow-sm"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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

      {/* FILTER SELECTS */}
      {filters.map((filter) => (
        <div key={filter.key} className="relative">
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className={`pl-3 pr-8 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-colors ${
              filter.value !== "all"
                ? "border-orange-400 bg-orange-50 text-orange-700 font-semibold"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <option value="all">{filter.placeholder}</option>
            {filter.options.map((opt, idx) => (
              <option
                key={`${filter.key}-${opt.value}-${idx}`} // Key kết hợp: tiền tố filter + giá trị + chỉ số index
                value={opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* RESET BUTTON — chỉ hiện khi có filter active */}
      {hasActiveFilter && onReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Xóa bộ lọc
        </button>
      )}

      {/* KẾT QUẢ */}
      {resultCount !== undefined && totalCount !== undefined && (
        <span className="text-xs text-gray-400 font-medium ml-auto">
          {hasActiveFilter ? (
            <>
              <span className="text-orange-500 font-bold">{resultCount}</span> /{" "}
              {totalCount} khách hàng
            </>
          ) : (
            <>
              <span className="font-bold text-gray-600">{totalCount}</span>{" "}
              khách hàng
            </>
          )}
        </span>
      )}
    </div>
  );
};

export default SearchFilterBar;
