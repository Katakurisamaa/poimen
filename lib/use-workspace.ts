"use client";
import { useEffect, useState } from "react";
import { getActiveContext, getActiveUserInfo, readJsonStorage } from "@/lib/client-session";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState({ ready: false, role: "", name: "", churchName: "Poimén", familyName: "", hasFamily: false, isSuperAdmin: false, isConseiller: false, active: false });
  useEffect(() => {
    const refresh = () => {
      const context = getActiveContext();
      const user = getActiveUserInfo();
      const family = readJsonStorage<{ name?: string }>("selected_family");
      const church = readJsonStorage<{ name?: string }>("selected_church");
      const role = user?.role || "";
      const exited = localStorage.getItem("poimen_space_exited") === "true";
      const hasFamily = !exited && context?.context_type !== "integration" && (!!family || context?.context_type === "family");
      const isSuperAdmin = !exited && role === "super_admin" && localStorage.getItem("is_super_admin") === "true";
      setWorkspace({ ready: true, role, name: [user?.firstName, user?.lastName].filter(Boolean).join(" "), churchName: church?.name || "Poimén", familyName: family?.name || "Famille de disciples", hasFamily, isSuperAdmin, isConseiller: !!user?.isConseiller, active: !exited && (hasFamily || isSuperAdmin || role === "admin" || role.startsWith("integration_")) });
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("poimen-session-change", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("poimen-session-change", refresh); };
  }, []);
  return workspace;
}
