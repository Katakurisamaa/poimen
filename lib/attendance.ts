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

export function isCulteActivity(activityId?: string | null, activityName?: string | null): boolean {
  if (!activityId && !activityName) return false;
  const idMatch = activityId === "culte";
  const nameMatch = activityName ? activityName.toLowerCase().includes("culte") : false;
  return idMatch || nameMatch;
}

export function isOnlineAttendance(value: any): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase().trim();
  return v === "en_ligne" || v === "culte_en_ligne" || v === "online";
}

export function isPresentialCulteService(service: any): boolean {
  if (service === true) return true;
  if (typeof service !== "string") return false;
  const s = service.toLowerCase().trim();
  return (
    s === "culte_1" ||
    s === "culte_2" ||
    s === "culte_1_2" ||
    s === "culte_1_et_2" ||
    s === "culte_both" ||
    s === "both"
  );
}

export function isPresentialAttendance(value: any, isCulte: boolean = false): boolean {
  if (!value) return false;
  if (!isCulte) return Boolean(value);
  if (isOnlineAttendance(value)) return false;
  return isPresentialCulteService(value);
}

