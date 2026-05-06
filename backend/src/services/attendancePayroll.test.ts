import assert from "node:assert/strict";
import test from "node:test";
import {
  computeLatePenaltyTotalVnd,
  computeScheduledAbsentDeductionVnd,
  listScheduledWorkDatesInMonth,
  type AttendancePayrollRow,
} from "./attendancePayroll.js";

test("May 2026 — Labour Day excluded from scheduled workdays", () => {
  const dates = listScheduledWorkDatesInMonth(5, 2026, 31);
  assert.ok(!dates.includes("01/05/2026"));
  assert.ok(dates.includes("04/05/2026"));
});

test("deduction for absent scheduled Mon–Fri day without check-in", () => {
  const records: AttendancePayrollRow[] = [];
  const gross = 6_600_000;
  const daily = Math.round(gross / 22);
  const { deductionVnd, absentDays } = computeScheduledAbsentDeductionVnd(
    records,
    gross,
    5,
    2026,
    6,
  );
  const scheduled = listScheduledWorkDatesInMonth(5, 2026, 6);
  assert.equal(scheduled.length, 3);
  assert.equal(absentDays, 3);
  assert.equal(deductionVnd, absentDays * daily);
});

test("late penalty tiers 50k + 100k + 150k for three late arrivals", () => {
  const records: AttendancePayrollRow[] = [
    {
      date: "05/05/2026",
      inTime: "08:30",
      outTime: "-",
      status: "Đi muộn",
    },
    {
      date: "06/05/2026",
      inTime: "08:35",
      outTime: "-",
      status: "Đi muộn",
    },
    {
      date: "07/05/2026",
      inTime: "08:40",
      outTime: "-",
      status: "Đi muộn",
    },
  ];
  const total = computeLatePenaltyTotalVnd(records, 5, 2026);
  assert.equal(total, 50_000 + 100_000 + 150_000);
});

test("check-in sau 12h không vào thang phạt đi muộn (kể cả status legacy Đi muộn)", () => {
  const records: AttendancePayrollRow[] = [
    {
      date: "08/05/2026",
      inTime: "13:15",
      outTime: "-",
      status: "Đi muộn",
      fine: 0,
    },
  ];
  assert.equal(computeLatePenaltyTotalVnd(records, 5, 2026), 0);
});
