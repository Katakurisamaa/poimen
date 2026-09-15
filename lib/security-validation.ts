export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isFamilyLeader(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return ["berger", "coordonnateur", "second", "second du berger", "responsable", "responsable de brebi", "responsable de brebis"]
    .includes(value.trim().toLowerCase().replaceAll("_", " "));
}

export function validTeamInput(value: { churchId?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown }): boolean {
  return isUuid(value.churchId)
    && [value.firstName, value.lastName].every(v => typeof v === "string" && v.trim().length > 0 && v.length <= 100)
    && typeof value.email === "string" && value.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim());
}
