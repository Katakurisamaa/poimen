"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/dashboard/admin");
  const [churchName, setChurchName] = useState("Poimén");
  const [hasFamily, setHasFamily] = useState(false);
  const [isIntegration, setIsIntegration] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      // 1. Check if selected_church is set, if not, send to landing page
      const selectedChurch = localStorage.getItem("selected_church");
      if (!selectedChurch) {
        window.location.href = "/";
        return;
      }

      // 2. Check local storage for super admin or regular user info
      const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true";
      let superAdminDetected = isLocalSuperAdmin;
      let superAdminProfile = isLocalSuperAdmin ? { role: 'super_admin', email: 'minkojunior400@gmail.com' } : null;

      const user = localStorage.getItem("poimen_user");
      if (user) {
        try {
          const profile = JSON.parse(user);
          if (profile.role === 'super_admin' || profile.email === 'minkojunior400@gmail.com') {
            superAdminDetected = true;
            superAdminProfile = profile;
          }
        } catch (e) {}
      }

      const info = localStorage.getItem("poimen_user_info");
      let isIntegrationUser = false;
      let regularUserFound = false;

      if (info) {
        try {
          const parsedInfo = JSON.parse(info);
          if (parsedInfo.role === 'super_admin' || parsedInfo.email === 'minkojunior400@gmail.com') {
            superAdminDetected = true;
            superAdminProfile = parsedInfo;
          } else if (parsedInfo.id) {
            regularUserFound = true;
          }
          isIntegrationUser = !!parsedInfo?.role?.toLowerCase().startsWith("integration_");
        } catch (e) {}
      }

      // 3. If no session info is found in localStorage, try to recover from active Supabase session
      if (!superAdminDetected && !regularUserFound) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Fetch their profile from database
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile) {
            const infoObj = {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              firstName: profile.display_name?.split(' ')[0] || '',
              lastName: profile.display_name?.split(' ').slice(1).join(' ') || '',
              church_id: profile.church_id,
              bergerie_id: profile.bergerie_id
            };
            localStorage.setItem("poimen_user_info", JSON.stringify(infoObj));
            if (profile.bergerie_id) {
              // Also recover selected_family
              const { data: family } = await supabase
                .from("bergeries")
                .select("*")
                .eq("id", profile.bergerie_id)
                .maybeSingle();
              if (family) {
                localStorage.setItem("selected_family", JSON.stringify(family));
              }
            }
            regularUserFound = true;
            isIntegrationUser = !!profile.role?.toLowerCase().startsWith("integration_");
            setHasFamily(!!profile.bergerie_id);
          }
        }
      }

      // 4. Redirect if definitely not logged in and trying to access private sub-pages
      const isPublicDashboard = window.location.pathname === "/dashboard" || window.location.pathname === "/dashboard/";
      if (!isPublicDashboard && !superAdminDetected && !regularUserFound) {
        window.location.href = "/login";
        return;
      }

      // 5. Update local states
      setHasFamily(!!localStorage.getItem("selected_family"));
      setIsSuperAdmin(superAdminDetected);
      setIsIntegration(isIntegrationUser);

      if (superAdminDetected && superAdminProfile) {
        if (window.location.pathname === "/dashboard") {
          window.location.href = "/dashboard/admin";
        }
      }
    };

    verifyAuth();
    
    // Also listen to storage events to keep tabs synced
    const handleStorageChange = () => {
      verifyAuth();
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isFullWidth = !isAdmin && !hasFamily && !isSuperAdmin && !isIntegration;

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
