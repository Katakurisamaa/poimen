"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";
import { 
  Plus, Calendar, Clock, MapPin, ChevronRight, XCircle, 
  Search, CheckCircle2, List, Grid3X3, Users, BarChart3,
  ChevronDown, ChevronUp, MoreHorizontal, Trash2,
  AlertTriangle, TrendingUp, Pencil
} from "lucide-react";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "@/types";
import type { ActivityType } from "@/types";

// Types
interface Activity {
  id: string;
  name: string;
  day: number; // 0 for Sunday, 4 for Thursday, etc.
  days?: number[];
  startTime: string;
  endTime: string;
  location: string;
  noFixedHours?: boolean;
  startDate?: string;
  cancelledDates?: string[];
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  civility: string;
  status: string;
  isInvite?: boolean;
  archived?: boolean;
  attendance: Record<string, Record<string, any>>; // activityId -> dateString -> present / _comments
  dateEntree?: string;
}

// Mock Data (Empty for production)
// Default activities to show if none are saved
const DEFAULT_ACTIVITIES: Activity[] = [
  { id: "culte", name: "Culte du Dimanche", day: 0, startTime: "10:00", endTime: "12:30", location: "Sanctuaire Principal" },
  { id: "cdm", name: "CDM (Cellule Alpha)", day: 4, startTime: "19:00", endTime: "20:30", location: "Salles Annexes" },
];

const INITIAL_MEMBERS: Member[] = [];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>(DEFAULT_ACTIVITIES);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"attendance" | "schedule" | "stats">("attendance");
  const [attendanceViewMode, setAttendanceViewMode] = useState<"by-member" | "by-activity">("by-activity");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [presenceFilter, setPresenceFilter] = useState<"all" | "present" | "absent">("all");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const activeActivitiesForPeriod = useMemo(() => {
    const periodStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return activities.filter(act => {
      if (!act.startDate) return true;
      return act.startDate.substring(0, 7) <= periodStr;
    });
  }, [activities, selectedMonth, selectedYear]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBergerieId, setUserBergerieId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserFullName, setCurrentUserFullName] = useState<string | null>(null);

  useEffect(() => {
    if (isAddModalOpen) {
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
  }, [isAddModalOpen]);

  // Load activities from localStorage and members from Supabase
  useEffect(() => {
    const init = async () => {
      try {
        const activeContext = getActiveContext();
        const activeUserInfo = getActiveUserInfo();
        const userInfoStr = activeUserInfo ? JSON.stringify(activeUserInfo) : localStorage.getItem("poimen_user_info");
        if (!userInfoStr) {
          setError("Session expirée ou non connectée.");
          setIsLoading(false);
          setIsMounted(true);
          return;
        }
        
        const userInfo = JSON.parse(userInfoStr);
        setCurrentUserEmail(userInfo.email);
        setCurrentUserFullName(`${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim());

        // 1. Fetch Profile and Role
        let bergerieId = "";
        let status = "";

        if (activeContext?.context_type === "integration") {
          setError("Les activites sont disponibles depuis une casquette Famille de Disciples.");
          setIsLoading(false);
          setIsMounted(true);
          return;
        }

        if (activeContext?.context_type === "family" && activeContext.bergerie_id) {
          bergerieId = activeContext.bergerie_id;
          status = activeContext.role;
        }

        if (!bergerieId) {
          const { data: member } = await supabase
            .from("members")
            .select("bergerie_id, status")
            .eq("email", userInfo.email)
            .maybeSingle();

          if (member?.bergerie_id) {
            bergerieId = member.bergerie_id;
            status = member.status;
          } else {
            // Fallback to profiles table
            const { data: profile } = await supabase
              .from("profiles")
              .select("bergerie_id, role")
              .eq("email", userInfo.email)
              .maybeSingle();

            if (profile?.bergerie_id) {
              bergerieId = profile.bergerie_id;
              status = profile.role === "super_admin" ? "Super Admin" : (profile.role || "Membre");
            }
          }
        }

        if (!bergerieId) {
          setError("Vous n'êtes affecté à aucune bergerie.");
          setIsLoading(false);
          setIsMounted(true);
          return;
        }
        
        setUserBergerieId(bergerieId);
        setUserRole(status);

        // 2. Load Activities from Supabase bergeries table
        const { data: bergerieData } = await supabase
          .from("bergeries")
          .select("activities")
          .eq("id", bergerieId)
          .single();

        let loadedActivities: Activity[] = [];
        if (bergerieData?.activities) {
          loadedActivities = bergerieData.activities as Activity[];
        }
        
        // Backward compatibility: fallback to localStorage if DB is empty
        if (loadedActivities.length === 0) {
          const savedActivities = localStorage.getItem("local_activities");
          if (savedActivities) {
            try {
              loadedActivities = JSON.parse(savedActivities);
            } catch (e) {
              console.error("Local activities parse error", e);
            }
          }
        }
        
        // If still no activities, use defaults
        if (loadedActivities.length === 0) {
          loadedActivities = DEFAULT_ACTIVITIES;
        }
        setActivities(loadedActivities);

        // 3. Fetch Members
        const { data: membersData } = await supabase.from("members").select("*").eq("bergerie_id", bergerieId);

        const allPeople: Member[] = (membersData || []).map(m => ({
          id: m.id,
          firstName: m.first_name,
          lastName: m.last_name,
          civility: m.civility,
          status: m.status || "Brebi",
          isInvite: false,
          archived: m.archived || false,
          attendance: m.attendance || {},
          dateEntree: m.date_entree || ""
        }));

        setMembers(allPeople);

        // Set default activity if not set
        if (loadedActivities.length > 0 && !selectedActivityId) {
          setSelectedActivityId(loadedActivities[0].id);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Erreur de connexion à la base de données.");
      } finally {
        setIsLoading(false);
        setIsMounted(true);
      }
    };

    init();
  }, []);

  const saveActivities = async (newActs: Activity[]) => {
    setActivities(newActs);
    localStorage.setItem("local_activities", JSON.stringify(newActs));
    if (userBergerieId) {
      try {
        await supabase
          .from("bergeries")
          .update({ activities: newActs })
          .eq("id", userBergerieId);
      } catch (err) {
        console.error("Error saving activities to database:", err);
      }
    }
  };

  // Ensure selectedActivityId is initialized to an active activity
  useEffect(() => {
    if (activeActivitiesForPeriod.length > 0) {
      const isSelectedActive = activeActivitiesForPeriod.some(a => a.id === selectedActivityId);
      if (!isSelectedActive) {
        setSelectedActivityId(activeActivitiesForPeriod[0].id);
      }
    } else {
      setSelectedActivityId(null);
    }
  }, [activeActivitiesForPeriod, selectedActivityId]);

  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    name: "",
    day: 0,
    startTime: "18:00",
    endTime: "20:00",
    location: "Salles Annexes",
    startDate: "2026-03-29"
  });

  const [selectedDays, setSelectedDays] = useState<number[]>([0]);
  const [noFixedHours, setNoFixedHours] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (isAddModalOpen) {
      if (!editingActivityId) {
        setSelectedDays([0]);
        setNoFixedHours(false);
        setNewActivity({
          name: "",
          location: "Salles Annexes",
          startTime: "18:00",
          endTime: "20:00",
          startDate: "2026-03-29"
        });
      }
    } else {
      setEditingActivityId(null);
    }
  }, [isAddModalOpen, editingActivityId]);

  // Helpers
  const getDaysOfMonth = (year: number, month: number, dayOfWeek: number) => {
    const dates = [];
    let d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (d.getDay() === Number(dayOfWeek)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    // Parse YYYY-MM-DD manually to avoid UTC shift issues
    const [y, m, day] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const getClosestDate = (dates: string[]) => {
    if (dates.length === 0) return "";
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowTime = now.getTime();
    
    let closestDate = dates[0];
    let minDiff = Infinity;
    
    dates.forEach(dStr => {
      const [y, m, day] = dStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, day);
      const diff = Math.abs(dateObj.getTime() - nowTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = dStr;
      }
    });
    return closestDate;
  };

  const getDaysOfMonthForActivity = (year: number, month: number, act: Activity) => {
    const days = act.days && act.days.length > 0 ? act.days : [act.day ?? 0];
    const allDates: string[] = [];
    
    days.forEach(dayOfWeek => {
      const dates = getDaysOfMonth(year, month, dayOfWeek);
      allDates.push(...dates);
    });
    
    const limitDate = act.startDate || "2026-03-29";
    return allDates.filter(d => d >= limitDate).sort();
  };

  const getDaysLabel = (act: Activity) => {
    const dayNamesPlural = ["Dimanches", "Lundis", "Mardis", "Mercredis", "Jeudis", "Vendredis", "Samedis"];
    const days = act.days && act.days.length > 0 ? act.days : [act.day ?? 0];
    const sortedDays = [...days].sort((a, b) => a - b);
    if (sortedDays.length === 1) {
      return `Tous les ${dayNamesPlural[sortedDays[0]]}`;
    }
    return `Tous les ${sortedDays.map(d => dayNamesPlural[d]).join(", ")}`;
  };

  const activeActivity = useMemo(() => {
    return activities.find(a => a.id === selectedActivityId) || null;
  }, [activities, selectedActivityId]);

  const yearsRange = useMemo(() => {
    const startY = activeActivity?.startDate ? Number(activeActivity.startDate.split("-")[0]) : 2026;
    const currentYear = new Date().getFullYear();
    const range = [];
    for (let y = startY; y <= Math.max(currentYear, startY) + 1; y++) {
      range.push(y);
    }
    return range;
  }, [activeActivity]);

  const displayedMonths = useMemo(() => {
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const startY = activeActivity?.startDate ? Number(activeActivity.startDate.split("-")[0]) : 2026;
    if (selectedYear === startY) {
      const startM = activeActivity?.startDate ? Number(activeActivity.startDate.split("-")[1]) - 1 : 2;
      return monthNames.map((m, i) => ({ name: m, index: i })).filter(m => m.index >= startM);
    }
    return monthNames.map((m, i) => ({ name: m, index: i }));
  }, [activeActivity, selectedYear]);

  // Shift month/year selection if it is prior to the activity start date
  useEffect(() => {
    if (activeActivity) {
      const startY = activeActivity.startDate ? Number(activeActivity.startDate.split("-")[0]) : 2026;
      const startM = activeActivity.startDate ? Number(activeActivity.startDate.split("-")[1]) - 1 : 2;
      
      let nextYear = selectedYear;
      let nextMonth = selectedMonth;
      
      if (selectedYear < startY) {
        nextYear = startY;
        nextMonth = startM;
      } else if (selectedYear === startY && selectedMonth < startM) {
        nextMonth = startM;
      }
      
      if (nextYear !== selectedYear) {
        setSelectedYear(nextYear);
      }
      if (nextMonth !== selectedMonth) {
        setSelectedMonth(nextMonth);
      }
    }
  }, [activeActivity, selectedYear, selectedMonth]);

  const activityDates = useMemo(() => {
    const map: Record<string, string[]> = {};
    activities.forEach(act => {
      map[act.id] = getDaysOfMonthForActivity(selectedYear, selectedMonth, act);
    });
    return map;
  }, [activities, selectedMonth, selectedYear]);

  // Handle default date for By Activity mode
  useEffect(() => {
    if (selectedActivityId && activityDates[selectedActivityId]?.length > 0) {
      const closest = getClosestDate(activityDates[selectedActivityId]);
      setSelectedDate(closest);
    }
  }, [selectedActivityId, activityDates]);

  const toggleAttendance = async (memberId: string, activityId: string, date: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const actAtt = member.attendance[activityId] || {};
    const newPresentState = !actAtt[date];
    const newAttendance = {
      ...member.attendance,
      [activityId]: { ...actAtt, [date]: newPresentState }
    };

    // 1. Update local state immediately
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, attendance: newAttendance } : m
    ));

    // 2. Update Supabase
    try {
      await supabase.from("members").update({ attendance: newAttendance }).eq("id", memberId);
    } catch (err) {
      console.error("Attendance update error:", err);
    }
  };

  const saveAttendanceComment = async (memberId: string, activityId: string, date: string, comment: string) => {
    // 1. Optimistic local state update
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const attObj = m.attendance || {};
      const commentsObj = attObj["_comments"] || {};
      const actComments = commentsObj[activityId] || {};
      const newAttendance = {
        ...attObj,
        "_comments": {
          ...commentsObj,
          [activityId]: {
            ...actComments,
            [date]: comment
          }
        }
      };
      return { ...m, attendance: newAttendance };
    }));

    // 2. Async save to Supabase
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) return;
      const attObj = member.attendance || {};
      const commentsObj = attObj["_comments"] || {};
      const actComments = commentsObj[activityId] || {};
      const newAttendance = {
        ...attObj,
        "_comments": {
          ...commentsObj,
          [activityId]: {
            ...actComments,
            [date]: comment
          }
        }
      };
      await supabase.from("members").update({ attendance: newAttendance }).eq("id", memberId);
    } catch (err) {
      console.error("Error saving attendance comment:", err);
    }
  };

  const handleBatchAttendance = async (present: boolean) => {
    if (!selectedActivityId || !selectedDate) return;
    
    const targetIds = new Set(displayedMembers.map(m => m.id));
    
    // 1. Optimistic local update
    const updatedMembers = members.map(m => {
      if (!targetIds.has(m.id)) return m;
      const actAtt = m.attendance[selectedActivityId] || {};
      return {
        ...m,
        attendance: {
          ...m.attendance,
          [selectedActivityId]: { ...actAtt, [selectedDate]: present }
        }
      };
    });
    setMembers(updatedMembers);

    // 2. Async updates to Supabase (Promise.all is faster than sequential)
    try {
      await Promise.all(updatedMembers.map(async (m) => {
        if (!targetIds.has(m.id)) return;
        // Only update if state actually changed for this member
        const wasPresent = members.find(old => old.id === m.id)?.attendance[selectedActivityId]?.[selectedDate];
        if (wasPresent !== present) {
          return supabase.from("members").update({ attendance: m.attendance }).eq("id", m.id);
        }
      }));
    } catch (err) {
      console.error("Batch update error:", err);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingActivityId) {
      // Edit mode
      const updatedActs = activities.map(act => {
        if (act.id !== editingActivityId) return act;
        return {
          ...act,
          name: newActivity.name || "Activité",
          day: selectedDays[0],
          days: selectedDays,
          startTime: noFixedHours ? "" : (newActivity.startTime || "18:00"),
          endTime: noFixedHours ? "" : (newActivity.endTime || "20:00"),
          noFixedHours: noFixedHours,
          location: newActivity.location || "Salle",
          startDate: newActivity.startDate || "2026-03-29"
        };
      });
      await saveActivities(updatedActs);
    } else {
      // Add mode
      const act: Activity = {
        id: Math.random().toString(36).substr(2, 9),
        name: newActivity.name || "Nouvelle Activité",
        day: selectedDays[0],
        days: selectedDays,
        startTime: noFixedHours ? "" : (newActivity.startTime || "18:00"),
        endTime: noFixedHours ? "" : (newActivity.endTime || "20:00"),
        noFixedHours: noFixedHours,
        location: newActivity.location || "Salle",
        startDate: newActivity.startDate || "2026-03-29"
      };
      await saveActivities([...activities, act]);
    }
    
    setIsAddModalOpen(false);
    setEditingActivityId(null);
    setNewActivity({ name: "", day: 0, startTime: "18:00", endTime: "20:00", location: "Salles Annexes", startDate: "2026-03-29" });
  };

  const calculateEngagement = (member: Member) => {
    let totalPossible = 0;
    let totalPresent = 0;
    
    activeActivitiesForPeriod.forEach(act => {
      const dates = filterElapsedDateKeys(activityDates[act.id] || []);
      const validDates = dates.filter(d => !member.dateEntree || d >= member.dateEntree);
      const nonCancelledDates = validDates.filter(d => !act.cancelledDates?.includes(d));
      totalPossible += nonCancelledDates.length;
      totalPresent += nonCancelledDates.filter(d => member.attendance[act.id]?.[d]).length;
    });
    
    return totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);
  };

  const stats = useMemo(() => {
    if (members.length === 0 || activeActivitiesForPeriod.length === 0) return null;

    let totalPoints = 0;
    let presentPoints = 0;
    const activityStats: Record<string, { present: number; total: number }> = {};

    activeActivitiesForPeriod.forEach(act => {
      activityStats[act.id] = { present: 0, total: 0 };
      const dates = filterElapsedDateKeys(activityDates[act.id] || []);
      
      members.forEach(member => {
        if (member.archived) return;
        
        dates.forEach(date => {
          if (member.dateEntree && date < member.dateEntree) return;
          if (act.cancelledDates?.includes(date)) return;
          
          totalPoints++;
          activityStats[act.id].total++;
          if (member.attendance[act.id]?.[date]) {
            presentPoints++;
            activityStats[act.id].present++;
          }
        });
      });
    });

    const globalRate = totalPoints === 0 ? 0 : Math.round((presentPoints / totalPoints) * 100);
    
    const activityRates = activeActivitiesForPeriod.map(act => ({
      name: act.name,
      rate: activityStats[act.id].total === 0 ? 0 : Math.round((activityStats[act.id].present / activityStats[act.id].total) * 100)
    })).sort((a, b) => b.rate - a.rate);

    const engagementLevels = {
      high: 0,   // > 80%
      medium: 0, // 50-80%
      low: 0     // < 50%
    };

    members.forEach(m => {
      const rate = calculateEngagement(m);
      if (rate >= 80) engagementLevels.high++;
      else if (rate >= 50) engagementLevels.medium++;
      else engagementLevels.low++;
    });

    return { globalRate, activityRates, engagementLevels };
  }, [members, activities, activityDates]);

  const isLeader = useMemo(() => {
    if (!userRole) return false;
    const role = userRole.toLowerCase().trim();
    return (
      role.includes("berger") || 
      role.includes("second") || 
      role.includes("responsable") || 
      role.includes("admin") || 
      role.includes("coordonnateur")
    );
  }, [userRole]);

  const filteredMembers = useMemo(() => {
    const searchLower = search.toLowerCase();
    let list = members.filter(m => !m.archived);

    // Privacy: Non-leaders only see themselves
    if (!isLeader && currentUserFullName) {
      list = list.filter(m => {
        const mFullName = `${m.firstName} ${m.lastName}`.toLowerCase();
        return mFullName === currentUserFullName.toLowerCase();
      });
    }

    // Filter by search query (bi-directional name matching)
    list = list.filter(m => {
      const fullName1 = `${m.firstName} ${m.lastName}`.toLowerCase();
      const fullName2 = `${m.lastName} ${m.firstName}`.toLowerCase();
      return fullName1.includes(searchLower) || fullName2.includes(searchLower);
    });
    
    // Sort by engagement descending (highest first). If equal, sort alphabetically by firstName (A-Z)
    return [...list].sort((a, b) => {
      const aEngagement = calculateEngagement(a);
      const bEngagement = calculateEngagement(b);
      
      if (bEngagement !== aEngagement) {
        return bEngagement - aEngagement;
      }
      
      return a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" });
    });
  }, [members, search, isLeader, currentUserFullName, activities, activityDates]);

  const activeMembersOnDate = useMemo(() => {
    return filteredMembers.filter(m => {
      if (m.dateEntree && selectedDate && selectedDate < m.dateEntree) return false;
      return true;
    });
  }, [filteredMembers, selectedDate]);

  const displayedMembers = useMemo(() => {
    const list = activeMembersOnDate.filter(m => {
      const isPresent = m.attendance[selectedActivityId || ""]?.[selectedDate] || false;
      if (presenceFilter === "present") return isPresent;
      if (presenceFilter === "absent") return !isPresent;
      return true;
    });

    // Sort: presents first (A-Z by firstName), then absents (A-Z by firstName)
    return list.sort((a, b) => {
      const aPresent = !!a.attendance[selectedActivityId || ""]?.[selectedDate];
      const bPresent = !!b.attendance[selectedActivityId || ""]?.[selectedDate];
      
      if (aPresent !== bPresent) {
        return aPresent ? -1 : 1;
      }
      
      return a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" });
    });
  }, [activeMembersOnDate, selectedActivityId, selectedDate, presenceFilter]);

  if (!isMounted || isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <div className="loader" style={{ marginBottom: 15 }}></div>
        Chargement des activités et des membres...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass" style={{ padding: 40, textAlign: "center", margin: 20 }}>
        <XCircle size={40} style={{ color: "var(--red)", marginBottom: 15, opacity: 0.5 }} />
        <h3 style={{ color: "var(--cream)", marginBottom: 10 }}>Oups !</h3>
        <p style={{ color: "var(--muted)" }}>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-in">
      {/* Page Header */}
      <div style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.12)", paddingBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #FFF, var(--gold-light) 60%, var(--gold) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            <Calendar size={28} className="text-[var(--gold)]" />
            Centre des Activités
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {attendanceViewMode === "by-activity" && activeTab === "attendance" 
              ? "Mode Appel : Sélectionnez une activité et cochez les présents" 
              : "Planification, présences et engagement des membres"}
          </p>
        </div>
        {isLeader && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} /> Planifier une Activité
          </button>
        )}
      </div>

      {/* Navigation Tabs & Period Selector */}
      <div className="activity-toolbar">
        <div className="activity-view-switcher">
          <button 
            className={`activity-view-option ${activeTab === "attendance" ? "active" : ""}`} 
            onClick={() => setActiveTab("attendance")} 
          >
            <span className="activity-view-icon"><Users size={18} /></span>
            <span className="activity-view-copy">
              <span className="activity-view-title">Appel</span>
              <span className="activity-view-subtitle">Cocher les presents</span>
            </span>
          </button>
          <button 
            className={`activity-view-option ${activeTab === "schedule" ? "active" : ""}`} 
            onClick={() => setActiveTab("schedule")} 
          >
            <span className="activity-view-icon"><Calendar size={18} /></span>
            <span className="activity-view-copy">
              <span className="activity-view-title">Calendrier</span>
              <span className="activity-view-subtitle">Planifier et modifier</span>
            </span>
          </button>
          {isLeader && (
            <button 
              className={`activity-view-option ${activeTab === "stats" ? "active" : ""}`} 
              onClick={() => setActiveTab("stats")} 
            >
              <span className="activity-view-icon"><BarChart3 size={18} /></span>
              <span className="activity-view-copy">
                <span className="activity-view-title">Statistiques</span>
                <span className="activity-view-subtitle">Engagement du mois</span>
              </span>
            </button>
          )}
        </div>

        <div className="glass activity-period-picker" style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 16px", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <Calendar size={14} className="text-[var(--gold)]" />
          <select className="input-minimal" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
            {displayedMonths.map(m => (
              <option key={m.index} value={m.index} style={{ background: "var(--bg)", color: "var(--cream)" }}>{m.name}</option>
            ))}
          </select>
          <select className="input-minimal" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {yearsRange.map(y => (
              <option key={y} value={y} style={{ background: "var(--bg)", color: "var(--cream)" }}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* View Mode Switcher */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="glass-compact" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, border: "1px solid rgba(212,175,55,0.08)" }}>
              <button 
                onClick={() => setAttendanceViewMode("by-activity")}
                style={{ 
                  padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700, transition: "all 0.3s",
                  background: attendanceViewMode === "by-activity" ? "var(--gold)" : "transparent",
                  color: attendanceViewMode === "by-activity" ? "var(--bg)" : "var(--muted)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}
              >
                <Users size={14} /> Faire l'Appel
              </button>
              <button 
                onClick={() => setAttendanceViewMode("by-member")}
                style={{ 
                  padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700, transition: "all 0.3s",
                  background: attendanceViewMode === "by-member" ? "var(--gold)" : "transparent",
                  color: attendanceViewMode === "by-member" ? "var(--bg)" : "var(--muted)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}
              >
                Suivi Global (Par Membre)
              </button>
            </div>
          </div>

          {attendanceViewMode === "by-activity" ? (
            /* BY ACTIVITY ROLL CALL VIEW */
            activeActivitiesForPeriod.length === 0 ? (
              <div className="glass" style={{ padding: 60, textAlign: "center", border: "1px solid rgba(212, 175, 55, 0.15)" }}>
                <Calendar size={48} className="text-[var(--gold)]" style={{ opacity: 0.2, margin: "0 auto 20px" }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--cream)", marginBottom: 10, fontFamily: "var(--font-display)" }}>
                  {activities.length === 0 ? "Aucune activité configurée" : "Aucune activité active"}
                </h3>
                <p style={{ color: "var(--muted)", marginBottom: 20 }}>
                  {activities.length === 0 
                    ? "Vous devez d'abord créer une activité (ex: Réunion de Bergerie) dans l'onglet Calendrier."
                    : "Toutes les activités configurées commencent à une date ultérieure à ce mois."}
                </p>
                {activities.length === 0 && (
                  <button className="btn btn-primary mx-auto" onClick={() => setActiveTab("schedule")}>
                    <Calendar size={14} /> Aller au Calendrier
                  </button>
                )}
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="glass" style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, alignItems: "end", border: "1px solid rgba(212, 175, 55, 0.15)" }}>
                <div>
                   <label className="form-label" style={{ marginBottom: 8 }}>Activité</label>
                   <select 
                     className="input w-full" 
                     value={selectedActivityId || ""} 
                     onChange={(e) => {
                       const id = e.target.value;
                       setSelectedActivityId(id);
                       if (activityDates[id]?.length > 0) {
                         setSelectedDate(activityDates[id][0]);
                       }
                     }}
                     style={{ height: 42 }}
                   >
                     {activeActivitiesForPeriod.map(a => <option key={a.id} value={a.id} style={{ background: "var(--bg)", color: "var(--cream)" }}>{a.name}</option>)}
                   </select>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Date de la séance</span>
                    {isLeader && selectedDate && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedActivityId || !activeActivity) return;
                          const currentCancelled = activeActivity.cancelledDates || [];
                          const isAlreadyCancelled = currentCancelled.includes(selectedDate);
                          
                          let newCancelled: string[];
                          if (isAlreadyCancelled) {
                            newCancelled = currentCancelled.filter(d => d !== selectedDate);
                          } else {
                            if (!window.confirm(`Voulez-vous vraiment annuler la séance du ${formatDate(selectedDate)} ?`)) return;
                            newCancelled = [...currentCancelled, selectedDate];
                          }
                          
                          const updatedActs = activities.map(act => {
                            if (act.id !== selectedActivityId) return act;
                            return { ...act, cancelledDates: newCancelled };
                          });
                          
                          await saveActivities(updatedActs);
                        }}
                        style={{
                          fontSize: 10,
                          background: activeActivity?.cancelledDates?.includes(selectedDate) ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: activeActivity?.cancelledDates?.includes(selectedDate) ? "var(--green)" : "var(--red)",
                          border: `1px solid ${activeActivity?.cancelledDates?.includes(selectedDate) ? "var(--green)" : "var(--red)"}`,
                          padding: "2px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {activeActivity?.cancelledDates?.includes(selectedDate) ? "Réactiver la séance" : "Annuler cette date"}
                      </button>
                    )}
                  </label>
                  <select 
                    className="input w-full" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ 
                      height: 42,
                      borderColor: activeActivity?.cancelledDates?.includes(selectedDate) ? "rgba(239, 68, 68, 0.4)" : "var(--border)",
                      color: activeActivity?.cancelledDates?.includes(selectedDate) ? "var(--red)" : "var(--cream)"
                    }}
                  >
                    {(activityDates[selectedActivityId || ""] || []).map(d => {
                      const isCancelled = activeActivity?.cancelledDates?.includes(d);
                      return (
                        <option key={d} value={d} style={{ background: "var(--bg)", color: isCancelled ? "var(--red)" : "var(--cream)" }}>
                          {formatDate(d)}{isCancelled ? " ⚠️ (ANNULÉ)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ position: "relative" }}>
                  <label className="form-label" style={{ marginBottom: 8 }}>Rechercher un membre</label>
                  <div className="relative">
                    <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--cream-dim)" }} />
                    <input className="input w-full search-bar-premium" placeholder="Filtrer la liste..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Statut de présence</label>
                  <select 
                    className="input w-full" 
                    value={presenceFilter} 
                    onChange={(e) => setPresenceFilter(e.target.value as any)}
                    style={{ height: 42 }}
                  >
                    <option value="all" style={{ background: "var(--bg)", color: "var(--cream)" }}>Tous</option>
                    <option value="present" style={{ background: "var(--bg)", color: "var(--cream)" }}>Présents</option>
                    <option value="absent" style={{ background: "var(--bg)", color: "var(--cream)" }}>Absents</option>
                  </select>
                </div>
              </div>

              {activeActivity?.cancelledDates?.includes(selectedDate) ? (
                <div className="glass" style={{ padding: "48px 24px", textAlign: "center", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.02)" }}>
                  <AlertTriangle size={48} className="text-[var(--red)]" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>Séance Annulée</h3>
                  <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                    Cette séance a été annulée pour le <strong>{formatDate(selectedDate)}</strong>. Elle est exclue de tous les calculs d'assiduité et d'engagement des membres.
                  </p>
                  {isLeader && (
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ color: "var(--green)", borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.05)", margin: "0 auto" }}
                      onClick={async () => {
                        if (!selectedActivityId || !activeActivity) return;
                        const currentCancelled = activeActivity.cancelledDates || [];
                        const updatedActs = activities.map(act => {
                          if (act.id !== selectedActivityId) return act;
                          return { ...act, cancelledDates: currentCancelled.filter(d => d !== selectedDate) };
                        });
                        await saveActivities(updatedActs);
                      }}
                    >
                      <CheckCircle2 size={12} className="text-[var(--green)]" /> Réactiver cette Séance
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Stats & Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                      {presenceFilter === "absent" ? "Absences : " : "Présences : "}
                      <span className={presenceFilter === "absent" ? "text-[var(--red)]" : "text-[var(--green)]"} style={{ fontWeight: 800 }}>
                        {presenceFilter === "absent" 
                          ? activeMembersOnDate.filter(m => !m.attendance[selectedActivityId || ""]?.[selectedDate]).length
                          : activeMembersOnDate.filter(m => m.attendance[selectedActivityId || ""]?.[selectedDate]).length
                        }
                      </span> sur <span style={{ color: "var(--cream)" }}>{activeMembersOnDate.length}</span> fidèles
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button 
                        className="btn btn-subtle btn-sm" 
                        style={{ fontSize: 11, height: 32 }}
                        onClick={() => handleBatchAttendance(true)}
                      >
                        <CheckCircle2 size={12} className="text-[var(--green)]" /> Tous Présents
                      </button>
                      <button 
                        className="btn btn-subtle btn-sm" 
                        style={{ fontSize: 11, height: 32, border: "1px solid rgba(255, 100, 100, 0.15)", color: "var(--red)" }}
                        onClick={() => handleBatchAttendance(false)}
                      >
                        <XCircle size={12} className="text-[var(--red)]" /> Tout effacer
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {displayedMembers.map(m => {
                      const isPresent = m.attendance[selectedActivityId || ""]?.[selectedDate] || false;
                      const comment = m.attendance["_comments"]?.[selectedActivityId || ""]?.[selectedDate] || "";
                      return (
                        <div 
                          key={m.id} 
                          className={`arch-card glass activity-attendance-card ${isPresent ? "is-present hover-glow" : "is-absent"}`}
                          onClick={() => toggleAttendance(m.id, selectedActivityId!, selectedDate)}
                          style={{ 
                            padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12, 
                            cursor: "pointer", transition: "all 0.3s ease",
                            border: isPresent ? "1px solid rgba(0, 255, 136, 0.35)" : "1px solid rgba(212, 175, 55, 0.15)",
                            background: isPresent ? "rgba(0, 255, 136, 0.04)" : "var(--card)",
                            boxShadow: isPresent ? "0 0 20px rgba(0, 255, 136, 0.08)" : "none"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div className="avatar" style={{ 
                                width: 36, height: 36, fontSize: 12, fontWeight: 700,
                                background: isPresent ? "rgba(0, 200, 100, 0.18)" : "linear-gradient(135deg, #171412, #4d443d)",
                                border: `1px solid ${isPresent ? "var(--green)" : "rgba(212,175,55,0.2)"}`,
                                color: "#fffaf4",
                                WebkitTextFillColor: "#fffaf4"
                              }}>
                                {m.firstName[0]}{m.lastName[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: isPresent ? "var(--cream)" : "var(--cream-dim)" }}>{m.firstName} {m.lastName}</div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                  Assiduité: <span style={{ color: "var(--gold-light)", fontWeight: 700 }}>{calculateEngagement(m)}%</span>
                                </div>
                              </div>
                            </div>
                            <div className={`attendance-switch ${isPresent ? "is-on" : ""}`} style={{ 
                              width: 46, height: 22, borderRadius: 11, position: "relative",
                              background: isPresent
                                ? "linear-gradient(180deg, rgba(143, 166, 147, 0.95), rgba(85, 115, 60, 0.9))"
                                : "linear-gradient(180deg, rgba(221, 223, 224, 0.24), rgba(221, 223, 224, 0.12))",
                              transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                              border: `1px solid ${isPresent ? "rgba(143, 166, 147, 0.72)" : "rgba(221, 223, 224, 0.42)"}`,
                              boxShadow: isPresent
                                ? "0 0 0 1px rgba(143, 166, 147, 0.18), 0 8px 18px rgba(0,0,0,0.28)"
                                : "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 18px rgba(0,0,0,0.24)"
                            }}>
                              <div className="attendance-switch-knob" style={{ 
                                position: "absolute", top: 2, left: isPresent ? 26 : 2,
                                width: 16, height: 16, borderRadius: "50%",
                                background: isPresent ? "#f0f1f1" : "#f7f3ec",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.32)",
                                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                              }} />
                            </div>
                          </div>

                          {/* Comment section */}
                          {!isPresent && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }} onClick={e => e.stopPropagation()}>
                              <div style={{ fontSize: 10, color: "var(--gold-light)", fontWeight: 600 }}>Motif d'absence (ex: Maladie, Voyage, Travail)</div>
                              <input 
                                className="input"
                                value={comment}
                                onChange={e => saveAttendanceComment(m.id, selectedActivityId!, selectedDate, e.target.value)}
                                placeholder="Renseigner le motif d'absence..."
                                style={{ 
                                  height: 32, 
                                  fontSize: 11,
                                  background: "var(--bg-deep)",
                                  borderColor: "rgba(212, 175, 55, 0.15)",
                                  padding: "4px 10px",
                                  width: "100%",
                                  color: "var(--cream)",
                                  outline: "none",
                                  transition: "border-color 0.2s"
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )
        ) : (
          /* BY MEMBER GRID VIEW (ORIGINAL) */
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {/* Controls */}
              <div className="glass-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--cream-dim)" }} />
              <input className="input search-bar-premium" placeholder="Rechercher un membre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
          </div>

          {/* Member List for Attendance */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.length === 0 && (
              <div className="glass" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                Aucun membre trouvé dans cette bergerie.
              </div>
            )}
            {activeActivitiesForPeriod.length === 0 && members.length > 0 && (
              <div className="glass" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                {activities.length === 0 
                  ? "Créez d'abord une activité dans l'onglet Calendrier pour gérer les présences." 
                  : "Aucune activité n'est active pour le mois sélectionné."}
              </div>
            )}
            {filteredMembers.map(m => {
              // Final check for non-leaders: can only see themselves
              // Final check for non-leaders: can only see themselves
              if (!isLeader && currentUserFullName) {
                const mFullName = `${m.firstName} ${m.lastName}`.toLowerCase();
                if (mFullName !== currentUserFullName.toLowerCase()) return null;
              }
              
              const engagement = calculateEngagement(m);
              const color = engagement >= 75 ? "var(--green)" : engagement >= 45 ? "var(--orange)" : "var(--red)";
              const isExpanded = expandedMemberId === m.id;

              return (
                <div key={m.id} className="glass-flush" style={{ overflow: "hidden" }}>
                  <div 
                    onClick={() => setExpandedMemberId(isExpanded ? null : m.id)}
                    style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                      <div className="avatar" style={{ width: 36, height: 36, background: "linear-gradient(135deg, #171412, #4d443d)", border: `1px solid ${color}`, color: "#fffaf4", WebkitTextFillColor: "#fffaf4" }}>
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{m.firstName} {m.lastName}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.status} · Engagement: <span style={{ color: color, fontWeight: 700 }}>{engagement}%</span></div>
                      </div>
                    </div>
                    <div style={{ color: "var(--muted)" }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "var(--bg-deep)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 15 }}>
                        {activeActivitiesForPeriod.map(act => {
                          const dates = filterElapsedDateKeys(activityDates[act.id] || []);
                          const nonCancelledDates = dates.filter(d => !act.cancelledDates?.includes(d));
                          const presentCount = nonCancelledDates.filter(d => m.attendance[act.id]?.[d]).length;
                          const rate = nonCancelledDates.length === 0 ? 0 : Math.round((presentCount / nonCancelledDates.length) * 100);
                          const rateColor = rate >= 75 ? "var(--green)" : rate >= 45 ? "var(--gold)" : "var(--red)";

                          return (
                            <div key={act.id} className="glass-compact" style={{ background: "var(--surface)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{act.name}</div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: rateColor, padding: "2px 6px", background: "var(--bg-deep)", borderRadius: 4 }}>{rate}%</div>
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                                    {act.noFixedHours 
                                      ? `Horaires variables · ${act.location}` 
                                      : `${act.startTime} - ${act.endTime} · ${act.location}`
                                    }
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {nonCancelledDates.filter(d => !m.dateEntree || d >= m.dateEntree).map(date => {
                                  const isPresent = m.attendance[act.id]?.[date];
                                  const comment = m.attendance["_comments"]?.[act.id]?.[date] || "";

                                  return (
                                    <div 
                                      key={date}
                                      onClick={() => toggleAttendance(m.id, act.id, date)}
                                      style={{ 
                                        width: 28, height: 28, borderRadius: 6, fontSize: 9,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", transition: "all 0.2s",
                                        background: isPresent ? "var(--green-glow)" : "var(--bg-deep)",
                                        border: comment 
                                          ? "1.5px solid var(--gold)" 
                                          : `1px solid ${isPresent ? "var(--green)" : "var(--border)"}`,
                                        color: isPresent ? "var(--green)" : (comment ? "var(--gold-light)" : "var(--muted)"),
                                        position: "relative"
                                      }}
                                      title={`${date}${comment ? `\nNote : ${comment}` : ""}`}
                                    >
                                      {date.split('-')[2]}
                                      {comment && (
                                        <span style={{ 
                                          position: "absolute", top: 2, right: 2, 
                                          width: 4, height: 4, borderRadius: "50%", 
                                          background: "var(--gold)" 
                                        }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 }}>
          {activities.length === 0 ? (
            <div className="glass" style={{ gridColumn: "1/-1", padding: 60, textAlign: "center" }}>
              <Calendar size={48} style={{ color: "var(--gold)", opacity: 0.2, marginBottom: 20 }} />
              <h3 style={{ color: "var(--cream)", marginBottom: 10 }}>Aucune activité planifiée</h3>
              <p style={{ color: "var(--muted)", marginBottom: 20 }}>Commencez par ajouter les activités de votre bergerie.</p>
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={14} /> Ajouter une activité
              </button>
            </div>
          ) : (
            activities.map(act => (
              <div key={act.id} className="glass" style={{ position: "relative", padding: 20 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--gold)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>{act.name}</h3>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button 
                      className="btn-icon" 
                      onClick={() => {
                        setEditingActivityId(act.id);
                        setNewActivity({
                          name: act.name,
                          location: act.location,
                          startTime: act.startTime,
                          endTime: act.endTime,
                          startDate: act.startDate || "2026-03-29"
                        });
                        setSelectedDays(act.days && act.days.length > 0 ? act.days : [act.day]);
                        setNoFixedHours(!!act.noFixedHours);
                        setIsAddModalOpen(true);
                      }}
                    >
                      <Pencil size={14} style={{ color: "var(--gold-light)" }} />
                    </button>
                    <button className="btn-icon" onClick={() => saveActivities(activities.filter(a => a.id !== act.id))}>
                      <Trash2 size={14} style={{ color: "var(--red)" }} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                    <Calendar size={14} style={{ color: "var(--gold)" }} />
                    <span>{getDaysLabel(act)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                    <Clock size={14} style={{ color: "var(--gold)" }} />
                    <span>{act.noFixedHours ? "Horaires variables / Sans heure fixe" : `${act.startTime} - ${act.endTime}`}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                    <MapPin size={14} style={{ color: "var(--gold)" }} />
                    <span>{act.location}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {!stats ? (
            <div className="glass" style={{ padding: 60, textAlign: "center" }}>
              <BarChart3 size={48} style={{ color: "var(--gold)", opacity: 0.3, marginBottom: 20 }} />
              <h3 style={{ color: "var(--cream)", marginBottom: 10 }}>Données insuffisantes</h3>
              <p style={{ color: "var(--muted)" }}>Ajoutez des activités et marquez des présences pour voir les statistiques.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Dashboard Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: "clamp(10px, 2vw, 15px)" }}>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--gold)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Taux Global</div>
                    <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: "var(--gold)" }}>{Math.round(stats.globalRate)}%</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Assiduité moyenne</div>
                  </div>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--green)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Engagement Élevé</div>
                    <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: "var(--green)" }}>{stats.engagementLevels.high}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Membres actifs ({">"}80%)</div>
                  </div>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--red)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Attention Requise</div>
                    <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: "var(--red)" }}>{stats.engagementLevels.low}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Engagement faible ({"<"}50%)</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "clamp(12px, 2vw, 20px)" }}>
                  {/* Activities Performance */}
                  <div className="glass" style={{ padding: 25 }}>
                    <h3 style={{ fontSize: 15, color: "var(--cream)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                      <TrendingUp size={18} style={{ color: "var(--gold)" }} /> Performance par Activité
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {stats.activityRates.map((act, i) => {
                        const rate = act.rate;
                        return (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                              <span style={{ color: "var(--cream)", fontWeight: 500 }}>{act.name}</span>
                              <span style={{ fontWeight: 700, color: rate > 70 ? "var(--green)" : rate > 40 ? "var(--gold)" : "var(--red)" }}>{Math.round(rate)}%</span>
                            </div>
                            <div style={{ height: 8, background: "var(--bg-deep)", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ 
                                height: "100%", 
                                width: `${rate}%`, 
                                background: rate > 70 ? "var(--green)" : rate > 40 ? "var(--gold)" : "var(--red)",
                                boxShadow: `0 0 10px ${rate > 70 ? "rgba(0,255,136,0.3)" : rate > 40 ? "rgba(255,215,0,0.2)" : "rgba(255,100,100,0.2)"}`,
                                transition: "width 1s ease-out"
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>


                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Activity Modal */}
      {typeof window !== "undefined" && isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
              <h2 style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "var(--gold)" }}>
                {editingActivityId ? "Modifier l'Activité" : "Nouvelle Activité"}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="btn-icon"><XCircle size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveActivity} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label className="label">NOM DE L'ACTIVITÉ (Texte)</label>
                <input className="input" required value={newActivity.name} onChange={e => setNewActivity({...newActivity, name: e.target.value})} placeholder="Réunion de prière, Séminaire..." />
              </div>

              <div>
                <label className="label">Jours de la semaine</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d, i) => {
                    const isSelected = selectedDays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (selectedDays.includes(i)) {
                            if (selectedDays.length > 1) {
                              setSelectedDays(selectedDays.filter(day => day !== i));
                            }
                          } else {
                            setSelectedDays([...selectedDays, i]);
                          }
                        }}
                        style={{
                          height: 38,
                          padding: "0 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: isSelected ? "var(--gold)" : "var(--bg-deep)",
                          color: isSelected ? "var(--bg)" : "var(--muted)",
                          border: `1px solid ${isSelected ? "transparent" : "rgba(212,175,55,0.15)"}`
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  id="noFixedHours" 
                  checked={noFixedHours} 
                  onChange={e => setNoFixedHours(e.target.checked)} 
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--gold)" }}
                />
                <label htmlFor="noFixedHours" style={{ fontSize: 12, color: "var(--cream-dim)", cursor: "pointer", userSelect: "none" }}>
                  Sans horaire fixe (heures variables)
                </label>
              </div>

              {!noFixedHours && (
                <div className="form-grid-2">
                  <div>
                    <label className="label">Heure de début</label>
                    <input className="input" type="time" value={newActivity.startTime} onChange={e => setNewActivity({...newActivity, startTime: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Heure de fin</label>
                    <input className="input" type="time" value={newActivity.endTime} onChange={e => setNewActivity({...newActivity, endTime: e.target.value})} />
                  </div>
                </div>
              )}

              <div>
                <label className="label">LIEU</label>
                <input className="input" value={newActivity.location} onChange={e => setNewActivity({...newActivity, location: e.target.value})} placeholder="Temple, Salle A..." />
              </div>

              <div>
                <label className="label">Date de début de l'activité</label>
                <input 
                  className="input" 
                  type="date" 
                  value={newActivity.startDate || "2026-03-29"} 
                  onChange={e => setNewActivity({...newActivity, startDate: e.target.value})} 
                />
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">
                  {editingActivityId ? "Enregistrer les modifications" : "Enregistrer l'activité"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .label {
          font-size: 11px; color: var(--muted); display: block; margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .input-minimal {
          background: transparent; border: none; color: var(--on-light);
          font-size: 13px; font-weight: 600; cursor: pointer; outline: none;
          padding: 2px 4px; border-radius: 4px;
        }
        .input-minimal:hover { background: rgba(35, 29, 25, 0.06); }
        .input-minimal option { background: #fffaf4; color: var(--on-light); }
      `}</style>
    </div>
  );
}
