export const SUPER_ADMIN_EMAIL = "minkojunior400@gmail.com";

export type UserContextType = "super_admin" | "family" | "integration";

export type UserContextRecord = {
  id?: string;
  user_id: string;
  email: string;
  context_type: UserContextType;
  role: string;
  church_id?: string | null;
  bergerie_id?: string | null;
  display_name?: string | null;
  active?: boolean | null;
};

export function normalizeFamilyRole(role?: string | null) {
  if (!role) return "membre";

  const normalized = role.toLowerCase().trim();
  if (normalized === "responsable" || normalized === "responsable de brebis") {
    return "responsable de brebi";
  }
  if (normalized === "second" || normalized === "second du berger") {
    return "second du berger";
  }

  return normalized;
}

export function inferContextType(role?: string | null, bergerieId?: string | null): UserContextType {
  const normalized = (role || "").toLowerCase().trim();
  if (normalized === "super_admin") return "super_admin";
  if (normalized.startsWith("integration_")) return "integration";
  if (bergerieId) return "family";
  return "integration";
}

export function splitDisplayName(displayName?: string | null) {
  const parts = (displayName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export function contextToUserInfo(context: UserContextRecord) {
  const { firstName, lastName } = splitDisplayName(context.display_name);
  const role = context.context_type === "family"
    ? normalizeFamilyRole(context.role)
    : context.role;

  return {
    id: context.user_id,
    context_id: context.id || null,
    context_type: context.context_type,
    email: context.email,
    role,
    isConseiller: role.toLowerCase().includes("conseiller"),
    firstName,
    lastName,
    church_id: context.church_id || null,
    bergerie_id: context.bergerie_id || null,
  };
}

export function contextLabel(context: UserContextRecord) {
  if (context.context_type === "super_admin") return "Super admin";
  if (context.context_type === "integration") return "Integration";
  return "Famille de disciples";
}
