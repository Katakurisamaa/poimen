"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Calendar, Clock, MapPin, ChevronRight, XCircle, 
  Search, CheckCircle2, List, Grid3X3, Users, BarChart3,
  ChevronDown, ChevronUp, MoreHorizontal, Trash2,
  AlertTriangle, TrendingUp
} from "lucide-react";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "@/types";
import type { ActivityType } from "@/types";

// Types
interface Activity {
  id: string;
  name: string;
  day: number; // 0 for Sunday, 4 for Thursday, etc.
  startTime: string;
  endTime: string;
  location: string;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  civility: string;
  status: string;
  isInvite?: boolean;
  attendance: Record<string, Record<string, boolean>>; // activityId -> dateString -> present
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
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBergerieId, setUserBergerieId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserFullName, setCurrentUserFullName] = useState<string | null>(null);

  // Load activities from localStorage and members from Supabase
  useEffect(() => {
    const init = async () => {
      try {
        const userInfoStr = localStorage.getItem("poimen_user_info");
        if (!userInfoStr) {
          setError("Session expirée ou non connectée.");
          setIsLoading(false);
          setIsMounted(true);
          return;
        }
        
        const userInfo = JSON.parse(userInfoStr);
        setCurrentUserEmail(userInfo.email);
        setCurrentUserFullName(`${userInfo.lastName || ""} ${userInfo.firstName || ""}`.trim());

        // 1. Fetch Profile and Role
        const { data: profile, error: profError } = await supabase
          .from("members")
          .select("bergerie_id, status")
          .eq("email", userInfo.email)
          .single();

        if (profError || !profile?.bergerie_id) {
          setError("Vous n'êtes affecté à aucune bergerie.");
          setIsLoading(false);
          setIsMounted(true);
          return;
        }
        
        const bergerieId = profile.bergerie_id;
        setUserBergerieId(bergerieId);
        setUserRole(profile.status);

        // 2. Load Activities (Priority to DB if we implement it later, but for now localStorage)
        const savedActivities = localStorage.getItem("local_activities");
        let loadedActivities: Activity[] = [];
        if (savedActivities) {
          try {
            loadedActivities = JSON.parse(savedActivities);
          } catch (e) {
            console.error("Local activities parse error", e);
          }
        }
        
        // If no activities, use defaults
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
          attendance: m.attendance || {}
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

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("local_activities", JSON.stringify(activities));
    }
  }, [activities, isMounted]);

  // Ensure selectedActivityId is initialized if activities exist
  useEffect(() => {
    if (activities.length > 0 && !selectedActivityId) {
      setSelectedActivityId(activities[0].id);
    }
  }, [activities, selectedActivityId]);

  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    name: "",
    day: 0,
    startTime: "18:00",
    endTime: "20:00",
    location: "Salles Annexes"
  });

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

  const activityDates = useMemo(() => {
    const map: Record<string, string[]> = {};
    activities.forEach(act => {
      map[act.id] = getDaysOfMonth(selectedYear, selectedMonth, act.day);
    });
    return map;
  }, [activities, selectedMonth, selectedYear]);

  // Handle default date for By Activity mode
  useEffect(() => {
    if (selectedActivityId && activityDates[selectedActivityId]?.length > 0) {
      // If current selectedDate is not in the new dates list, pick the first one
      if (!activityDates[selectedActivityId].includes(selectedDate)) {
        setSelectedDate(activityDates[selectedActivityId][0]);
      }
    }
  }, [selectedActivityId, activityDates, selectedDate]);

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

  const handleBatchAttendance = async (present: boolean) => {
    if (!selectedActivityId || !selectedDate) return;
    
    // 1. Optimistic local update
    const updatedMembers = members.map(m => {
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

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const act: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      name: newActivity.name || "Nouvelle Activité",
      day: Number(newActivity.day),
      startTime: newActivity.startTime || "18:00",
      endTime: newActivity.endTime || "20:00",
      location: newActivity.location || "Salle"
    };
    setActivities([...activities, act]);
    setIsAddModalOpen(false);
    setNewActivity({ name: "", day: 0, startTime: "18:00", endTime: "20:00", location: "Salles Annexes" });
  };

  const calculateEngagement = (member: Member) => {
    let totalPossible = 0;
    let totalPresent = 0;
    
    activities.forEach(act => {
      const dates = activityDates[act.id] || [];
      totalPossible += dates.length;
      totalPresent += dates.filter(d => member.attendance[act.id]?.[d]).length;
    });
    
    return totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);
  };

  const stats = useMemo(() => {
    if (members.length === 0 || activities.length === 0) return null;

    let totalPoints = 0;
    let presentPoints = 0;
    const activityStats: Record<string, { present: number; total: number }> = {};

    activities.forEach(act => {
      activityStats[act.id] = { present: 0, total: 0 };
      const dates = activityDates[act.id] || [];
      
      members.forEach(member => {
        dates.forEach(date => {
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
    
    const activityRates = activities.map(act => ({
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
    return role === "berger" || role.includes("second") || role === "super_admin" || role === "coordonnateur";
  }, [userRole]);

  const filteredMembers = useMemo(() => {
    const searchLower = search.toLowerCase();
    const list = members.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchLower));
    
    // Privacy: Non-leaders only see themselves
    if (!isLeader && currentUserEmail) {
      return list; 
    }
    return list;
  }, [members, search, isLeader, currentUserEmail]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Centre des Activités</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {attendanceViewMode === "by-activity" && activeTab === "attendance" 
              ? "Mode Appel : Sélectionnez une activité et cochez les présents" 
              : "Planification, présences et engagement des membres"}
          </p>
        </div>
        {isLeader && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} /> Nouvelle Activité
          </button>
        )}
      </div>

      {/* Navigation Tabs & Period Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 15 }}>
        <div className="glass-compact" style={{ display: "flex", gap: 8, padding: 6, width: "fit-content" }}>
          <button 
            className={`pill ${activeTab === "attendance" ? "pill-active" : "pill-inactive"}`} 
            onClick={() => setActiveTab("attendance")} 
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Users size={14} /> Appel
          </button>
          <button 
            className={`pill ${activeTab === "schedule" ? "pill-active" : "pill-inactive"}`} 
            onClick={() => setActiveTab("schedule")} 
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Calendar size={14} /> Calendrier
          </button>
          {isLeader && (
            <button 
              className={`pill ${activeTab === "stats" ? "pill-active" : "pill-inactive"}`} 
              onClick={() => setActiveTab("stats")} 
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <BarChart3 size={14} /> Statistiques
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "6px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
          <Calendar size={14} style={{ color: "var(--gold)" }} />
          <select className="input-minimal" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
            {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select className="input-minimal" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {/* View Mode Switcher */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="glass-compact" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12 }}>
              <button 
                onClick={() => setAttendanceViewMode("by-activity")}
                style={{ 
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, transition: "all 0.3s",
                  background: attendanceViewMode === "by-activity" ? "var(--gold)" : "transparent",
                  color: attendanceViewMode === "by-activity" ? "black" : "var(--muted)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}
              >
                <Users size={14} /> Faire l'Appel
              </button>
              <button 
                onClick={() => setAttendanceViewMode("by-member")}
                style={{ 
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, transition: "all 0.3s",
                  background: attendanceViewMode === "by-member" ? "var(--gold)" : "transparent",
                  color: attendanceViewMode === "by-member" ? "black" : "var(--muted)",
                  border: "none", cursor: "pointer"
                }}
              >
                Suivi Global (Par Membre)
              </button>
            </div>
          </div>

          {attendanceViewMode === "by-activity" ? (
            /* BY ACTIVITY ROLL CALL VIEW */
            activities.length === 0 ? (
              <div className="glass" style={{ padding: 60, textAlign: "center" }}>
                <Calendar size={48} style={{ color: "var(--gold)", opacity: 0.2, marginBottom: 20 }} />
                <h3 style={{ color: "var(--cream)", marginBottom: 10 }}>Aucune activité configurée</h3>
                <p style={{ color: "var(--muted)", marginBottom: 20 }}>Vous devez d'abord créer une activité (ex: Réunion de Bergerie) dans l'onglet Calendrier.</p>
                <button className="btn btn-primary" onClick={() => setActiveTab("schedule")}>
                  <Calendar size={14} /> Aller au Calendrier
                </button>
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="glass" style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15, alignItems: "end" }}>
                <div>
                  <label className="label">ACTIVITÉ</label>
                  <select 
                    className="input" 
                    value={selectedActivityId || ""} 
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedActivityId(id);
                      if (activityDates[id]?.length > 0) {
                        setSelectedDate(activityDates[id][0]);
                      }
                    }}
                  >
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">DATE DE LA SÉANCE</label>
                  <select 
                    className="input" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                  >
                    {(activityDates[selectedActivityId || ""] || []).map(d => (
                      <option key={d} value={d}>{formatDate(d)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ position: "relative" }}>
                  <label className="label">RECHERCHER UN MEMBRE</label>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 38, color: "var(--muted)" }} />
                  <input className="input" placeholder="Filtrer la liste..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
                </div>
              </div>

              {/* Stats & Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px" }}>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>
                    {members.filter(m => m.attendance[selectedActivityId || ""]?.[selectedDate]).length}
                  </span> / {members.length} présents
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ fontSize: 11, padding: "6px 12px" }}
                    onClick={() => handleBatchAttendance(true)}
                  >
                    <CheckCircle2 size={12} /> Marquer tous présents
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ fontSize: 11, padding: "6px 12px", borderColor: "rgba(255, 100, 100, 0.3)", color: "var(--red)" }}
                    onClick={() => handleBatchAttendance(false)}
                  >
                    <XCircle size={12} /> Tout démarquer
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filteredMembers.map(m => {
                  // Final check for non-leaders: can only see themselves
                  // Final check for non-leaders: can only see themselves
                  if (!isLeader && currentUserFullName) {
                    const mFullName = `${m.lastName} ${m.firstName}`.toLowerCase();
                    if (mFullName !== currentUserFullName.toLowerCase()) return null;
                  }
                  
                  const isPresent = m.attendance[selectedActivityId || ""]?.[selectedDate] || false;
                  return (
                    <div 
                      key={m.id} 
                      className="glass" 
                      onClick={() => toggleAttendance(m.id, selectedActivityId!, selectedDate)}
                      style={{ 
                        padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", 
                        cursor: "pointer", transition: "all 0.2s",
                        border: `1px solid ${isPresent ? "var(--green)" : "var(--border)"}`,
                        background: isPresent ? "rgba(0, 255, 136, 0.05)" : "rgba(255,255,255,0.02)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="avatar" style={{ 
                          width: 32, height: 32, 
                          background: isPresent ? "var(--green-glow)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${isPresent ? "var(--green)" : "var(--border)"}`,
                          color: isPresent ? "var(--green)" : "var(--muted)"
                        }}>
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: isPresent ? "var(--cream)" : "var(--muted)" }}>{m.lastName} {m.firstName}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>Engagement: {calculateEngagement(m)}%</div>
                        </div>
                      </div>
                      <div style={{ 
                        width: 44, height: 22, borderRadius: 11, position: "relative",
                        background: isPresent ? "var(--green)" : "rgba(255,255,255,0.08)",
                        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        border: `1px solid ${isPresent ? "transparent" : "var(--border)"}`
                      }}>
                        <div style={{ 
                          position: "absolute", top: 2, left: isPresent ? 24 : 2,
                          width: 16, height: 16, borderRadius: "50%", background: "white",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3)", transition: "all 0.3s"
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* BY MEMBER GRID VIEW (ORIGINAL) */
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {/* Controls */}
              <div className="glass-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input className="input" placeholder="Rechercher un membre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
            </div>
          </div>

          {/* Member List for Attendance */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.length === 0 && (
              <div className="glass" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                Aucun membre trouvé dans cette bergerie.
              </div>
            )}
            {activities.length === 0 && members.length > 0 && (
              <div className="glass" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                Créez d'abord une activité dans l'onglet Calendrier pour gérer les présences.
              </div>
            )}
            {filteredMembers.map(m => {
              // Final check for non-leaders: can only see themselves
              // Final check for non-leaders: can only see themselves
              if (!isLeader && currentUserFullName) {
                const mFullName = `${m.lastName} ${m.firstName}`.toLowerCase();
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
                      <div className="avatar" style={{ width: 36, height: 36, background: color.replace(')', '-glow)'), border: `1px solid ${color}`, color: color }}>
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{m.lastName} {m.firstName}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.status} · Engagement: <span style={{ color: color, fontWeight: 700 }}>{engagement}%</span></div>
                      </div>
                    </div>
                    <div style={{ color: "var(--muted)" }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 15 }}>
                        {activities.map(act => {
                          const dates = activityDates[act.id] || [];
                          const presentCount = dates.filter(d => m.attendance[act.id]?.[d]).length;
                          const rate = dates.length === 0 ? 0 : Math.round((presentCount / dates.length) * 100);
                          const rateColor = rate >= 75 ? "var(--green)" : rate >= 45 ? "var(--gold)" : "var(--red)";

                          return (
                            <div key={act.id} className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{act.name}</div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: rateColor, padding: "2px 6px", background: "rgba(0,0,0,0.2)", borderRadius: 4 }}>{rate}%</div>
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{act.startTime} - {act.endTime} · {act.location}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {dates.map(date => (
                                    <div 
                                      key={date}
                                      onClick={() => toggleAttendance(m.id, act.id, date)}
                                      style={{ 
                                        width: 28, height: 28, borderRadius: 6, fontSize: 9,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", transition: "all 0.2s",
                                        background: m.attendance[act.id]?.[date] ? "var(--green-glow)" : "rgba(255,255,255,0.05)",
                                        border: `1px solid ${m.attendance[act.id]?.[date] ? "var(--green)" : "var(--border)"}`,
                                        color: m.attendance[act.id]?.[date] ? "var(--green)" : "var(--muted)"
                                      }}
                                      title={date}
                                    >
                                      {date.split('-')[2]}
                                    </div>
                                ))}
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
                  <button className="btn-icon" onClick={() => setActivities(activities.filter(a => a.id !== act.id))}>
                    <Trash2 size={14} style={{ color: "var(--red)" }} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                    <Calendar size={14} style={{ color: "var(--gold)" }} />
                    <span>Tous les {["Dimanches", "Lundis", "Mardis", "Mercredis", "Jeudis", "Vendredis", "Samedis"][act.day]}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                    <Clock size={14} style={{ color: "var(--gold)" }} />
                    <span>{act.startTime} - {act.endTime}</span>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--gold)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Taux Global</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>{Math.round(stats.globalRate)}%</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Assiduité moyenne</div>
                  </div>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--green)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Engagement Élevé</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)" }}>{stats.engagementLevels.high}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Membres actifs ({">"}80%)</div>
                  </div>
                  <div className="glass" style={{ padding: 20, textAlign: "center", borderTop: "3px solid var(--red)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Attention Requise</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "var(--red)" }}>{stats.engagementLevels.low}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Engagement faible ({"<"}50%)</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>
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
                            <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
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
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
              <h2 style={{ fontSize: 20, color: "var(--gold)" }}>Nouvelle Activité</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="btn-icon"><XCircle size={20} /></button>
            </div>
            
            <form onSubmit={handleAddActivity} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label className="label">NOM DE L'ACTIVITÉ (Texte)</label>
                <input className="input" required value={newActivity.name} onChange={e => setNewActivity({...newActivity, name: e.target.value})} placeholder="Réunion de prière, Séminaire..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 15 }}>
                <div>
                  <label className="label">JOUR DE LA SEMAINE</label>
                  <select className="input" value={newActivity.day} onChange={e => setNewActivity({...newActivity, day: parseInt(e.target.value)})}>
                    {["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                <div>
                  <label className="label">HEURE DE DÉBUT</label>
                  <input className="input" type="time" value={newActivity.startTime} onChange={e => setNewActivity({...newActivity, startTime: e.target.value})} />
                </div>
                <div>
                  <label className="label">HEURE DE FIN</label>
                  <input className="input" type="time" value={newActivity.endTime} onChange={e => setNewActivity({...newActivity, endTime: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="label">LIEU</label>
                <input className="input" value={newActivity.location} onChange={e => setNewActivity({...newActivity, location: e.target.value})} placeholder="Temple, Salle A..." />
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer l'activité</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
          z-index: 1000; display: flex; alignItems: center; justifyContent: center;
          padding: 20px;
        }
        .modal-content {
          width: 100%; position: relative; padding: 30px;
          max-height: 90vh; overflow-y: auto;
        }
        .label {
          font-size: 11px; color: var(--muted); display: block; margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .input-minimal {
          background: transparent; border: none; color: var(--cream);
          font-size: 13px; font-weight: 600; cursor: pointer; outline: none;
          padding: 2px 4px; border-radius: 4px;
        }
        .input-minimal:hover { background: rgba(255,255,255,0.05); }
        .input-minimal option { background: #1a1a1a; color: white; }
      `}</style>
    </div>
  );
}
