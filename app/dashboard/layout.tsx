"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/dashboard/admin");
  const [churchName, setChurchName] = useState("Poimén");
  const [hasFamily, setHasFamily] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const checkState = () => {
      setHasFamily(!!localStorage.getItem("selected_family"));
      const user = localStorage.getItem("poimen_user");
      if (user) {
        const profile = JSON.parse(user);
        setIsSuperAdmin(profile.role === 'super_admin' || profile.email === 'minkojunior400@gmail.com');
        if (profile.role === 'super_admin' || profile.email === 'minkojunior400@gmail.com') {
          if (window.location.pathname === "/dashboard") {
            window.location.href = "/dashboard/admin";
          }
        }
      }
    };
    checkState();
    window.addEventListener("storage", checkState);
    return () => window.removeEventListener("storage", checkState);
  }, []);

  const isFullWidth = !isAdmin && !hasFamily && !isSuperAdmin;

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={() => setMobileOpen(false)} />

      <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(false)} />

      <div className={`main-area ${isFullWidth ? "full-width" : ""}`}>
        <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* CSS to show mobile-only elements */}
      <style jsx global>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
          #sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
