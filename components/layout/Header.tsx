"use client";

import { Menu, Plus, CalendarPlus, Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  bergerieName?: string;
  onMenuClick?: () => void;
}

export default function Header({ bergerieName = "Famille Alpha", onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/dashboard/admin");
  const [hasFamily, setHasFamily] = useState(false);
  const [currentFamilyName, setCurrentFamilyName] = useState(bergerieName);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkState = () => {
      const savedFamily = localStorage.getItem("selected_family");
      setHasFamily(!!savedFamily);
      if (savedFamily) {
        setCurrentFamilyName(JSON.parse(savedFamily).name);
      }

      const userInfo = localStorage.getItem("poimen_user_info");
      if (userInfo) {
        setUserRole(JSON.parse(userInfo).role);
      }
    };

    checkState();
    window.addEventListener("storage", checkState);
    return () => window.removeEventListener("storage", checkState);
  }, []);

  const isIntegration = userRole?.toLowerCase().startsWith("integration_");
  const isSuperAdmin = userRole === "super_admin" || userRole === "admin";
  const shouldShowHeader = isAdmin || isSuperAdmin || hasFamily || isIntegration;

  if (!shouldShowHeader) return null; 

  let headerCategory = "Famille de disciple";
  let headerTitle = currentFamilyName;

  if (isAdmin || isSuperAdmin) {
    headerCategory = "Administration Centrale";
    headerTitle = "Console de Gestion";
  } else if (isIntegration) {
    headerCategory = "Département de l'Intégration";
    headerTitle = "Suivi & Intégration";
  }

  return (
    <header className="top-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        {/* Mobile menu button */}
        <button onClick={onMenuClick} className="btn-icon" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "none", flexShrink: 0 }} id="mobile-menu-btn">
          <Menu size={20} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "clamp(8px, 1.2vw, 9px)", color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {headerCategory}
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(14px, 2vw, 19px)", fontWeight: 700, color: "var(--cream)", margin: 0, letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {headerTitle}
          </h1>
      </div>
    </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexShrink: 0 }}>
        {!isSuperAdmin && !isAdmin && (
          <a 
            href="/dashboard" 
            onClick={(e) => {
              e.preventDefault();
              localStorage.setItem("poimen_space_exited", "true");
              localStorage.removeItem("selected_family");
              localStorage.removeItem("poimen_user_info");
              localStorage.removeItem("poimen_active_context");
              window.dispatchEvent(new Event("storage"));
              window.location.href = "/dashboard";
            }}
            className="btn btn-outline btn-sm" 
            style={{ 
              borderColor: "rgba(212, 175, 55, 0.3)", 
              color: "var(--gold)", 
              display: "flex", 
              alignItems: "center", 
              gap: 6,
              height: 32,
              padding: "0 12px",
              fontSize: 11,
              fontWeight: 600,
              textDecoration: "none",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            <Home size={13} />
            <span className="desktop-only">Quitter</span>
          </a>
        )}
      </div>
    </header>
  );
}
