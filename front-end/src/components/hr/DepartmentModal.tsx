import React from "react";
import { Modal, Button, TextInput } from "flowbite-react";
import type { Department } from "../../types";

interface DepartmentModalProps {
  show: boolean;
  onClose: () => void;
  departments: Department[];
  canAddPersonnel: boolean;
  canDeletePersonnel: boolean;
  newDeptName: string;
  setNewDeptName: (v: string) => void;
  editingDeptId: string | null;
  setEditingDeptId: (id: string | null) => void;
  editDeptName: string;
  setEditDeptName: (v: string) => void;
  onAdd: () => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({
  show,
  onClose,
  departments,
  canAddPersonnel,
  canDeletePersonnel,
  newDeptName,
  setNewDeptName,
  editingDeptId,
  setEditingDeptId,
  editDeptName,
  setEditDeptName,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  return (
    <Modal show={show} onClose={onClose} size="lg" className="md:p-4">
      <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
          Quản lý Bộ Phận
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <TextInput
            className="flex-1 shadow-sm"
            placeholder="Nhập tên bộ phận mới..."
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
          />
          <Button color="success" onClick={onAdd} className="shadow-sm whitespace-nowrap">
            Thêm
          </Button>
        </div>
        <div className="max-h-[50vh] sm:max-h-80 overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg shadow-sm custom-scrollbar w-full">
          <table className="w-full min-w-[400px] text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-4 sm:px-6 py-3 font-bold">Tên bộ phận</th>
                <th className="px-4 sm:px-6 py-3 text-right font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {departments.map((dept) => (
                <tr key={dept.id} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-gray-900">
                    {editingDeptId === dept.id ? (
                      <TextInput
                        sizing="sm"
                        value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                      />
                    ) : (
                      dept.name
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                    {editingDeptId === dept.id ? (
                      <div className="flex justify-end gap-2 sm:gap-3">
                        <button
                          className="text-green-600 hover:underline font-semibold"
                          onClick={() => onUpdate(dept.id)}
                        >
                          Lưu
                        </button>
                        <button
                          className="text-gray-500 hover:underline font-semibold"
                          onClick={() => setEditingDeptId(null)}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3 sm:gap-4">
                        {canAddPersonnel && (
                          <button
                            onClick={() => {
                              setEditingDeptId(dept.id);
                              setEditDeptName(dept.name);
                            }}
                            className="font-semibold text-orange-500 hover:text-orange-700 hover:underline"
                          >
                            Sửa
                          </button>
                        )}
                        {canDeletePersonnel && (
                          <button
                            className="text-red-500 hover:underline font-semibold"
                            onClick={() => onDelete(dept.id)}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default DepartmentModal;
