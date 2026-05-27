"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, CalendarCheck, AlertTriangle, Target, TrendingUp, TrendingDown, Calendar, Clock, MessageSquare, ChevronRight, Plus, MapPin, Shield, Loader2, CheckCircle2, Clock3, Search, User, Phone, X, UserPlus, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import type { ActivityType } from "@/types";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "@/types";
import { supabase } from "@/lib/supabase";

const STATS = [
  { label: "Membres", value: "0", sub: "Total actifs", trend: "up", color: "var(--gold-light)", icon: Users },
  { label: "Invités", value: "0", sub: "Nouveaux", trend: "up", color: "var(--sky)", icon: UserPlus },
  { label: "Activités", value: "0", sub: "Ce mois", trend: "up", color: "var(--purple)", icon: CalendarDays },
  { label: "Alertes Suivi", value: "0", sub: "Membres à risque", trend: "down", color: "var(--red)", icon: AlertTriangle },
];

const ENGAGEMENT = [
  { label: "Fidélisés (>75%)", pct: 0, color: "var(--green)", count: 0 },
  { label: "En cours (45-75%)", pct: 0, color: "var(--orange)", count: 0 },
  { label: "À risque (<45%)", pct: 0, color: "var(--red)", count: 0 },
];

const ACTIVITIES: { title: string; type: ActivityType; date: string; time: string; upcoming: boolean; attendance?: number }[] = [];

const AT_RISK: any[] = [];

const CHALLENGES: any[] = [];

const OBJECTIVES: any[] = [];

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [church, setChurch] = useState<any>(null);
  const [bergeries, setBergeries] = useState<any[]>([]);
  const [myBergerie, setMyBergerie] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [dateStr, setDateStr] = useState("");
  const [newBergerie, setNewBergerie] = useState({
    name: "",
    creator_role: "Responsable",
    civility: "M.",
    firstName: "",
    lastName: "",
    email: "",
    code: ""
  });

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    
    // Initial data loading
    const info = localStorage.getItem("poimen_user_info");
    if (info) {
      try { setUserInfo(JSON.parse(info)); } catch (e) { console.error("Error parsing user info", e); }
    }
    const fam = localStorage.getItem("selected_family");
    if (fam) {
      try { setMyBergerie(JSON.parse(fam)); } catch (e) { console.error("Error parsing family info", e); }
    }

    init();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForJoin, setSelectedForJoin] = useState<any>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [counts, setCounts] = useState({ members: 0, invites: 0 });
  const [familyStats, setFamilyStats] = useState({
    membersCount: 0,
    invitesCount: 0,
    activitiesCount: 0,
    alertsCount: 0,
    totalReached: 0,
    totalSalvation: 0,
    totalInvitations: 0
  });
  const [activitiesList, setActivitiesList] = useState<any[]>([]);
  const [atRiskList, setAtRiskList] = useState<any[]>([]);

  useEffect(() => {
    if (myBergerie) {
      fetchCounts();
    }
  }, [myBergerie]);

  const fetchCounts = async () => {
    if (!myBergerie) return;
    try {
      const userRoleVal = (userInfo?.role || "").toLowerCase().trim();
      const isOnlyResponsable = userRoleVal === "responsable" || userRoleVal === "responsable_de_brebi";
      const userNameStr = `${userInfo?.firstName} ${userInfo?.lastName}`;

      // Helper function to get recent days of week
      const getDaysOfPeriod = (year: number, month: number, dayOfWeek: number) => {
        const dates = [];
        let start = new Date(year, month, 1);
        let end = new Date(year, month + 1, 0);
        let d = new Date(start);
        while (d <= end) {
          if (d.getDay() === dayOfWeek) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dates.push(`${yyyy}-${mm}-${dd}`);
          }
          d.setDate(d.getDate() + 1);
        }
        return dates;
      };

      // Helper function to get recent activity dates (Sundays/Thursdays)
      const getRecentActivityDates = () => {
        const dates: { id: string; name: string; date: string; day: number; time: string; actId: string }[] = [];
        const today = new Date();
        for (let i = 0; i < 21; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dayOfWeek = d.getDay();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          if (dayOfWeek === 0 && dates.filter(x => x.actId === "culte").length < 2) {
            dates.push({ id: `culte-${dateStr}`, name: `Culte du Dimanche`, date: dateFormatted, day: 0, time: "10:00", actId: "culte" });
          } else if (dayOfWeek === 4 && dates.filter(x => x.actId === "cdm").length < 2) {
            dates.push({ id: `cdm-${dateStr}`, name: `CDM (Cellule Alpha)`, date: dateFormatted, day: 4, time: "19:00", actId: "cdm" });
          }
        }
        return dates.sort((a, b) => b.id.localeCompare(a.id));
      };

      // Helper function to get upcoming activity dates
      const getUpcomingActivityDates = () => {
        const dates: { id: string; name: string; date: string; day: number; time: string; actId: string; upcoming: boolean }[] = [];
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
          const d = new Date();
          d.setDate(today.getDate() + i);
          const dayOfWeek = d.getDay();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          if (dayOfWeek === 0) {
            dates.push({ id: `culte-${dateStr}`, name: `Culte du Dimanche`, date: dateFormatted, day: 0, time: "10:00", actId: "culte", upcoming: true });
          } else if (dayOfWeek === 4) {
            dates.push({ id: `cdm-${dateStr}`, name: `CDM (Cellule Alpha)`, date: dateFormatted, day: 4, time: "19:00", actId: "cdm", upcoming: true });
          }
        }
        return dates;
      };

      // 1. Fetch active members
      let mQuery = supabase.from("members").select("*").eq("bergerie_id", myBergerie.id).eq("archived", false);
      let iQuery = supabase.from("invites").select("*").eq("bergerie_id", myBergerie.id);
      let eQuery = supabase.from("evangelisations").select("*").eq("bergerie_id", myBergerie.id);

      if (isOnlyResponsable) {
        mQuery = mQuery.eq("responsible", userNameStr);
        iQuery = iQuery.eq("responsible", userNameStr);
        eQuery = eQuery.eq("created_by", userInfo?.id || "");
      }

      const { data: members, error: mErr } = await mQuery;
      const { data: invites, error: iErr } = await iQuery;
      const { data: evangs, error: eErr } = await eQuery;

      if (mErr) console.error("Error fetching members:", mErr);
      if (iErr) console.error("Error fetching invites:", iErr);
      if (eErr) console.error("Error fetching evangelisations:", eErr);

      const mCount = members?.length || 0;
      const iCount = invites?.length || 0;

      // 2. Taux d'engagement & alertes
      let fidelised = 0;
      let ongoing = 0;
      let atRiskCount = 0;
      const calculatedAtRisk: any[] = [];
      const calculatedActivities: any[] = [];

      if (members) {
        const familyHasAttendance = members.some(m => Object.keys(m.attendance || {}).length > 0);
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const activeTypes = [
          { id: "culte", day: 0 },
          { id: "cdm", day: 4 }
        ];

        members.forEach(m => {
          let eng = 0;
          if (familyHasAttendance) {
            let totalPossible = 0;
            let totalPresent = 0;
            const attObj = m.attendance || {};

            activeTypes.forEach(act => {
              const dates = getDaysOfPeriod(currentYear, currentMonth, act.day);
              totalPossible += dates.length;
              const actAtt = attObj[act.id] || {};
              dates.forEach(d => {
                if (actAtt[d] === true) {
                  totalPresent++;
                }
              });
            });
            eng = totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);
          } else {
            // Simulated baseline if no data entered yet
            const baseMap: Record<string, number> = {
              "Berger": 90,
              "Second": 85,
              "Responsable": 80,
              "Brebi": 65
            };
            const rawBase = baseMap[m.status] || 65;
            const seed = m.id ? m.id.charCodeAt(0) + m.id.charCodeAt(m.id.length - 1) : 10;
            eng = rawBase + (seed % 15) - 5;
            if (eng > 100) eng = 100;
            if (eng < 0) eng = 0;
          }

          if (eng >= 75) fidelised++;
          else if (eng >= 45) ongoing++;
          else {
            atRiskCount++;
            calculatedAtRisk.push({
              id: m.id,
              name: `${m.first_name} ${m.last_name}`,
              initials: `${m.first_name[0] || ""}${m.last_name[0] || ""}`,
              issue: `Baisse d'engagement (${eng}%) · Suivi recommandé`,
              score: eng
            });
          }
        });

        const total = mCount || 1;
        setEngagementStats([
          { label: "Fidélisés (>75%)", pct: Math.round((fidelised/total)*100), color: "var(--green)", count: fidelised },
          { label: "En cours (45-75%)", pct: Math.round((ongoing/total)*100), color: "var(--orange)", count: ongoing },
          { label: "À risque (<45%)", pct: Math.round((atRiskCount/total)*100), color: "var(--red)", count: atRiskCount },
        ]);

        calculatedAtRisk.sort((a, b) => a.score - b.score);
        setAtRiskList(calculatedAtRisk.slice(0, 4));

        // 3. Dynamic activities with presence rate
        const recentDates = getRecentActivityDates();
        const upcomingDates = getUpcomingActivityDates();

        recentDates.forEach(r => {
          let attendancePct = 0;
          if (familyHasAttendance) {
            let presentCount = 0;
            members.forEach(m => {
              if (m.attendance?.[r.actId]?.[r.id.split("-").slice(1).join("-")] === true) {
                presentCount++;
              }
            });
            attendancePct = mCount > 0 ? Math.round((presentCount / mCount) * 100) : 0;
          } else {
            const seed = r.id.charCodeAt(r.id.length - 1) + r.id.charCodeAt(r.id.length - 2);
            attendancePct = 60 + (seed % 30);
          }

          calculatedActivities.push({
            title: `${r.name} (${r.date})`,
            type: r.actId,
            date: r.date,
            time: r.time,
            upcoming: false,
            attendance: attendancePct
          });
        });

        if (upcomingDates.length > 0) {
          calculatedActivities.unshift({
            title: `${upcomingDates[0].name} (${upcomingDates[0].date})`,
            type: upcomingDates[0].actId,
            date: upcomingDates[0].date,
            time: upcomingDates[0].time,
            upcoming: true
          });
        }

        setActivitiesList(calculatedActivities.slice(0, 4));
      }

      // 4. Moisson d'évangélisation
      let totalReached = 0;
      let totalSalvation = 0;
      let totalInvitations = 0;

      if (evangs) {
        evangs.forEach(e => {
          totalReached += (e.people_count || 0);
          if (e.prayer_salvation) {
            totalSalvation += (e.people_count || 1);
          }
          totalInvitations += (e.invitations_count || 0);
        });
      }

      // 5. Total activities target this month
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      let theoreticalActivitiesCount = 0;
      let dTemp = new Date(currentYear, currentMonth, 1);
      let endTemp = new Date(currentYear, currentMonth + 1, 0);
      while (dTemp <= endTemp) {
        if (dTemp.getDay() === 0 || dTemp.getDay() === 4) {
          theoreticalActivitiesCount++;
        }
        dTemp.setDate(dTemp.getDate() + 1);
      }

      setFamilyStats({
        membersCount: mCount,
        invitesCount: iCount,
        activitiesCount: theoreticalActivitiesCount,
        alertsCount: atRiskCount,
        totalReached,
        totalSalvation,
        totalInvitations
      });
      setCounts({ members: mCount, invites: iCount });

    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    }
  };

  const [engagementStats, setEngagementStats] = useState(ENGAGEMENT);

  const DYNAMIC_STATS = [
    { label: "Membres", value: String(familyStats.membersCount), sub: (userInfo?.role || "").toLowerCase().trim().includes("responsable") ? "Mes affectations" : "Total actifs", trend: "up", color: "var(--gold-light)", icon: Users },
    { label: "Invités", value: String(familyStats.invitesCount), sub: (userInfo?.role || "").toLowerCase().trim().includes("responsable") ? "Mes affectations" : "Nouveaux", trend: "up", color: "var(--sky)", icon: UserPlus },
    { label: "Activités", value: String(familyStats.activitiesCount), sub: "Ce mois", trend: "up", color: "var(--purple)", icon: CalendarDays },
    { label: "Alertes Suivi", value: String(familyStats.alertsCount), sub: "Membres à risque", trend: "down", color: "var(--red)", icon: AlertTriangle },
  ];

  // Pre-fill from saved info
  const savedInfo = typeof window !== "undefined" ? (() => { try { const s = localStorage.getItem("poimen_saved_info"); return s ? JSON.parse(s) : null; } catch { return null; } })() : null;
  const [registration, setRegistration] = useState({
    email: savedInfo?.email ?? "",
    code: savedInfo?.code ?? "",
    role: savedInfo?.role ?? "Responsable"
  });



  useEffect(() => {
    if (isCreating || selectedForJoin) {
      document.documentElement.classList.add("no-scroll");
      document.body.classList.add("no-scroll");
    } else {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    }
    return () => { 
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, [isCreating, selectedForJoin]);

  const init = async () => {
    const savedChurch = localStorage.getItem("selected_church");
    if (!savedChurch) {
      window.location.href = "/";
      return;
    }
    const churchObj = JSON.parse(savedChurch);
    setChurch(churchObj);

    const userStr = localStorage.getItem("poimen_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'super_admin' || user.email === 'minkojunior400@gmail.com') {
        window.location.href = "/dashboard/admin";
        return;
      }
    }

    const { data: activeBgs } = await supabase
      .from("bergeries")
      .select("*")
      .eq("church_id", churchObj.id)
      .eq("status", "active");
    
    if (activeBgs) setBergeries(activeBgs);

    const { data: pending } = await supabase
      .from("bergeries")
      .select("*")
      .eq("church_id", churchObj.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    
    if (pending) setPendingRequest(pending);

    const savedFamily = localStorage.getItem("selected_family");
    if (savedFamily) setMyBergerie(JSON.parse(savedFamily));

    const savedUserInfo = localStorage.getItem("poimen_user_info");
    if (savedUserInfo) setUserInfo(JSON.parse(savedUserInfo));

    setLoading(false);
  };

  const handleCreateRequest = async () => {
    if (!church) return;
    if (!newBergerie.name || !newBergerie.firstName || !newBergerie.lastName || !newBergerie.email || !newBergerie.code) {
      alert("Veuillez remplir tous les champs (Nom famille, Prénom, Nom, Email, Code).");
      return;
    }
    setLoading(true);
    const dbRole = newBergerie.creator_role === "Second du berger" ? "Second" : 
                   newBergerie.creator_role === "Responsable de brebi" ? "Responsable" : 
                   newBergerie.creator_role;

    const { data: newBg, error } = await supabase
      .from("bergeries")
      .insert({
        church_id: church.id,
        name: newBergerie.name,
        creator_email: newBergerie.email.toLowerCase().trim(),
        access_code: newBergerie.code,
        creator_first_name: newBergerie.firstName,
        creator_last_name: newBergerie.lastName,
        creator_civility: newBergerie.civility,
        creator_role: dbRole,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      alert("Erreur lors de la création : " + error.message);
    } else {
      setPendingRequest(newBg);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          bergerie_id: newBg.id,
          role: dbRole,
          display_name: `${newBergerie.firstName} ${newBergerie.lastName}`
        }).eq("id", user.id);
      }

      const info = {
        civility: newBergerie.civility,
        firstName: newBergerie.firstName,
        lastName: newBergerie.lastName,
        email: newBergerie.email,
        role: newBergerie.creator_role
      };
      localStorage.setItem("poimen_user_info", JSON.stringify(info));
      setUserInfo(info);
      alert("Demande envoyée ! Un administrateur doit approuver votre famille avant de pouvoir y accéder.");
    }
    setIsCreating(false);
    setLoading(false);
  };

  const selectFamily = (family: any) => {
    setSelectedForJoin(family);
  };

  const confirmJoin = async () => {
    if (!registration.email || !registration.code) {
      alert("Veuillez remplir votre e-mail et votre code d'accès.");
      return;
    }
    if (!selectedForJoin) return;

    setLoading(true);
    const email = registration.email.toLowerCase().trim();

    // 1. Check if family code is correct
    const { data: family, error: famErr } = await supabase
      .from("bergeries")
      .select("*")
      .eq("id", selectedForJoin.id)
      .eq("access_code", registration.code)
      .maybeSingle();

    if (famErr || !family) {
      alert("Code d'accès incorrect pour cette famille.");
      setLoading(false);
      return;
    }

    // 2. Identify the user and their role
    let finalRole = "";
    let finalInfo = null;

    if (family.creator_email?.toLowerCase() === email) {
      // It's the creator — also check if they are a conseiller
      const { data: creatorMember } = await supabase
        .from("members")
        .select("is_conseiller")
        .eq("bergerie_id", family.id)
        .eq("email", email)
        .maybeSingle();

      finalRole = family.creator_role;
      finalInfo = {
        civility: family.creator_civility,
        firstName: family.creator_first_name,
        lastName: family.creator_last_name,
        email: family.creator_email,
        role: family.creator_role,
        isConseiller: creatorMember?.is_conseiller === true
      };
    } else {
      // Check if it's an authorized leader in the members table
      const { data: member, error: memErr } = await supabase
        .from("members")
        .select("*")
        .eq("bergerie_id", family.id)
        .eq("email", email)
        .maybeSingle();

      if (memErr || !member) {
        alert("Accès refusé : vous n'êtes pas enregistré comme leader dans cette famille.");
        setLoading(false);
        return;
      }

      // If the user is a conseiller, they get the 'Conseiller' role (unless they are already a leader)
      const allowedRoles = ["Berger", "Second", "Responsable"];
      const isConseiller = member.is_conseiller === true;

      if (!allowedRoles.includes(member.status) && !isConseiller) {
        alert("Accès refusé : seul les leaders et conseillers peuvent se connecter.");
        setLoading(false);
        return;
      }

      // If they are a leader (Berger/Second/Responsable), keep that role. 
      // Otherwise, if they are a conseiller, give them the 'Conseiller' role.
      finalRole = allowedRoles.includes(member.status) ? member.status : (isConseiller ? "Conseiller" : member.status);
      
      finalInfo = {
        civility: member.civility,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        role: finalRole,
        isConseiller: isConseiller
      };
    }

    // 3. Update Profile & Local State
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user) {
      await supabase
        .from("profiles")
        .update({ 
          bergerie_id: family.id, 
          role: finalRole 
        })
        .eq("id", authUser.user.id);
    }

    if (rememberMe) {
      localStorage.setItem("poimen_saved_info", JSON.stringify({ email, code: registration.code, role: finalRole }));
    } else {
      localStorage.removeItem("poimen_saved_info");
    }

    localStorage.setItem("poimen_user_info", JSON.stringify(finalInfo));
    localStorage.setItem("selected_family", JSON.stringify(family));
    
    setMyBergerie(family);
    setUserInfo(finalInfo);
    window.dispatchEvent(new Event("storage"));
    setSelectedForJoin(null);
    setLoading(false);
    
    alert(`Bienvenue ${finalInfo.firstName} ! Connexion réussie en tant que ${finalRole}.`);
  };

  const filteredBergeries = bergeries.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !church) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Loader2 className="animate-spin" style={{ color: "var(--gold)" }} size={36} />
      </div>
    );
  }

  if (!myBergerie) {
    return (
      <>
        {/* Background ambient sacred lights */}
        <div style={{ position: "fixed", top: "5%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: "5%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 36, position: "relative", zIndex: 1 }} className="fade-in">
          <div style={{ textAlign: "center", padding: "30px 0 10px" }}>
            <div style={{ fontSize: 11, color: "var(--gold)", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              Bienvenue à {church?.name}
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #FFF, var(--gold-light) 60%, var(--gold) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Espace Communautaire
            </h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, transparent, var(--gold))" }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", border: "1px solid var(--gold)" }} />
              <div style={{ height: 1, width: 40, background: "linear-gradient(270deg, transparent, var(--gold))" }} />
            </div>
            <p style={{ color: "var(--cream-dim)", maxWidth: 620, margin: "16px auto 0", fontSize: "14px", lineHeight: "1.6" }}>
              Rejoignez une Famille de Disciples existante ou demandez la création d&apos;une nouvelle bergerie pour guider le troupeau.
            </p>
          </div>

          <div className="bento bento-2-1">
            <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.2)" }}>
              {/* Header */}
              <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.55)", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ color: "var(--gold)" }}><Users size={18} /></div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cream)", letterSpacing: "0.01em" }}>Familles de Disciples</h3>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, maxWidth: 500 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                    <input type="text" placeholder="Rechercher une famille..." className="input" style={{ paddingLeft: 34, height: 38, fontSize: 12, background: "rgba(10,6,22,0.4)" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ height: 38, whiteSpace: "nowrap" }} onClick={() => setIsCreating(true)}>
                    <Plus size={16} /> <span className="hide-mobile">Nouvelle Famille</span>
                  </button>
                </div>
              </div>

              {/* Grid Content */}
              <div style={{ padding: 28 }}>
                {filteredBergeries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
                    <div style={{ opacity: 0.3, marginBottom: 20 }}><Users size={48} style={{ margin: "0 auto" }} /></div>
                    <p style={{ marginBottom: 20, fontSize: 14 }}>{searchQuery ? "Aucune famille ne correspond à votre recherche." : "Aucune famille n'est encore active dans cette église."}</p>
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> Créer la première famille</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 24 }}>
                    {filteredBergeries.map((b, idx) => (
                      <motion.div 
                        key={b.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: idx * 0.05 }} 
                        whileHover={{ scale: 1.03, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="arch-card" 
                        style={{ 
                          cursor: "pointer", 
                          textAlign: "center", 
                          display: "flex", 
                          flexDirection: "column", 
                          alignItems: "center", 
                          padding: "28px 20px 20px",
                          gap: 16 
                        }} 
                        onClick={() => selectFamily(b)}
                      >
                        {/* Gothic arch gold line decor at top */}
                        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 60, height: 3, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", borderRadius: "0 0 3px 3px" }} />
                        
                        <div style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: "50%", 
                          background: "linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(139,92,246,0.05) 100%)", 
                          border: "1px solid rgba(212, 175, 55, 0.3)",
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          color: "var(--gold-light)",
                          boxShadow: "0 0 15px rgba(212, 175, 55, 0.1)"
                        }}>
                          <Users size={22} />
                        </div>
                        
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--cream)" }}>{b.name}</div>
                          <div style={{ fontSize: 10, color: "var(--gold-light)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, opacity: 0.7 }}>Famille de Disciples</div>
                        </div>
                        
                        <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={(e) => { e.stopPropagation(); selectFamily(b); }}>Rejoindre</button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {pendingRequest && (
                <div className="glass" style={{ border: "1px solid var(--orange)", background: "rgba(245,158,11,0.06)", boxShadow: "0 10px 30px rgba(245,158,11,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <Clock3 style={{ color: "var(--orange)" }} size={18} />
                    <span style={{ fontWeight: 700, color: "var(--cream)", fontSize: 14 }}>Demande en cours d'analyse</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--cream-dim)", margin: 0, lineHeight: 1.5 }}>
                    Votre demande pour la bergerie <strong>{pendingRequest.name}</strong> en tant que <strong>{pendingRequest.creator_role}</strong> est actuellement en attente d'approbation par le Super Admin.
                  </p>
                </div>
              )}
              
              <div className="glass" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--gold-light)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Pourquoi rejoindre une famille ?</h4>
                <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    "Un accompagnement spirituel personnalisé",
                    "Des temps de partage authentiques et fraternels",
                    "Une croissance coordonnée dans la foi",
                    "Soutien pastoral et intercession mutuelle"
                  ].map((t, i) => (
                    <li key={i} style={{ fontSize: 13, display: "flex", alignItems: "flex-start", gap: 10, color: "var(--cream-dim)", lineHeight: 1.4 }}>
                      <CheckCircle2 size={15} style={{ color: "var(--green)", marginTop: 2, flexShrink: 0 }} /> 
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Access Code Connection */}
        {typeof window !== "undefined" && selectedForJoin && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(2,1,6,0.85)", backdropFilter: "blur(12px)" }} onClick={() => setSelectedForJoin(null)} />
            <div className="arch-card" style={{ width: "100%", maxWidth: 420, padding: "40px 36px", position: "relative", zIndex: 101, border: "1.5px solid rgba(212, 175, 55, 0.35)", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(139, 92, 246, 0.15)", display: "flex", flexDirection: "column" }}>
              <button onClick={() => setSelectedForJoin(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", transition: "color 0.2s ease" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}><X size={20} /></button>
              
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--gold-glow)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 12px" }}>
                  <Shield size={20} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Authentification</h3>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Saisissez vos identifiants pour entrer dans la bergerie</p>
              </div>

              <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 8, background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={14} style={{ color: "var(--gold)" }} />
                <span style={{ fontSize: 12, color: "var(--cream)", fontWeight: 600 }}>Famille : <strong>{selectedForJoin.name}</strong></span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Adresse e-mail</label>
                  <input className="input" type="email" placeholder="votre@email.com" value={registration.email} onChange={e => setRegistration({...registration, email: e.target.value})} style={{ height: 42 }} />
                </div>
                <div>
                  <label className="form-label">Code d'accès secret</label>
                  <input className="input" type="password" placeholder="••••••" value={registration.code} onChange={e => setRegistration({...registration, code: e.target.value})} style={{ height: 42, letterSpacing: 3 }} />
                </div>
                
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--muted)", padding: "2px 0 6px" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: "var(--gold)", cursor: "pointer" }}
                  />
                  Se souvenir de moi
                </label>

                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <button className="btn btn-subtle" style={{ flex: 1, height: 44 }} onClick={() => setSelectedForJoin(null)}>Annuler</button>
                  <button className="btn btn-primary" style={{ flex: 1, height: 44, justifyContent: "center" }} onClick={confirmJoin}>S'authentifier</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal: Propose New Family */}
        {typeof window !== "undefined" && isCreating && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(2,1,6,0.85)", backdropFilter: "blur(12px)" }} onClick={() => setIsCreating(false)} />
            <div className="arch-card" style={{ width: "100%", maxWidth: 440, padding: "40px 36px", position: "relative", zIndex: 101, border: "1.5px solid rgba(212, 175, 55, 0.35)", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(139, 92, 246, 0.15)", display: "flex", flexDirection: "column", maxHeight: "90vh", overflowY: "auto" }}>
              <button onClick={() => setIsCreating(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", transition: "color 0.2s ease" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}><X size={20} /></button>
              
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--gold-glow)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 12px" }}>
                  <UserPlus size={20} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Proposer une Bergerie</h3>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Soumis à validation par l'administration centrale</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Nom de la famille</label>
                  <input type="text" placeholder="Ex: Famille Béthanie" className="input" value={newBergerie.name} onChange={e => setNewBergerie({...newBergerie, name: e.target.value})} style={{ height: 40 }} />
                </div>
                <div>
                  <label className="form-label">Civilité du leader</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["M.", "Mme"].map(c => (
                      <button key={c} type="button" className={`btn btn-sm ${newBergerie.civility === c ? "btn-primary" : "btn-subtle"}`} onClick={() => setNewBergerie({...newBergerie, civility: c})} style={{ flex: 1, height: 36 }}>{c}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Prénom</label>
                    <input className="input" placeholder="Ex: Pierre" value={newBergerie.firstName} onChange={e => setNewBergerie({...newBergerie, firstName: e.target.value})} style={{ height: 40 }} />
                  </div>
                  <div>
                    <label className="form-label">Nom</label>
                    <input className="input" placeholder="Ex: Kael" value={newBergerie.lastName} onChange={e => setNewBergerie({...newBergerie, lastName: e.target.value})} style={{ height: 40 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">E-mail</label>
                    <input className="input" type="email" placeholder="pierre@email.com" value={newBergerie.email} onChange={e => setNewBergerie({...newBergerie, email: e.target.value})} style={{ height: 40 }} />
                  </div>
                  <div>
                    <label className="form-label">Code d'accès secret</label>
                    <input className="input" type="text" placeholder="Ex: KAEL52" value={newBergerie.code} onChange={e => setNewBergerie({...newBergerie, code: e.target.value})} style={{ height: 40, letterSpacing: 1.5 }} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Rôle pastoral</label>
                  <select className="input" value={newBergerie.creator_role} onChange={e => setNewBergerie({...newBergerie, creator_role: e.target.value})} style={{ height: 40 }}>
                    <option value="Berger">Berger (Responsable principal)</option>
                    <option value="Second">Second du berger</option>
                    <option value="Responsable">Responsable de brebis</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 12, paddingTop: 10 }}>
                  <button className="btn btn-subtle" style={{ flex: 1, height: 44 }} onClick={() => setIsCreating(false)}>Annuler</button>
                  <button className="btn btn-primary" style={{ flex: 1, height: 44, justifyContent: "center" }} onClick={handleCreateRequest} disabled={!newBergerie.name || !newBergerie.code || !newBergerie.email}>Soumettre</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Active Dashboard (when Bergerie selected)
  const isOnlyResponsable = (userInfo?.role || "").toLowerCase().trim().includes("responsable");
  const isLeader = ["berger", "second", "responsable", "responsable_de_brebi", "second_du_berger"].includes((userInfo?.role || "").toLowerCase().trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-in">
      
      {/* Welcome & Top Controls */}
      <div style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.12)", paddingBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700 }}>{dateStr}</div>
          <h2 className="page-title" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
            Bonjour, {userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : "Utilisateur"}
            <span className="badge badge-gold" style={{ fontSize: 9, padding: "3px 10px", border: "1px solid rgba(212,175,55,0.3)" }}>
              {userInfo?.role || "Membre"}
            </span>
          </h2>
        </div>

        {/* Quick Action Shortcuts Bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isLeader && (
            <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/bergerie"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(212,175,55,0.3)", color: "var(--gold-light)" }}>
              <CalendarCheck size={14} /> Appel & Présences
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/affectation"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(56,189,248,0.3)", color: "var(--sky)" }}>
            <Users size={14} /> Mes Affectations
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/evangelisation"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(167,139,250,0.3)", color: "var(--purple-light)" }}>
            <Target size={14} /> Évangélisation
          </button>
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ height: 36 }}
            onClick={() => {
              setMyBergerie(null);
              localStorage.removeItem("selected_family");
              window.dispatchEvent(new Event("storage"));
            }}
          >
            Changer de Famille
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="bento bento-4 d1">
        {DYNAMIC_STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={i}>
              <Icon size={24} className="stat-icon" style={{ color: s.color }} />
              <span className="stat-label">{s.label}</span>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {s.trend === "up" ? <TrendingUp size={12} style={{ color: "var(--green)" }} /> : <TrendingDown size={12} style={{ color: "var(--red)" }} />}
                {s.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Engagement */}
      <div className="glass d2" style={{ border: "1px solid rgba(212, 175, 55, 0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Fidélisation & Engagement Global</span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            {isOnlyResponsable ? `${familyStats.membersCount} membres sous ma responsabilité` : `${familyStats.membersCount} membres actifs`}
          </span>
        </div>
        <div className="seg-bar" style={{ marginBottom: 16, height: 10, borderRadius: 5 }}>
          {engagementStats.map((e, i) => <div key={i} style={{ width: `${e.pct}%`, background: e.color }} />)}
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {engagementStats.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0, boxShadow: `0 0 8px ${e.color}` }} />
              <span style={{ color: "var(--cream-dim)" }}>{e.label}</span>
              <span style={{ fontWeight: 700, color: "var(--cream)" }}>{e.count}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>({e.pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Outreach & Soul Winning Impact Section */}
      <div className="glass d2" style={{ 
        border: "1px solid rgba(139, 92, 246, 0.2)", 
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(10, 6, 22, 0.7) 100%)",
        boxShadow: "0 8px 32px rgba(139, 92, 246, 0.05)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Glow behind section */}
        <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--purple-light)" }}>🔥 Impact Évangélisation & Moisson FDD</span>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {isOnlyResponsable ? "Résumé de mes activités et conquêtes d'âmes" : "Bilan spirituel et moisson de notre Famille de Disciples"}
            </p>
          </div>
          
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => window.location.href = "/dashboard/evangelisation"}
            style={{ 
              background: "linear-gradient(135deg, var(--purple-light), var(--purple))",
              border: "none",
              color: "#fff",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Plus size={14} /> Déposer un Rapport
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {/* Reached souls card */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ 
              width: 44, height: 44, borderRadius: 10, 
              background: "rgba(212,175,55,0.1)", 
              border: "1px solid rgba(212,175,55,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--gold)"
            }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Âmes Impactées</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--cream)", marginTop: 2 }}>{familyStats.totalReached}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>Rejointes avec l'Évangile</div>
            </div>
          </div>

          {/* Decisions for Christ card */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ 
              width: 44, height: 44, borderRadius: 10, 
              background: "rgba(16,185,129,0.1)", 
              border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--green)"
            }}>
              <Target size={20} className="animate-pulse" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Décisions pour Christ</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)", marginTop: 2 }}>{familyStats.totalSalvation}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>Prières de salut prononcées</div>
            </div>
          </div>

          {/* Invitations card */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ 
              width: 44, height: 44, borderRadius: 10, 
              background: "rgba(139,92,246,0.1)", 
              border: "1px solid rgba(139,92,246,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--purple-light)"
            }}>
              <CalendarCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Invitations Remises</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--purple-light)", marginTop: 2 }}>{familyStats.totalInvitations}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>Vers le Culte/la CDM</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activities + À risque */}
      <div className="bento bento-2-1 d3">
        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Activités de Réunion</span>
            {isLeader && (
              <button className="btn btn-subtle btn-sm" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => window.location.href = "/dashboard/bergerie"}>
                <ChevronRight size={12} /> Faire l'appel
              </button>
            )}
          </div>
          <div style={{ padding: "4px 0" }}>
            {activitiesList.length > 0 ? activitiesList.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: i < activitiesList.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
                <div className="color-bar" style={{ background: "linear-gradient(180deg, var(--gold), var(--gold-light))", height: 38, width: 3, borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={11} style={{ color: "var(--gold)" }} /> {a.date}</span>
                    <span>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} style={{ color: "var(--gold)" }} /> {a.time}</span>
                  </div>
                </div>
                {a.upcoming ? (
                  <span className="badge badge-gold" style={{ fontSize: 9 }}>À venir</span>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-display)", color: (a.attendance ?? 0) >= 70 ? "var(--green)" : "var(--orange)" }}>
                    {a.attendance}%
                  </span>
                )}
              </div>
            )) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Aucune activité pastorale enregistrée</div>
            )}
          </div>
        </div>

        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", background: "rgba(10, 6, 22, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--red)" }}>
              ● Alertes de Suivi FDD
            </span>
            <span className="badge badge-red" style={{ fontSize: 9, padding: "2px 6px" }}>{atRiskList.length}</span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {atRiskList.length > 0 ? atRiskList.map((m, i) => (
              <div key={i} style={{ padding: "16px 24px", borderBottom: i < atRiskList.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div className="avatar avatar-gradient avatar-effect-pulse" style={{ width: 36, height: 36, fontSize: 12, color: "var(--red)", borderColor: "var(--red)" }}>{m.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.issue}</div>
                  </div>
                  {isLeader && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => window.location.href = `/dashboard/bergerie`}>
                      Relancer
                    </button>
                  )}
                </div>
                <div className="progress" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${m.score}%`, background: "var(--red)" }} /></div>
              </div>
            )) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Aucun membre à risque détecté 🎉</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

