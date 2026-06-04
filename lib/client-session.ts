import { contextToUserInfo, type UserContextRecord } from "@/lib/auth-contexts";

export function readJsonStorage<T = any>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function getActiveContext() {
  return readJsonStorage<UserContextRecord>("poimen_active_context");
}

export function getActiveUserInfo() {
  const context = getActiveContext();
  if (context) return contextToUserInfo(context);
  return readJsonStorage("poimen_user_info");
}

export function getActiveSpaceType() {
  const context = getActiveContext();
  if (!context) return "hub";
  if (context.context_type === "integration") return "integration";
  if (context.context_type === "family") return "family";
  if (context.context_type === "super_admin") return "admin";
  return "hub";
}

export function clearActiveSpace() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("poimen_active_context");
  window.localStorage.removeItem("poimen_user_info");
  window.localStorage.removeItem("selected_family");
  window.localStorage.removeItem("is_super_admin");
}

export function broadcastSessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("poimen-session-change"));
  window.dispatchEvent(new Event("storage"));
}
