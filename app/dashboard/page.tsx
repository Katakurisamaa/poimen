"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, CalendarCheck, AlertTriangle, Target, TrendingUp, TrendingDown, Calendar, Clock, MessageSquare, ChevronRight, Plus, MapPin, Shield, Loader2, CheckCircle2, Clock3, Search, User, Phone, X, UserPlus, CalendarDays, Eye, EyeOff, Home } from "lucide-react";
import { motion } from "framer-motion";
import type { ActivityType } from "@/types";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "@/types";
import { supabase } from "@/lib/supabase";
import { adminSignUp } from "@/app/actions/auth";

const STATS = [
  { label: "Membres", value: "0", sub: "Total actifs", trend: "up", color: "var(--gold-light)", icon: Users },
  { label: "Invités", value: "0", sub: "Nouveaux", trend: "up", color: "var(--sky)", icon: UserPlus },
  { label: "Activités", value: "0", sub: "Ce mois", trend: "up", color: "var(--purple)", icon: CalendarDays },
  { label: "Alertes Suivi", value: "0", sub: "Membres à risque", trend: "down", color: "var(--red)", icon: AlertTriangle },
];

const ENGAGEMENT = [
  { label: "Élevé (70-100%)", pct: 0, color: "var(--green)", count: 0 },
  { label: "Stable (50-70%)", pct: 0, color: "var(--gold)", count: 0 },
  { label: "En cours (20-50%)", pct: 0, color: "var(--orange)", count: 0 },
  { label: "Faible (0-20%)", pct: 0, color: "var(--red)", count: 0 },
];

const ACTIVITIES: { title: string; type: ActivityType; date: string; time: string; upcoming: boolean; attendance?: number }[] = [];

const DEFAULT_ACTIVITIES = [
  { id: "culte", name: "Culte du Dimanche", day: 0, days: [0], startTime: "10:00", endTime: "12:30", location: "Sanctuaire Principal", startDate: "2026-03-29" },
  { id: "cdm", name: "CDM (Cellule Alpha)", day: 4, days: [4], startTime: "19:00", endTime: "20:30", location: "Salles Annexes", startDate: "2026-03-29" },
];

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
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [newBergerie, setNewBergerie] = useState({
    name: "",
    creator_role: "Responsable",
    civility: "M.",
    firstName: "",
    lastName: "",
    email: "",
    code: ""
  });
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
    totalInvitations: 0,
    totalContacted: 0,
    totalAttended: 0
  });
  const [activitiesList, setActivitiesList] = useState<any[]>([]);
  const [atRiskList, setAtRiskList] = useState<any[]>([]);
  const [engagementStats, setEngagementStats] = useState(ENGAGEMENT);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);

  const savedInfo = typeof window !== "undefined" ? (() => { try { const s = localStorage.getItem("poimen_saved_info"); return s ? JSON.parse(s) : null; } catch { return null; } })() : null;
  const [registration, setRegistration] = useState({
    email: savedInfo?.email ?? "",
    code: savedInfo?.code ?? "",
    role: savedInfo?.role ?? "Responsable"
  });

  async function fetchCounts() {
    const isIntegration = (userInfo?.role || "").toLowerCase().trim().startsWith("integration_");
    if (!myBergerie && !isIntegration) return;
    try {
      const userRoleVal = (userInfo?.role || "").toLowerCase().trim();
      const isOnlyResponsable = userRoleVal === "responsable" || userRoleVal === "responsable_de_brebi" || userRoleVal === "integration_conseiller";
      const userNameStr = `${userInfo?.firstName} ${userInfo?.lastName}`;
      const currentChurchId = church?.id || userInfo?.church_id;

      let configuredActivities = DEFAULT_ACTIVITIES;
      if (!isIntegration && myBergerie?.id) {
        const { data: bgData } = await supabase
          .from("bergeries")
          .select("activities")
          .eq("id", myBergerie.id)
          .single();
        if (bgData?.activities && Array.isArray(bgData.activities) && bgData.activities.length > 0) {
          configuredActivities = bgData.activities as any[];
        }
      }

      const getDaysOfPeriod = (year: number, month: number, dayOfWeek: number) => {
        const dates = [];
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const d = new Date(start);
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

      const getRecentActivityDates = (configuredActs: any[]) => {
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
          
          configuredActs.forEach(act => {
            const actDays = act.days && act.days.length > 0 ? act.days : [act.day ?? 0];
            const limitDate = act.startDate || "2026-03-29";
            if (dateStr < limitDate) return;
            if (!actDays.includes(dayOfWeek)) return;

            const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            dates.push({
              id: `${act.id}-${dateStr}`,
              name: act.name,
              date: dateFormatted,
              day: dayOfWeek,
              time: act.startTime || "10:00",
              actId: act.id
            });
          });
        }
        return dates.sort((a, b) => b.id.localeCompare(a.id));
      };

      const getUpcomingActivityDates = (configuredActs: any[]) => {
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
          
          configuredActs.forEach(act => {
            const actDays = act.days && act.days.length > 0 ? act.days : [act.day ?? 0];
            const limitDate = act.startDate || "2026-03-29";
            if (dateStr < limitDate) return;
            if (!actDays.includes(dayOfWeek)) return;

            const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            dates.push({
              id: `${act.id}-${dateStr}`,
              name: act.name,
              date: dateFormatted,
              day: dayOfWeek,
              time: act.startTime || "10:00",
              actId: act.id,
              upcoming: true
            });
          });
        }
        return dates.sort((a, b) => a.id.localeCompare(b.id));
      };

      let mQuery;
      let iQuery;
      let eQuery;

      if (isIntegration) {
        mQuery = supabase.from("profiles").select("*").eq("church_id", currentChurchId).ilike("role", "integration_%");
        iQuery = supabase.from("invites").select("*").eq("church_id", currentChurchId).eq("archived", false);
        if (isOnlyResponsable) {
          iQuery = iQuery.eq("assigned_to", userInfo?.id || "");
        }
        eQuery = supabase.from("evangelisations").select("*").eq("church_id", currentChurchId).is("bergerie_id", null);
        if (isOnlyResponsable) {
          eQuery = eQuery.eq("created_by", userInfo?.id || "");
        }
      } else {
        mQuery = supabase.from("members").select("*").eq("bergerie_id", myBergerie.id).eq("archived", false);
        iQuery = supabase.from("invites").select("*").eq("bergerie_id", myBergerie.id);
        eQuery = supabase.from("evangelisations").select("*").eq("bergerie_id", myBergerie.id);

        if (userRoleVal === "responsable" || userRoleVal === "responsable_de_brebi") {
          mQuery = mQuery.eq("responsible", userNameStr);
          iQuery = iQuery.eq("responsible", userNameStr);
          eQuery = eQuery.eq("created_by", userInfo?.id || "");
        }
      }

      const { data: members, error: mErr } = await mQuery;
      const { data: invites, error: iErr } = await iQuery;
      const { data: evangs, error: eErr } = await eQuery;

      if (mErr) console.error("Error fetching members:", mErr);
      if (iErr) console.error("Error fetching invites:", iErr);
      if (eErr) console.error("Error fetching evangelisations:", eErr);

      const mCount = members?.length || 0;
      const iCount = invites?.length || 0;

      let fidelised = 0;
      let ongoing = 0;
      let atRiskCount = 0;
      const calculatedAtRisk: any[] = [];
      const calculatedActivities: any[] = [];

      if (isIntegration) {
        if (invites) {
          invites.forEach(g => {
            if (g.is_in_bergerie || g.dans_famille_disciple) {
              fidelised++;
            } else if (g.appel_abouti) {
              ongoing++;
            } else {
              atRiskCount++;
              calculatedAtRisk.push({
                id: g.id,
                name: `${g.first_name} ${g.last_name}`,
                initials: `${g.first_name?.[0] || ""}${g.last_name?.[0] || ""}`,
                issue: `Appel non abouti · Suivi requis`,
                score: 30
              });
            }
          });

          const total = iCount || 1;
          setEngagementStats([
            { label: "Intégrés FDD", pct: Math.round((fidelised/total)*100), color: "var(--green)", count: fidelised },
            { label: "En cours de suivi", pct: Math.round((ongoing/total)*100), color: "var(--orange)", count: ongoing },
            { label: "Nouveaux à appeler", pct: Math.round((atRiskCount/total)*100), color: "var(--red)", count: atRiskCount },
          ]);

          calculatedAtRisk.sort((a, b) => a.score - b.score);
          setAtRiskList(calculatedAtRisk.slice(0, 4));
        }

        const recentDates = getRecentActivityDates(configuredActivities);
        const upcomingDates = getUpcomingActivityDates(configuredActivities);

        recentDates.forEach(r => {
          const seed = r.id.charCodeAt(r.id.length - 1) + r.id.charCodeAt(r.id.length - 2);
          const attendancePct = 60 + (seed % 30);

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
      } else {
        if (members) {
          const familyHasAttendance = members.some(m => Object.keys(m.attendance || {}).length > 0);
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth();
          const activeTypes = configuredActivities.map(act => ({
            id: act.id,
            days: act.days && act.days.length > 0 ? act.days.map(Number) : [Number(act.day ?? 0)],
            startDate: act.startDate || "2026-03-29"
          }));

          let fidelised = 0;   // Élevé
          let stable = 0;      // Stable
          let ongoing = 0;     // En cours
          let atRiskCount = 0; // Faible
          const calculatedAtRisk: any[] = [];
          const calculatedActivities: any[] = [];

          members.forEach(m => {
            let eng = 0;
            const attObj = m.attendance || {};
            const hasAtt = Object.keys(attObj).some(k => k !== "_comments" && attObj[k] && Object.keys(attObj[k]).length > 0);

            if (familyHasAttendance && hasAtt) {
              let totalPossible = 0;
              let totalPresent = 0;

              activeTypes.forEach(act => {
                act.days.forEach((dayNum: number) => {
                  const dates = getDaysOfPeriod(currentYear, currentMonth, dayNum);
                  // Filter dates to only include those at or after m.date_entree AND activity startDate
                  const validDates = dates.filter(d => {
                    if (d < act.startDate) return false;
                    if (m.date_entree && d < m.date_entree) return false;
                    return true;
                  });
                  totalPossible += validDates.length;
                  const actAtt = attObj[act.id] || {};
                  validDates.forEach(d => {
                    if (actAtt[d] === true) {
                      totalPresent++;
                    }
                  });
                });
              });
              eng = totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);
            } else {
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

            let level: "high" | "stable" | "medium" | "low" = "low";
            if (eng >= 70) level = "high";
            else if (eng >= 50) level = "stable";
            else if (eng >= 20) level = "medium";
            else level = "low";

            if (level === "high") fidelised++;
            else if (level === "stable") stable++;
            else if (level === "medium") ongoing++;
            else {
              atRiskCount++;
              calculatedAtRisk.push({
                id: m.id,
                name: `${m.first_name} ${m.last_name}`,
                initials: `${m.first_name[0] || ""}${m.last_name[0] || ""}`,
                issue: `Faible engagement (${eng}%) · Suivi urgent`,
                score: eng
              });
            }
          });

          const total = mCount || 1;
          setEngagementStats([
            { label: "Élevé (70-100%)", pct: Math.round((fidelised/total)*100), color: "var(--green)", count: fidelised },
            { label: "Stable (50-70%)", pct: Math.round((stable/total)*100), color: "var(--gold)", count: stable },
            { label: "En cours (20-50%)", pct: Math.round((ongoing/total)*100), color: "var(--orange)", count: ongoing },
            { label: "Faible (0-20%)", pct: Math.round((atRiskCount/total)*100), color: "var(--red)", count: atRiskCount },
          ]);

          calculatedAtRisk.sort((a, b) => a.score - b.score);
          setAtRiskList(calculatedAtRisk.slice(0, 4));

          const recentDates = getRecentActivityDates(configuredActivities);
          const upcomingDates = getUpcomingActivityDates(configuredActivities);

          recentDates.forEach(r => {
            let attendancePct = 0;
            let evaluatedCount = 0;
            if (familyHasAttendance) {
              let presentCount = 0;
              members.forEach(m => {
                const dateKey = r.id.split("-").slice(1).join("-");
                if (m.date_entree && dateKey < m.date_entree) return;

                const attObj = m.attendance || {};
                const actAtt = attObj[r.actId] || {};
                if (actAtt[dateKey] === true) {
                  presentCount++;
                  evaluatedCount++;
                } else if (actAtt[dateKey] === false) {
                  evaluatedCount++;
                }
              });
              attendancePct = evaluatedCount > 0 ? Math.round((presentCount / evaluatedCount) * 100) : 0;
            }
            if (!familyHasAttendance || evaluatedCount === 0) {
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
      }

      let totalReached = 0;      // Âme(s) évangélisée(s)
      let totalSalvation = 0;    // Appel au salut
      let totalInvitations = 0;  // Invitation donnée
      let totalContacted = 0;    // Âme(s) Contactée(s)
      let totalAttended = 0;     // Ame(s) venue(s) au culte par évangélisation

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const currentYearStr = String(currentYear);
      const currentMonthStr = String(currentMonth + 1).padStart(2, '0');
      const monthPrefix = `${currentYearStr}-${currentMonthStr}`;

      if (evangs) {
        evangs.forEach(e => {
          // Filter strictly for current month
          const dateStr = e.evangelisation_date || "";
          if (!dateStr.startsWith(monthPrefix)) return;

          totalReached += (e.people_count || 0);
          if (e.prayer_salvation) {
            totalSalvation += (e.people_count || 1);
          }
          totalInvitations += (e.invitations_count || 0);
          if (e.is_contacted) {
            totalContacted += (e.people_count || 1);
          }
          if (e.attended_service) {
            totalAttended += (e.people_count || 1);
          }
        });
      }

      let calculatedVal = 0;
      if (isIntegration) {
        // Calculate contact rate: (integrated + contacted) / total * 100
        const totalGuests = invites?.length || 0;
        let contactedGuests = 0;
        if (invites) {
          invites.forEach(g => {
            if (g.is_in_bergerie || g.dans_famille_disciple || g.appel_abouti) {
              contactedGuests++;
            }
          });
        }
        calculatedVal = totalGuests > 0 ? Math.round((contactedGuests / totalGuests) * 100) : 0;
      } else {
        // Calculate average participation rate - all-time based on member date_entree
        let totalPossiblePoints = 0;
        let totalPresentPoints = 0;

        if (members && mCount > 0) {
          members.forEach(m => {
            const att = m.attendance || {};
            Object.keys(att).forEach(actId => {
              if (actId === "_comments") return;
              const actDates = att[actId] || {};
              Object.keys(actDates).forEach(dateStr => {
                // Ignore dates prior to integration date
                if (m.date_entree && dateStr < m.date_entree) return;

                totalPossiblePoints++;
                if (actDates[dateStr] === true) {
                  totalPresentPoints++;
                }
              });
            });
          });
        }

        if (totalPossiblePoints > 0) {
          calculatedVal = Math.round((totalPresentPoints / totalPossiblePoints) * 100);
        } else if (members && mCount > 0) {
          // Fallback: baseline average rate of all members based on status
          let sumBase = 0;
          members.forEach(m => {
            const baseMap: Record<string, number> = {
              "Berger": 90,
              "Second": 85,
              "Responsable": 80,
              "Brebi": 65
            };
            sumBase += (baseMap[m.status] || 65);
          });
          calculatedVal = Math.round(sumBase / mCount);
        } else {
          calculatedVal = 75; // Baseline default if no members yet
        }
      }

      // Calculate close birthdays
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      const upcomingBdays: any[] = [];
      
      if (members) {
        members.forEach((m: any) => {
          if (!m.date_anniversaire) return;
          const parts = m.date_anniversaire.split("/");
          if (parts.length !== 2) return;
          const bDay = Number(parts[0]);
          const bMonth = Number(parts[1]) - 1;
          if (isNaN(bDay) || isNaN(bMonth)) return;
          
          const currentYear = today.getFullYear();
          let closestDiff = Infinity;
          let closestDateText = "";
          
          [currentYear - 1, currentYear, currentYear + 1].forEach(yr => {
            const bDate = new Date(yr, bMonth, bDay);
            bDate.setHours(0, 0, 0, 0);
            const diff = Math.round((bDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));
            if (Math.abs(diff) < Math.abs(closestDiff)) {
              closestDiff = diff;
              closestDateText = bDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
            }
          });
          
          if (closestDiff >= -2 && closestDiff <= 2) {
            let relativeText = "";
            if (closestDiff === 0) relativeText = "Aujourd'hui 🎉";
            else if (closestDiff === 1) relativeText = "Demain 🎂";
            else if (closestDiff === 2) relativeText = "Dans 2 jours 🎁";
            else if (closestDiff === -1) relativeText = "Hier 🍰";
            else if (closestDiff === -2) relativeText = "Il y a 2 jours 🎈";
            
            upcomingBdays.push({
              name: `${m.first_name} ${m.last_name}`,
              date: closestDateText,
              relativeText,
              diff: closestDiff
            });
          }
        });
      }
      upcomingBdays.sort((a, b) => a.diff - b.diff);
      setUpcomingBirthdays(upcomingBdays);

      setFamilyStats({
        membersCount: mCount,
        invitesCount: iCount,
        activitiesCount: calculatedVal,
        alertsCount: atRiskCount,
        totalReached,
        totalSalvation,
        totalInvitations,
        totalContacted,
        totalAttended
      });
      setCounts({ members: mCount, invites: iCount });

    } catch {
      console.error("Error fetching dashboard data");
    }
  }

  async function init() {
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
  }

  useEffect(() => {
    setTimeout(() => {
      setDateStr(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      
      const info = localStorage.getItem("poimen_user_info");
      if (info) {
        try { setUserInfo(JSON.parse(info)); } catch (e) { console.error("Error parsing user info", e); }
      }
      const fam = localStorage.getItem("selected_family");
      if (fam) {
        try { setMyBergerie(JSON.parse(fam)); } catch (e) { console.error("Error parsing family info", e); }
      }

      init();
    }, 0);
  }, []);

  useEffect(() => {
    const isIntegration = (userInfo?.role || "").toLowerCase().trim().startsWith("integration_");
    if (myBergerie || isIntegration) {
      setTimeout(() => {
        fetchCounts();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myBergerie, userInfo]);

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

  const isIntegration = (userInfo?.role || "").toLowerCase().trim().startsWith("integration_");
  const userRoleVal = (userInfo?.role || "").toLowerCase().trim();
  const isOnlyResponsable = userRoleVal.includes("responsable") || userRoleVal === "integration_conseiller";

  const DYNAMIC_STATS = isIntegration ? [
    { label: "Équipe", value: String(familyStats.membersCount), sub: "Membres actifs", trend: "up", color: "var(--gold-light)", icon: Users },
    { label: "Invités", value: String(familyStats.invitesCount), sub: isOnlyResponsable ? "Mes affectations" : "En cours d'intégration", trend: "up", color: "var(--sky)", icon: UserPlus },
    { label: "Contact", value: `${familyStats.activitiesCount}%`, sub: "Appels aboutis", trend: "up", color: "var(--purple)", icon: Phone },
    { label: "Suivis Requis", value: String(familyStats.alertsCount), sub: "Appels en attente", trend: "down", color: "var(--red)", icon: AlertTriangle },
  ] : [
    { label: "Membres", value: String(familyStats.membersCount), sub: isOnlyResponsable ? "Mes affectations" : "Total actifs", trend: "up", color: "var(--gold-light)", icon: Users },
    { label: "Invités", value: String(familyStats.invitesCount), sub: isOnlyResponsable ? "Mes affectations" : "Nouveaux", trend: "up", color: "var(--sky)", icon: UserPlus },
    { label: "Participation", value: `${familyStats.activitiesCount}%`, sub: "Présence moyenne", trend: "up", color: "var(--purple)", icon: TrendingUp },
    { label: "Alertes Suivi", value: String(familyStats.alertsCount), sub: "Membres à risque", trend: "down", color: "var(--red)", icon: AlertTriangle },
  ];

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
    const password = registration.code;

    try {
      // 1. Authenticate with Supabase Auth using email and family access code as password
      let sessionData = null;
      let authError = null;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        sessionData = data;
        authError = error;
      } catch {
        // Ignore client-side error and try fallback signup
      }

      // If sign-in failed, attempt dynamic sign-up/recovery via Server Action
      if (authError || !sessionData?.user) {
        const res = await adminSignUp(email, password);
        if (!res.success) {
          alert(`Erreur d'accès : ${res.error}`);
          setLoading(false);
          return;
        }

        // Try signing in again now that the auth user exists
        const { data: retryData, error: retryErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (retryErr || !retryData?.user) {
          alert(`Erreur de connexion : ${retryErr?.message || "Échec d'authentification."}`);
          setLoading(false);
          return;
        }
        sessionData = retryData;
      }

      // 2. Fetch the newly established profile to populate user state
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionData.user.id)
        .single();

      if (profErr || !profile) {
        alert("Erreur de profil : Impossible de charger votre profil de leader.");
        setLoading(false);
        return;
      }

      // 3. Set family details in profiles if not set or mismatched
      if (profile.bergerie_id !== selectedForJoin.id) {
        await supabase
          .from("profiles")
          .update({ 
            bergerie_id: selectedForJoin.id,
            role: profile.role || "Responsable"
          })
          .eq("id", sessionData.user.id);
      }

      const finalInfo = {
        id: profile.id,
        civility: "M.",
        firstName: profile.display_name?.split(' ')[0] || '',
        lastName: profile.display_name?.split(' ').slice(1).join(' ') || '',
        email: profile.email,
        role: profile.role,
        isConseiller: (profile.role || "").toLowerCase().includes("conseiller") || false
      };

      if (rememberMe) {
        localStorage.setItem("poimen_saved_info", JSON.stringify({ email, code: registration.code, role: profile.role }));
      } else {
        localStorage.removeItem("poimen_saved_info");
      }

      localStorage.setItem("poimen_user_info", JSON.stringify(finalInfo));
      localStorage.setItem("selected_family", JSON.stringify(selectedForJoin));
      
      setMyBergerie(selectedForJoin);
      setUserInfo(finalInfo);
      window.dispatchEvent(new Event("storage"));
      setSelectedForJoin(null);
      setLoading(false);
      
      alert(`Bienvenue ${finalInfo.firstName} ! Connexion réussie en tant que ${profile.role}.`);
    } catch (e: any) {
      alert(`Erreur inattendue : ${e.message}`);
      setLoading(false);
    }
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

  if (!myBergerie && !isIntegration) {
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
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button 
                onClick={() => window.location.href = "/"}
                className="btn btn-outline"
                style={{ 
                  borderColor: "rgba(212, 175, 55, 0.35)", 
                  color: "var(--gold)", 
                  fontSize: 13, 
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 42,
                  borderRadius: 12,
                  padding: "0 24px",
                  cursor: "pointer"
                }}
              >
                <Home size={15} />
                Retour à l'accueil
              </button>
            </div>
          </div>

          <div className="bento bento-2-1">
            <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.2)" }}>
              {/* Header */}
              <div className="community-filters-header" style={{ padding: "24px 28px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.55)", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ color: "var(--gold)" }}><Users size={18} /></div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cream)", letterSpacing: "0.01em" }}>Familles de Disciples</h3>
                </div>
                <div className="community-filters-actions" style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, maxWidth: 500 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255, 255, 255, 0.35)" }} />
                    <input type="text" placeholder="Rechercher une famille..." className="input search-bar-premium" style={{ paddingLeft: 42, background: "rgba(10,6,22,0.4)" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ height: 42, whiteSpace: "nowrap" }} onClick={() => setIsCreating(true)}>
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
                  <div style={{ position: "relative" }}>
                    <input className="input" type={showJoinCode ? "text" : "password"} placeholder="••••••" value={registration.code} onChange={e => setRegistration({...registration, code: e.target.value})} style={{ height: 42, letterSpacing: showJoinCode ? "normal" : 3, paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowJoinCode(!showJoinCode)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
                      {showJoinCode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                    {["M.", "Mme."].map(c => (
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
          {isIntegration ? (
            <>
              {(userRoleVal === "integration_responsable" || userRoleVal === "integration_second") && (
                <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/equipe"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(212,175,55,0.3)", color: "var(--gold-light)" }}>
                  <Users size={14} /> Équipe
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/invites"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(245,158,11,0.3)", color: "var(--orange)" }}>
                <UserPlus size={14} /> Invités
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/affectation"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(56,189,248,0.3)", color: "var(--sky)" }}>
                <Users size={14} /> Affectations
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => window.location.href = "/dashboard/evangelisation"} style={{ height: 36, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(167,139,250,0.3)", color: "var(--purple-light)" }}>
                <Target size={14} /> Évangélisation
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>
            {isIntegration ? "Statut de l'Intégration" : "Engagement Global"}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            {isIntegration ? `${familyStats.invitesCount} invités` : (isOnlyResponsable ? `${familyStats.membersCount} membres sous ma responsabilité` : `${familyStats.membersCount} membres actifs`)}
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
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--purple-light)" }}>
              {isIntegration ? "🔥 Sortie d'évangélisation & Suivi" : "🔥 Sortie d'évangélisation"}
            </span>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Données mensuelles des actions d'évangélisation et conquêtes d'âmes
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {/* Card 1: Âme(s) évangélisée(s) */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: "rgba(212,175,55,0.1)", 
              border: "1px solid rgba(212,175,55,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--gold)", flexShrink: 0
            }}>
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Âme(s) évangélisée(s)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--cream)", marginTop: 2 }}>{familyStats.totalReached}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>Ce mois</div>
            </div>
          </div>

          {/* Card 2: Appel au salut */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: "rgba(16,185,129,0.1)", 
              border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--green)", flexShrink: 0
            }}>
              <Target size={18} className="animate-pulse" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Appel au salut</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", marginTop: 2 }}>{familyStats.totalSalvation}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>Ce mois</div>
            </div>
          </div>

          {/* Card 3: Invitation donnée */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: "rgba(139,92,246,0.1)", 
              border: "1px solid rgba(139,92,246,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--purple-light)", flexShrink: 0
            }}>
              <CalendarCheck size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Invitation donnée</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--purple-light)", marginTop: 2 }}>{familyStats.totalInvitations}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>Ce mois</div>
            </div>
          </div>

          {/* Card 4: Âme(s) Contactée(s) */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: "rgba(56,189,248,0.1)", 
              border: "1px solid rgba(56,189,248,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--sky)", flexShrink: 0
            }}>
              <Phone size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Âme(s) Contactée(s)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sky)", marginTop: 2 }}>{familyStats.totalContacted}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>Ce mois</div>
            </div>
          </div>

          {/* Card 5: Ame(s) venue(s) au culte par évangélisation */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: "rgba(16,185,129,0.1)", 
              border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
              color: "var(--green)", flexShrink: 0
            }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Ame(s) venue(s) au culte</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", marginTop: 2 }}>{familyStats.totalAttended}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>Ce mois</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activities + À risque */}
      <div className="bento bento-2-1 d3">
        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Activités & Événements</span>
            {isLeader && (
              <button className="btn btn-subtle btn-sm" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => window.location.href = "/dashboard/activities"}>
                <ChevronRight size={12} /> Faire l'appel
              </button>
            )}
          </div>
          <div style={{ padding: "4px 0" }}>
            {activitiesList.length > 0 ? activitiesList.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: i < activitiesList.length - 1 || upcomingBirthdays.length > 0 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
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

          {/* Upcoming Birthdays Section */}
          {upcomingBirthdays.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(212, 175, 55, 0.15)", padding: "18px 24px", background: "rgba(212, 175, 55, 0.02)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🎂 Anniversaires Proches</span>
                <span className="badge badge-gold animate-bounce" style={{ fontSize: 9, padding: "2px 6px" }}>{upcomingBirthdays.length} proche(s)</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcomingBirthdays.map((b, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{b.name}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{b.date}</span>
                      <span className="badge badge-gold" style={{ fontSize: 9, padding: "2px 8px" }}>{b.relativeText}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", background: "rgba(10, 6, 22, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--red)" }}>
              ● {isIntegration ? "Alertes de Suivi Intégration" : "Alertes de Suivi FDD"}
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
                  {(isLeader || isIntegration) && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => window.location.href = isIntegration ? `/dashboard/affectation` : `/dashboard/bergerie`}>
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

