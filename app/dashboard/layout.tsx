"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SUPER_ADMIN_EMAIL, contextToUserInfo } from "@/lib/auth-contexts";

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
      const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true";

      // 1. Check if selected_church is set, unless the user is opening the admin console.
      const selectedChurch = localStorage.getItem("selected_church");
      if (!selectedChurch && !isLocalSuperAdmin) {
        window.location.href = "/";
        return;
      }

      // 2. Fetch the active session from Supabase to prevent localStorage spoofing
      // Wait up to 2s for Supabase Auth to restore the session from its own storage on page refresh
      let session = null;
      for (let i = 0; i < 20; i++) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          session = currentSession;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      let superAdminDetected = false;
      let regularUserFound = false;
      let isIntegrationUser = false;
      let superAdminProfile = null;
      let profileData = null;
      const localUserInfoForFallback = localStorage.getItem("poimen_user_info");

      if (session?.user) {
        // Fetch real profile from the database
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          profileData = profile;
          const isEmailAdmin = session.user.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
          if ((profile.role === "super_admin" || isEmailAdmin) && isLocalSuperAdmin) {
            superAdminDetected = true;
            superAdminProfile = profile;
          } else {
            regularUserFound = true;
            isIntegrationUser = !!profile.role?.toLowerCase().startsWith("integration_");
          }
        }
      }

      if (!session?.user && localUserInfoForFallback) {
        try {
          const localProfile = JSON.parse(localUserInfoForFallback);
          regularUserFound = true;
          isIntegrationUser = !!localProfile.role?.toLowerCase().startsWith("integration_");
        } catch {}
      }

      // 3. Clear spoofed super admin flag if backend session is invalid or not super_admin
      if (isLocalSuperAdmin && !superAdminDetected) {
        localStorage.removeItem("is_super_admin");
        window.location.href = "/login";
        return;
      }

      let spaceExited = localStorage.getItem("poimen_space_exited") === "true";

      if (spaceExited) {
        superAdminDetected = false;
        isIntegrationUser = false;
        regularUserFound = false;
      }

      // Synchronize poimen_user_info if logged in
      const activeContextRaw = localStorage.getItem("poimen_active_context");
      let activeContext = null;
      try {
        activeContext = activeContextRaw ? JSON.parse(activeContextRaw) : null;
      } catch {
        localStorage.removeItem("poimen_active_context");
      }
      const activeContextMatchesSession = activeContext?.user_id === session?.user?.id;

      if (session?.user && activeContextMatchesSession && !spaceExited) {
        const infoObj = contextToUserInfo(activeContext);
        localStorage.setItem("poimen_user_info", JSON.stringify(infoObj));

        regularUserFound = activeContext.context_type !== "super_admin";
        isIntegrationUser = activeContext.context_type === "integration";
        superAdminDetected = activeContext.context_type === "super_admin" && isLocalSuperAdmin;

        if (activeContext.context_type === "integration") {
          localStorage.removeItem("selected_family");
        }

        if (activeContext.bergerie_id && !localStorage.getItem("selected_family")) {
          const { data: family } = await supabase
            .from("bergeries")
            .select("*")
            .eq("id", activeContext.bergerie_id)
            .maybeSingle();
          if (family) {
            localStorage.setItem("selected_family", JSON.stringify(family));
          }
        }
      } else if (session?.user && profileData && !spaceExited) {
        const { data: availableContexts } = await supabase
          .from("user_contexts")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("active", true);

        const isPublicDashboard = window.location.pathname === "/dashboard" || window.location.pathname === "/dashboard/";

        if ((availableContexts?.length || 0) > 1) {
          if (!isPublicDashboard) {
            localStorage.removeItem("poimen_user_info");
            localStorage.removeItem("selected_family");
            localStorage.removeItem("is_super_admin");
            window.location.href = "/login";
            return;
          } else {
            localStorage.setItem("poimen_space_exited", "true");
            spaceExited = true;
            superAdminDetected = false;
            isIntegrationUser = false;
            regularUserFound = false;
          }
        } else {
          let userRoleForUI = profileData.role;
          let isConseillerForUI = !!profileData.role?.toLowerCase().startsWith("integration_");

          if (profileData.role === "super_admin" && !isLocalSuperAdmin && profileData.bergerie_id) {
            const { data: member } = await supabase
              .from("members")
              .select("*")
              .eq("email", profileData.email)
              .eq("bergerie_id", profileData.bergerie_id)
              .maybeSingle();
            if (member) {
              userRoleForUI = member.status ? (
                member.status.toLowerCase().trim() === "responsable" || member.status.toLowerCase().trim() === "responsable de brebis" ? "responsable de brebi" :
                member.status.toLowerCase().trim() === "second" || member.status.toLowerCase().trim() === "second du berger" ? "second du berger" :
                member.status.toLowerCase().trim()
              ) : "membre";
              isConseillerForUI = member.is_conseiller;
            }
          }

          const infoObj = {
            id: profileData.id,
            email: profileData.email,
            role: userRoleForUI,
            isConseiller: isConseillerForUI,
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
      }

      // 4. Redirect only if there is truly no active session
      const isPublicDashboard = window.location.pathname === "/dashboard" || window.location.pathname === "/dashboard/";
      const hasSelectedFamily = activeContext?.context_type === "integration" ? false : !!localStorage.getItem("selected_family");
      const localUserInfo = localStorage.getItem("poimen_user_info");
      const hasLocalFamilySession = hasSelectedFamily && !!localUserInfo;
      const hasActiveSession = !!session?.user;

      if (!hasActiveSession && !superAdminDetected && !hasLocalFamilySession) {
        if (!isPublicDashboard) {
          // User has no session and is trying to access a private sub-page.
          // Redirect to /dashboard (family selection) if they had a family, else /login.
          // Note: only do this if we are SURE there is no session (after 2s of retrying).
          if (hasSelectedFamily) {
            window.location.href = "/dashboard";
          } else {
            window.location.href = "/login";
          }
          return;
        }
      }

      // 5. Update local states
      setHasFamily(activeContext?.context_type === "integration" ? false : !!localStorage.getItem("selected_family"));
      setIsSuperAdmin(superAdminDetected);
      setIsIntegration(isIntegrationUser);

      if (superAdminDetected && superAdminProfile && !spaceExited) {
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
