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

      // 2. Fetch the active session from Supabase to prevent localStorage spoofing
      // Wait a brief moment to let Supabase Auth restore the session from localStorage on page refresh
      let session = null;
      for (let i = 0; i < 8; i++) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          session = currentSession;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      let superAdminDetected = false;
      let regularUserFound = false;
      let isIntegrationUser = false;
      let superAdminProfile = null;
      let profileData = null;

      if (session?.user) {
        // Fetch real profile from the database
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          profileData = profile;
          if (profile.role === "super_admin" || session.user.email?.toLowerCase().trim() === "minkojunior400@gmail.com") {
            superAdminDetected = true;
            superAdminProfile = profile;
          } else {
            regularUserFound = true;
            isIntegrationUser = !!profile.role?.toLowerCase().startsWith("integration_");
          }
        }
      }

      // 3. Clear spoofed super admin flag if backend session is invalid or not super_admin
      const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true";
      if (isLocalSuperAdmin && !superAdminDetected) {
        localStorage.removeItem("is_super_admin");
        window.location.href = "/login";
        return;
      }

      // Synchronize poimen_user_info if logged in
      if (session?.user && profileData) {
        const infoObj = {
          id: profileData.id,
          email: profileData.email,
          role: profileData.role,
          firstName: profileData.display_name?.split(' ')[0] || '',
          lastName: profileData.display_name?.split(' ').slice(1).join(' ') || '',
          church_id: profileData.church_id,
          bergerie_id: profileData.bergerie_id
        };
        localStorage.setItem("poimen_user_info", JSON.stringify(infoObj));

        if (superAdminDetected) {
          localStorage.setItem("is_super_admin", "true");
        }

        if (profileData.bergerie_id && !localStorage.getItem("selected_family")) {
          // Recover selected_family
          const { data: family } = await supabase
            .from("bergeries")
            .select("*")
            .eq("id", profileData.bergerie_id)
            .maybeSingle();
          if (family) {
            localStorage.setItem("selected_family", JSON.stringify(family));
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
