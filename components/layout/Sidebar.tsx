"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-contexts";
import {
  LayoutDashboard, Users, UserPlus, CalendarDays, Target,
  AlertTriangle, FileText, ChevronLeft, LogOut,
  Menu, X, ShieldCheck, Church, Globe, LayoutGrid, User
} from "lucide-react";

const NAV = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Bergerie", href: "/dashboard/bergerie", icon: Users },
  { label: "Invités", href: "/dashboard/invites", icon: UserPlus },
  { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
  { label: "Activités", href: "/dashboard/activities", icon: CalendarDays },
];

const ADMIN_NAV = [
  { label: "Écosystème", href: "/dashboard/admin?tab=ecosystem", tab: "ecosystem", icon: ShieldCheck },
  { label: "Églises", href: "/dashboard/admin?tab=churches", tab: "churches", icon: Church },
  { label: "Approbations", href: "/dashboard/admin?tab=approvals", tab: "approvals", icon: Globe },
];

const MOBILE_TABS = NAV.slice(0, 5); // 5 tabs max on mobile

export default function Sidebar(props: any) {
  return (
    <Suspense fallback={null}>
      <SidebarContent {...props} />
    </Suspense>
  );
}

function SidebarContent({ onToggleMobile, mobileOpen }: { onToggleMobile?: () => void; mobileOpen?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  
  const isAdmin = pathname.startsWith("/dashboard/admin");
  const [churchName, setChurchName] = useState("Poimén");
  const [hasFamily, setHasFamily] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  const currentNav = (isAdmin || isSuperAdmin) ? ADMIN_NAV : (hasFamily ? NAV : []);

  useEffect(() => {
    const checkState = () => {
      const savedChurch = localStorage.getItem("selected_church");
      if (savedChurch) {
        setChurchName(JSON.parse(savedChurch).name);
      }
      
      const savedFamily = localStorage.getItem("selected_family");
      setHasFamily(!!savedFamily);

      const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true";
      let superAdminDetected = false;

      const user = localStorage.getItem("poimen_user");
      if (user) {
        try {
          const profile = JSON.parse(user);
          if ((profile.role === 'super_admin' || profile.email === SUPER_ADMIN_EMAIL) && isLocalSuperAdmin) {
            superAdminDetected = true;
          }
        } catch (e) {}
      }

      const info = localStorage.getItem("poimen_user_info");
      if (info) {
        try {
          const parsedInfo = JSON.parse(info);
          setUserInfo(parsedInfo);
          if ((parsedInfo.role === 'super_admin' || parsedInfo.email === SUPER_ADMIN_EMAIL) && isLocalSuperAdmin) {
            superAdminDetected = true;
          }
        } catch (e) {}
      }
      setIsSuperAdmin(superAdminDetected);
    };

    checkState();
    window.addEventListener("storage", checkState);
    return () => window.removeEventListener("storage", checkState);
  }, []);

  const isIntegration = userInfo?.role?.toLowerCase().startsWith("integration_");
  
  if (!isAdmin && !hasFamily && !isSuperAdmin && !isIntegration) return null;

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "26px 22px 20px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/" style={{ textDecoration: "none" }}>
              <div style={{ 
                fontFamily: "var(--font-display)", 
                fontSize: 26, 
                fontWeight: 800, 
                background: "linear-gradient(135deg, #FFF6D6 0%, #D4AF37 60%, #AA771C 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.01em",
                cursor: "pointer"
              }}>
                Poimén
              </div>
            </Link>
            <div style={{ fontSize: 9, color: "var(--gold-light)", letterSpacing: 2.5, marginTop: 4, textTransform: "uppercase", fontWeight: 700, opacity: 0.8 }}>
              {isAdmin ? "ADMINISTRATION" : churchName}
            </div>
          </div>
          {/* Close on mobile */}
          <button onClick={onToggleMobile} className="btn-icon" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "none" }} id="sidebar-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 0", overflowY: "auto" }}>
          {(() => {
            const userRole = (userInfo?.role || "").toLowerCase().trim();
            const isBergerOrSecond = userRole.includes("berger") || userRole.includes("second");
            const isConseiller = userInfo?.isConseiller === true || userRole === "integration_conseiller" || userRole === "conseiller";
            const isResponsable = userRole.includes("responsable") || userRole === "integration_responsable" || userRole === "integration_second";

            // Conseiller + Berger/Second → full access
            // Conseiller + Responsable → Invités (lecture) + Affectations + Profil
            // Conseiller seul → Invités (lecture) + Profil
            // Responsable/Brebi/Autre → Affectations + Profil

            let navItems: any[];

            if (isAdmin || isSuperAdmin) {
              navItems = [...currentNav, { label: "Profil", href: "/dashboard/profil", icon: User }];
            } else if (userRole === "integration_responsable" || userRole === "integration_second") {
              navItems = [
                { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
                { label: "Équipe", href: "/dashboard/equipe", icon: Users },
                { label: "Invités", href: "/dashboard/invites", icon: UserPlus },
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Évangélisation", href: "/dashboard/evangelisation", icon: Globe },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (userRole === "integration_conseiller") {
              navItems = [
                { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter un Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Évangélisation", href: "/dashboard/evangelisation", icon: Globe },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (isBergerOrSecond) {
              navItems = [
                ...currentNav.slice(0, 4),
                { label: "Évangélisation", href: "/dashboard/evangelisation", icon: Globe },
                ...currentNav.slice(4),
                { label: "Profil", href: "/dashboard/profil", icon: User }
              ];
            } else if (isConseiller && isResponsable) {
              navItems = [
                { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter un Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Évangélisation", href: "/dashboard/evangelisation", icon: Globe },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (isConseiller) {
              navItems = [
                { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter un Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (userRole.includes("responsable")) {
              // Responsable de brebis dans la bergerie (a accès à l'onglet personnalisé)
              navItems = [
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Évangélisation", href: "/dashboard/evangelisation", icon: Globe },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else {
              // Brebi / Autre
              navItems = [
                { label: "Mes Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            }

            return navItems.map((item: any) => {
              const Icon = item.icon;
              let active = false;

              if (item.tab) {
                if (item.tab === "ecosystem") {
                  active = !currentTab || currentTab === "ecosystem";
                } else {
                  active = currentTab === item.tab;
                }
              } else {
                active = pathname === item.href;
              }

              return (
                <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`} onClick={onToggleMobile}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            });
          })()}
        </nav>

        {/* User - Only show if Admin, Has Family, or Integration */}
        {(isAdmin || isSuperAdmin || hasFamily || isIntegration) && (
          <div style={{ 
            padding: "16px 20px", 
            borderTop: "1px solid rgba(212, 175, 55, 0.15)", 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            background: "linear-gradient(180deg, rgba(212, 175, 55, 0.02) 0%, rgba(139, 92, 246, 0.01) 100%)" 
          }}>
            {(() => {
              const avatarUrl = userInfo?.avatarUrl || "";
              const effect = avatarUrl.startsWith("effect:") ? avatarUrl.replace("effect:", "") : null;
              const effectClass = effect ? `avatar-effect-${effect}` : "";
              
              return (
                <div className={`avatar avatar-gradient ${effectClass}`} style={{ width: 34, height: 34, fontSize: 11, border: effect ? "2px solid" : "none", boxShadow: "0 0 10px rgba(212, 175, 55, 0.15)" }}>
                  {(isAdmin || isSuperAdmin) ? "SA" : (userInfo?.firstName?.[0] || "") + (userInfo?.lastName?.[0] || "")}
                </div>
              );
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                {(isAdmin || isSuperAdmin) ? "Junior" : (userInfo ? userInfo.firstName : "Utilisateur")}
              </div>
            </div>
            <button 
              onClick={async () => { 
                try {
                  await supabase.auth.signOut();
                } catch (err) {
                  console.error("Error signing out from Supabase:", err);
                }
                
                // Signal logout and redirect immediately to landing page "/" to bypass Layout RLS guards
                localStorage.setItem("poimen_logging_out", "true");
                localStorage.removeItem("poimen_active_context");
                localStorage.removeItem("poimen_user_info");
                localStorage.removeItem("is_super_admin");
                window.location.href = "/";
              }}
              style={{ 
                background: "none", 
                border: "none", 
                color: "var(--muted)", 
                cursor: "pointer", 
                opacity: 0.6,
                transition: "all 0.2s ease" 
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.opacity = "0.6"; }}
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Tab Bar */}
      {(isAdmin || isSuperAdmin || hasFamily || isIntegration) && (
        <nav className="bottom-nav">
          {(() => {
            const userRole = (userInfo?.role || "").toLowerCase().trim();
            const isBergerOrSecond = userRole.includes("berger") || userRole.includes("second");
            const isConseiller = userInfo?.isConseiller === true || userRole === "integration_conseiller" || userRole === "conseiller";
            const isResponsable = userRole.includes("responsable") || userRole === "integration_responsable" || userRole === "integration_second";

            let mobileItems: any[];

            if (isAdmin || isSuperAdmin) {
              mobileItems = [
                ...currentNav,
                { label: "Profil", href: "/dashboard/profil", icon: User }
              ];
            } else if (userRole === "integration_responsable" || userRole === "integration_second") {
              mobileItems = [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Équipe", href: "/dashboard/equipe", icon: Users },
                { label: "Invités", href: "/dashboard/invites", icon: UserPlus },
                { label: "Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
              ];
            } else if (userRole === "integration_conseiller") {
              mobileItems = [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (isBergerOrSecond) {
              mobileItems = [
                ...currentNav,
                { label: "Profil", href: "/dashboard/profil", icon: User }
              ];
            } else if (isConseiller && isResponsable) {
              mobileItems = [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else if (isConseiller) {
              mobileItems = [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ajouter Invité", href: "/dashboard/invites", icon: UserPlus },
                { label: "Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            } else {
              mobileItems = [
                { label: "Affectations", href: "/dashboard/affectation", icon: ShieldCheck },
                { label: "Profil", href: "/dashboard/profil", icon: User },
              ];
            }

            return mobileItems.map((item: any) => {
              const Icon = item.icon;
              let active = false;
              if (item.tab) {
                if (item.tab === "ecosystem") {
                  active = !currentTab || currentTab === "ecosystem";
                } else {
                  active = currentTab === item.tab;
                }
              } else {
                active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              }

              const getShortLabel = (label: string) => {
                if (label === "Tableau de bord") return "Dashboard";
                if (label === "Mes Affectations" || label === "Affectations") return "Affectations";
                if (label === "Ajouter un Invité" || label === "Ajouter Invité" || label === "Invités") return "Invités";
                return label;
              };

              return (
                <Link key={item.href} href={item.href} className={`tab ${active ? "active" : ""}`}>
                  <Icon size={20} />
                  <span>{getShortLabel(item.label)}</span>
                </Link>
              );
            });
          })()}
        </nav>
      )}
    </>
  );
}
