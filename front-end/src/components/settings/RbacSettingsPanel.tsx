import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import type { AuthUser } from "../../types";

type CatalogItem = { id: string; label: string; group: string };
type MatrixRow = {
  departmentId: string;
  departmentName: string;
  permissions: string[];
};
type EmployeeRow = {
  id: string;
  name: string;
  employeeCode: string;
  role: string;
  department: string;
};
type EffectivePayload = {
  employeeId: string;
  role: string;
  department: string;
  departmentPermissionsFromDb: string[] | null;
  legacyDefaultPreview: string[];
  override: { granted: string[]; revoked: string[] } | null;
  effective: string[];
};

/** Nhãn nhóm hiển thị — không dùng mã thô (nav, system…) dạng ALL CAPS. */
function catalogGroupLabel(group: string): string {
  const key = (group || "other").toLowerCase();
  const titles: Record<string, string> = {
    nav: "Menu & màn hình",
    system: "Hệ thống",
    crm: "Khách hàng (CRM)",
    kpi: "Giao việc tuần (KPI)",
    hr: "Nhân sự & lương",
    other: "Khác",
  };
  return titles[key] ?? group;
}

type DeptPreset = "full" | "nav_only" | "nav_hr" | "clear";

function applyDeptPreset(
  preset: DeptPreset,
  catalog: CatalogItem[],
  allIds: Set<string>,
): Set<string> {
  if (preset === "full") return new Set(allIds);
  if (preset === "clear") return new Set();
  const pick = (g: string | string[]) => {
    const gs = Array.isArray(g) ? g : [g];
    return catalog.filter((c) => gs.includes((c.group || "other").toLowerCase())).map((c) => c.id);
  };
  if (preset === "nav_only") return new Set(pick("nav"));
  if (preset === "nav_hr") return new Set([...pick("nav"), ...pick("hr")]);
  return new Set();
}

const RbacSettingsPanel: React.FC<{ onSelfPermissionsUpdated?: (u: AuthUser) => void }> = ({
  onSelfPermissionsUpdated,
}) => {
  const [subTab, setSubTab] = useState<"department" | "employee">("department");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [deptEdits, setDeptEdits] = useState<Record<string, Set<string>>>({});
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [empId, setEmpId] = useState("");
  const [effectiveData, setEffectiveData] = useState<EffectivePayload | null>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Lọc quyền theo tên (tab bộ phận + tab nhân viên). */
  const [permFilter, setPermFilter] = useState("");
  const [overridePermFilter, setOverridePermFilter] = useState("");
  const [openDepts, setOpenDepts] = useState<Record<string, boolean>>({});

  const loadCatalogAndMatrix = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([
      api.get<{ catalog: CatalogItem[] }>("/api/access/catalog"),
      api.get<{
        matrix: MatrixRow[];
        rbacSchemaMissing?: boolean;
        warning?: string;
      }>("/api/access/matrix"),
    ]);
    setCatalog(cRes.data.catalog);
    const rows = mRes.data.matrix;
    if (mRes.data.rbacSchemaMissing && mRes.data.warning) {
      setStatus(mRes.data.warning);
    } else {
      setStatus(null);
    }
    setMatrix(rows);
    const next: Record<string, Set<string>> = {};
    for (const r of rows) {
      next[r.departmentId] = new Set(r.permissions);
    }
    setDeptEdits(next);
  }, []);

  useEffect(() => {
    loadCatalogAndMatrix().catch(() => setStatus("Không tải được ma trận quyền."));
  }, [loadCatalogAndMatrix]);

  const loadEmployees = useCallback(async () => {
    const { data } = await api.get<EmployeeRow[]>("/api/access/employees");
    setEmployees(data);
  }, []);

  useEffect(() => {
    if (subTab === "employee") loadEmployees().catch(() => {});
  }, [subTab, loadEmployees]);

  useEffect(() => {
    setOpenDepts((prev) => {
      const next = { ...prev };
      for (const r of matrix) {
        if (next[r.departmentId] === undefined) next[r.departmentId] = true;
      }
      for (const k of Object.keys(next)) {
        if (!matrix.some((m) => m.departmentId === k)) delete next[k];
      }
      return next;
    });
  }, [matrix]);

  const catalogByGroup = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const c of catalog) {
      const g = c.group || "other";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const catalogByGroupFiltered = useMemo(() => {
    const q = permFilter.trim().toLowerCase();
    const match = (item: CatalogItem) =>
      !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    return catalogByGroup
      .map(([group, items]) => [group, items.filter(match)] as [string, CatalogItem[]])
      .filter(([, items]) => items.length > 0);
  }, [catalogByGroup, permFilter]);

  const filteredOverrideCatalog = useMemo(() => {
    const q = overridePermFilter.trim().toLowerCase();
    const match = (item: CatalogItem) =>
      !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    return catalog.filter(match);
  }, [catalog, overridePermFilter]);

  const allCatalogIds = useMemo(() => new Set(catalog.map((c) => c.id)), [catalog]);

  const setDeptPermSet = (departmentId: string, next: Set<string>) => {
    setDeptEdits((prev) => ({ ...prev, [departmentId]: next }));
  };

  const selectAllForDept = (departmentId: string) => {
    setDeptPermSet(departmentId, new Set(allCatalogIds));
  };

  /** Để trống = sau khi lưu vẫn theo mô tả backend (chưa gán quyền trong DB → legacy). */
  const clearAllForDept = (departmentId: string) => {
    setDeptPermSet(departmentId, new Set());
  };

  const mergeGroupIntoDept = (departmentId: string, items: CatalogItem[]) => {
    setDeptEdits((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[departmentId] || []);
      for (const it of items) set.add(it.id);
      copy[departmentId] = set;
      return copy;
    });
  };

  const removeGroupFromDept = (departmentId: string, items: CatalogItem[]) => {
    setDeptEdits((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[departmentId] || []);
      for (const it of items) set.delete(it.id);
      copy[departmentId] = set;
      return copy;
    });
  };

  const toggleDeptPerm = (departmentId: string, id: string) => {
    setDeptEdits((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[departmentId] || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      copy[departmentId] = set;
      return copy;
    });
  };

  const copyPermissionsFromDept = (targetDeptId: string, sourceDeptId: string) => {
    setDeptPermSet(targetDeptId, new Set(deptEdits[sourceDeptId] || []));
  };

  const saveMatrix = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const assignments = matrix.map((r) => ({
        departmentId: r.departmentId,
        permissions: [...(deptEdits[r.departmentId] || new Set())],
      }));
      await api.put("/api/access/matrix", { assignments });
      setStatus("Đã lưu ma trận theo bộ phận.");
      const me = await api.get<AuthUser>("/api/auth/me");
      localStorage.setItem("flyvisa_user", JSON.stringify(me.data));
      onSelfPermissionsUpdated?.(me.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setStatus(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const loadEffective = async (id: string) => {
    if (!id) return;
    setBusy(true);
    setStatus(null);
    try {
      const { data } = await api.get<EffectivePayload>(`/api/access/employees/${id}/effective`);
      setEffectiveData(data);
      setGranted(new Set(data.override?.granted || []));
      setRevoked(new Set(data.override?.revoked || []));
    } catch {
      setStatus("Không tải được quyền nhân viên.");
    } finally {
      setBusy(false);
    }
  };

  const saveOverride = async () => {
    if (!empId) return;
    setBusy(true);
    setStatus(null);
    try {
      await api.put(`/api/access/employees/${empId}/override`, {
        granted: [...granted],
        revoked: [...revoked],
      });
      setStatus("Đã lưu ghi đè nhân viên.");
      await loadEffective(empId);
      const me = await api.get<AuthUser>("/api/auth/me");
      localStorage.setItem("flyvisa_user", JSON.stringify(me.data));
      onSelfPermissionsUpdated?.(me.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setStatus(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const resetOverride = async () => {
    if (!empId || !window.confirm("Xóa ghi đè và trả nhân viên về quyền theo bộ phận (mặc định hệ thống)?"))
      return;
    setBusy(true);
    try {
      await api.delete(`/api/access/employees/${empId}/override`);
      setStatus("Đã reset ghi đè.");
      await loadEffective(empId);
    } catch {
      setStatus("Reset thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        <button
          type="button"
          onClick={() => setSubTab("department")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            subTab === "department" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Theo bộ phận
        </button>
        <button
          type="button"
          onClick={() => setSubTab("employee")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            subTab === "employee" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Theo nhân viên
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.includes("thất bại") || status.includes("Không") ? "text-red-600" : "text-emerald-600"}`}>
          {status}
        </p>
      )}

      {subTab === "department" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Ma trận theo <span className="font-medium text-gray-800">bộ phận</span> (danh mục HR): mọi nhân viên
            trong cùng bộ phận dùng chung tập quyền này, trừ khi có ghi đè ở tab «Theo nhân viên».{" "}
            <span className="font-medium text-gray-800">Vai trò / chức danh</span> trên hồ sơ NV là phần riêng (HR),
            không còn làm khóa ma trận. Ô trống sau khi lưu = hệ thống dùng mặc định (legacy). Dùng{" "}
            <span className="font-medium text-gray-800">mẫu nhanh</span>,{" "}
            <span className="font-medium text-gray-800">sao chép từ bộ phận khác</span> hoặc{" "}
            <span className="font-medium text-gray-800">tìm kiếm</span> để chỉnh nhanh.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-md">
              <input
                type="search"
                value={permFilter}
                onChange={(e) => setPermFilter(e.target.value)}
                placeholder="Tìm theo tên quyền…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                autoComplete="off"
              />
            </div>
            {permFilter.trim() ? (
              <button
                type="button"
                onClick={() => setPermFilter("")}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 shrink-0 self-start sm:self-auto"
              >
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
          <div className="max-h-[520px] overflow-y-auto space-y-3 pr-1">
            {matrix.map((row) => {
              const selected = deptEdits[row.departmentId]?.size ?? 0;
              const total = catalog.length;
              const isOpen = openDepts[row.departmentId] !== false;
              const otherDepts = matrix.filter((m) => m.departmentId !== row.departmentId);
              return (
                <section
                  key={row.departmentId}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white px-3 py-2.5 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setOpenDepts((p) => ({ ...p, [row.departmentId]: !isOpen }))}
                      className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-lg -m-1 p-1 hover:bg-white/80 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-gray-400 text-xs w-4 shrink-0 select-none" aria-hidden>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{row.departmentName}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Đã chọn <span className="font-medium text-gray-700">{selected}</span> / {total} quyền trong
                          catalog
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pl-2">
                      <select
                        disabled={busy || catalog.length === 0}
                        className="text-xs font-medium rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-700 max-w-[11rem] disabled:opacity-50"
                        aria-label={`Mẫu nhanh cho ${row.departmentName}`}
                        value=""
                        onChange={(e) => {
                          const v = e.target.value as DeptPreset | "";
                          if (!v) return;
                          setDeptPermSet(row.departmentId, applyDeptPreset(v, catalog, allCatalogIds));
                          e.target.value = "";
                        }}
                      >
                        <option value="">Mẫu nhanh…</option>
                        <option value="full">Đủ mọi quyền (catalog)</option>
                        <option value="nav_hr">Menu + Nhân sự &amp; lương</option>
                        <option value="nav_only">Chỉ menu &amp; màn hình</option>
                        <option value="clear">Không gán (mặc định HT)</option>
                      </select>
                      <select
                        disabled={busy || otherDepts.length === 0}
                        className="text-xs font-medium rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-700 max-w-[11rem] disabled:opacity-50"
                        aria-label={`Sao chép quyền từ bộ phận khác sang ${row.departmentName}`}
                        value=""
                        onChange={(e) => {
                          const src = e.target.value;
                          if (src) copyPermissionsFromDept(row.departmentId, src);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Sao chép từ…</option>
                        {otherDepts.map((m) => (
                          <option key={m.departmentId} value={m.departmentId}>
                            {m.departmentName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || catalog.length === 0}
                        onClick={() => selectAllForDept(row.departmentId)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => clearAllForDept(row.departmentId)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Bỏ hết
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="p-3 sm:p-4 space-y-4">
                      {catalogByGroupFiltered.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">Không có quyền khớp bộ lọc.</p>
                      ) : (
                        catalogByGroupFiltered.map(([group, items]) => (
                          <div key={group}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold tracking-wide text-gray-600">
                                {catalogGroupLabel(group)}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => mergeGroupIntoDept(row.departmentId, items)}
                                  className="text-xs font-medium text-orange-600 hover:text-orange-800 hover:underline disabled:opacity-50"
                                >
                                  Chọn nhóm
                                </button>
                                <span className="text-gray-300 select-none" aria-hidden>
                                  ·
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeGroupFromDept(row.departmentId, items)}
                                  className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
                                >
                                  Bỏ nhóm
                                </button>
                              </div>
                            </div>
                            <div className="rounded-lg border border-gray-100 overflow-hidden">
                              <table className="w-full text-sm border-collapse">
                                <tbody>
                                  {items.map((item) => {
                                    const checked = deptEdits[row.departmentId]?.has(item.id) ?? false;
                                    const rid = `rbac-dept-${row.departmentId}-${item.id}`;
                                    return (
                                      <tr
                                        key={item.id}
                                        className="border-b border-gray-50 last:border-0 hover:bg-orange-50/30"
                                      >
                                        <td colSpan={2} className="px-3 py-2">
                                          <label htmlFor={rid} className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                              id={rid}
                                              type="checkbox"
                                              className="mt-0.5 rounded border-gray-300 shrink-0"
                                              checked={checked}
                                              title={item.id}
                                              onChange={() => toggleDeptPerm(row.departmentId, item.id)}
                                            />
                                            <span className="text-gray-800 leading-snug">{item.label}</span>
                                          </label>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={saveMatrix}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 px-6 rounded-lg text-sm"
          >
            {busy ? "Đang lưu…" : "Lưu ma trận bộ phận"}
          </button>
        </div>
      )}

      {subTab === "employee" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn nhân viên</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={empId}
              onChange={(e) => {
                const id = e.target.value;
                setEmpId(id);
                if (id) void loadEffective(id);
                else setEffectiveData(null);
              }}
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode}) — {e.department || "Chưa gán BP"} · {e.role}
                </option>
              ))}
            </select>
          </div>

          {effectiveData && (
            <>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold">Bộ phận:</span>{" "}
                  {effectiveData.department || "Chưa gán"}
                </p>
                <p>
                  <span className="font-semibold">Vai trò (HR):</span> {effectiveData.role}
                </p>
                <p>
                  <span className="font-semibold">Quyền hiệu lực:</span>{" "}
                  {effectiveData.effective.length} mục
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="search"
                  value={overridePermFilter}
                  onChange={(e) => setOverridePermFilter(e.target.value)}
                  placeholder="Tìm quyền khi ghi đè…"
                  className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                  autoComplete="off"
                />
                {overridePermFilter.trim() ? (
                  <button
                    type="button"
                    onClick={() => setOverridePermFilter("")}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 shrink-0"
                  >
                    Xóa bộ lọc
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h5 className="font-semibold text-gray-800 text-sm">Bổ sung quyền riêng</h5>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy || catalog.length === 0}
                        onClick={() => setGranted(new Set(catalog.map((c) => c.id)))}
                        className="text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-gray-300 text-xs" aria-hidden>
                        |
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setGranted(new Set())}
                        className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50"
                      >
                        Bỏ hết
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg">
                    {filteredOverrideCatalog.length === 0 ? (
                      <p className="text-xs text-gray-500 p-3">Không khớp bộ lọc.</p>
                    ) : (
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {filteredOverrideCatalog.map((item) => {
                            const gid = `rbac-gr-${item.id}`;
                            return (
                              <tr key={`g-${item.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80">
                                <td colSpan={2} className="px-2 py-1.5">
                                  <label htmlFor={gid} className="flex items-center gap-2 cursor-pointer text-gray-800">
                                    <input
                                      id={gid}
                                      type="checkbox"
                                      className="rounded border-gray-300 shrink-0"
                                      checked={granted.has(item.id)}
                                      title={item.id}
                                      onChange={() => toggle(granted, item.id, setGranted)}
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h5 className="font-semibold text-gray-800 text-sm">Thu hồi so với mặc định bộ phận</h5>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRevoked(new Set())}
                      className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50"
                    >
                      Bỏ hết thu hồi
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg">
                    {filteredOverrideCatalog.length === 0 ? (
                      <p className="text-xs text-gray-500 p-3">Không khớp bộ lọc.</p>
                    ) : (
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {filteredOverrideCatalog.map((item) => {
                            const rid = `rbac-rv-${item.id}`;
                            return (
                              <tr key={`r-${item.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80">
                                <td colSpan={2} className="px-2 py-1.5">
                                  <label htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-gray-800">
                                    <input
                                      id={rid}
                                      type="checkbox"
                                      className="rounded border-gray-300 shrink-0"
                                      checked={revoked.has(item.id)}
                                      title={item.id}
                                      onChange={() => toggle(revoked, item.id, setRevoked)}
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveOverride}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  Lưu ghi đè
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetOverride}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  Reset về bộ phận
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RbacSettingsPanel;
