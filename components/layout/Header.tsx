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

  const isIntegration = userRole?.toLowerCase().startsWith("integration_");

  if (isAdmin || (!hasFamily && !isIntegration)) return null; 

  const headerCategory = isIntegration ? "Département de l'Intégration" : "Famille de disciple";
  const headerTitle = isIntegration ? "Suivi & Intégration" : currentFamilyName;

  return (
    <header className="top-header">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Mobile menu button */}
        <button onClick={onMenuClick} className="btn-icon" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "none" }} id="mobile-menu-btn">
          <Menu size={20} />
        </button>
        <div>
          <div style={{ fontSize: 9, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700, opacity: 0.8 }}>
            {headerCategory}
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--cream)", margin: 0, letterSpacing: "0.01em" }}>
            {headerTitle}
          </h1>
        </div>
      </div>


    </header>
  );
}
