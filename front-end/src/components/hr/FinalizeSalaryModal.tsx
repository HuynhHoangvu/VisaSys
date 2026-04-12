import React from "react";

interface FinalizeSalaryModalProps {
  show: boolean;
  onClose: () => void;
  finalizeMonth: string;
  setFinalizeMonth: (v: string) => void;
  isFinalizing: boolean;
  onConfirm: () => void;
}

const FinalizeSalaryModal: React.FC<FinalizeSalaryModalProps> = ({
  show,
  onClose,
  finalizeMonth,
  setFinalizeMonth,
  isFinalizing,
  onConfirm,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-red-50">
          <h3 className="text-base sm:text-lg font-bold text-red-700 flex items-center gap-2">
            ⚠️ Cảnh báo: Chốt Lương Cuối Tháng
          </h3>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            Hành động này sẽ tính toán tổng lương hiện tại, lưu vào{" "}
            <strong>Lịch sử lương</strong>, và{" "}
            <span className="text-red-600 font-bold">XÓA TOÀN BỘ</span> dữ liệu
            Chấm công, Thưởng/Phạt và Đơn nghỉ phép của tháng cũ.
          </p>
          <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
            Nhập tháng chốt (VD: 02/2026)
          </label>
          <input
            type="text"
            value={finalizeMonth}
            onChange={(e) => setFinalizeMonth(e.target.value)}
            placeholder="MM/YYYY"
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-bold text-center text-base sm:text-lg tracking-widest"
          />
        </div>
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
            disabled={isFinalizing}
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            disabled={isFinalizing}
            className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
          >
            {isFinalizing ? "Đang xử lý..." : "Xác nhận Chốt & Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalizeSalaryModal;
