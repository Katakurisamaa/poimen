"use client";

import { Menu, Plus, CalendarPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

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

  if (isAdmin || !hasFamily) return null; 

  return (
    <header className="top-header">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Mobile menu button */}
        <button onClick={onMenuClick} className="btn-icon" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "none" }} id="mobile-menu-btn">
          <Menu size={20} />
        </button>
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 2 }}>
            Famille de disciple
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--cream)", margin: 0 }}>
            {currentFamilyName}
          </h1>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(userRole === "Berger" || userRole === "Second du berger" || userRole === "berger" || userRole === "second") && (
          <button className="btn btn-ghost btn-sm hide-mobile">
            <Plus size={14} /> Membre
          </button>
        )}
        <button className="btn btn-primary btn-sm">
          <CalendarPlus size={14} /> <span className="hide-mobile">Activité</span>
        </button>
      </div>
    </header>
  );
}
