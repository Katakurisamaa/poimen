export type QuickAttendanceStatus = "unpointed" | "present" | "justified" | "unjustified";
export type AttendanceMap = Record<string, Record<string, any>>;

export function getAttendanceStatus(attendance: AttendanceMap | null | undefined, activityId: string, date: string): QuickAttendanceStatus {
  if (attendance?.[activityId]?.[date]) return "present";
  const explicit = attendance?._attendance_status?.[activityId]?.[date];
  if (explicit === "present" || explicit === "justified" || explicit === "unjustified" || explicit === "unpointed") return explicit;
  if (attendance?._comments?.[activityId]?.[date]) return "justified";
  return "unpointed";
}

export function buildAttendanceUpdate(
  attendance: AttendanceMap | null | undefined,
  activityId: string,
  date: string,
  status: QuickAttendanceStatus,
  reason = "",
  service?: string
): AttendanceMap {
  const previous = attendance || {};
  const activityAttendance = previous[activityId] || {};
  const statusRoot = previous._attendance_status || {};
  const activityStatuses = statusRoot[activityId] || {};
  const commentsRoot = previous._comments || {};
  const activityComments = commentsRoot[activityId] || {};
  const nextComments = { ...activityComments };

  if (status === "justified" && reason.trim()) nextComments[date] = reason.trim();
  else delete nextComments[date];

  return {
    ...previous,
    [activityId]: {
      ...activityAttendance,
      [date]: status === "present" ? (service || true) : false,
    },
    _attendance_status: {
      ...statusRoot,
      [activityId]: { ...activityStatuses, [date]: status },
    },
    _comments: {
      ...commentsRoot,
      [activityId]: nextComments,
    },
  };
}

export function usesExplicitAttendance(attendance: AttendanceMap | null | undefined, activityIds: string[], date: string): boolean {
  return activityIds.some(activityId => Boolean(attendance?._attendance_status?.[activityId]?.[date]));
}
