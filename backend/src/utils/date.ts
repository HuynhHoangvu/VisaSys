export const getVnDateTime = (date: Date = new Date()) => {
  const timeZone = "Asia/Ho_Chi_Minh";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const p = parts.reduce(
    (acc, part) => ({ ...acc, [part.type]: part.value }),
    {} as Record<string, string>,
  );

  return {
    isoDate: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10) % 24,
    minute: parseInt(p.minute, 10),
    dateStr: date.toLocaleDateString("vi-VN", { timeZone }),
    timeStr: date.toLocaleTimeString("vi-VN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};
