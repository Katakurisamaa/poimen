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

      let mQuery = supabase.from("members").select("*", { count: "exact" }).eq("bergerie_id", myBergerie.id);
      let iQuery = supabase.from("invites").select("*", { count: "exact" }).eq("bergerie_id", myBergerie.id);

      if (isOnlyResponsable) {
        mQuery = mQuery.eq("responsible", userNameStr);
        iQuery = iQuery.eq("responsible", userNameStr);
      }

      const { data: members, count: mCount } = await mQuery;
      const { data: invites, count: iCount } = await iQuery;
      
      setCounts({ members: mCount || 0, invites: iCount || 0 });

      // Dynamic Engagement Calculation
      if (members) {
        let fidelised = 0, ongoing = 0, atRisk = 0;
        members.forEach(m => {
          // Simple mock engagement logic for now based on status or random
          // In a real app, this would use the attendance logic
          const eng = Math.floor(Math.random() * 100); 
          if (eng >= 75) fidelised++;
          else if (eng >= 45) ongoing++;
          else atRisk++;
        });
        
        const total = members.length || 1;
        setEngagementStats([
          { label: "Fidélisés (>75%)", pct: Math.round((fidelised/total)*100), color: "var(--green)", count: fidelised },
          { label: "En cours (45-75%)", pct: Math.round((ongoing/total)*100), color: "var(--orange)", count: ongoing },
          { label: "À risque (<45%)", pct: Math.round((atRisk/total)*100), color: "var(--red)", count: atRisk },
        ]);
      }
    } catch (e) {
      console.error("Error fetching counts:", e);
    }
  };

  const [engagementStats, setEngagementStats] = useState(ENGAGEMENT);

  const DYNAMIC_STATS = [
    { label: "Membres", value: String(counts.members), sub: "Total actifs", trend: "up", color: "var(--gold-light)", icon: Users },
    { label: "Invités", value: String(counts.invites), sub: "Nouveaux", trend: "up", color: "var(--sky)", icon: UserPlus },
    { label: "Activités", value: "0", sub: "Ce mois", trend: "up", color: "var(--purple)", icon: CalendarDays },
    { label: "Alertes Suivi", value: "0", sub: "Membres à risque", trend: "down", color: "var(--red)", icon: AlertTriangle },
  ];

  // Pre-fill from saved info
  const savedInfo = typeof window !== "undefined" ? (() => { try { const s = localStorage.getItem("poimen_saved_info"); return s ? JSON.parse(s) : null; } catch { return null; } })() : null;
  const [registration, setRegistration] = useState({
    email: savedInfo?.email ?? "",
    code: savedInfo?.code ?? "",
    role: savedInfo?.role ?? "Responsable"
  });

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    init();
  }, []);

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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-in">
      {/* Welcome */}
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
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{counts.members} membres inscrits</span>
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

      {/* Activities + À risque */}
      <div className="bento bento-2-1 d3">
        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Activités Récentes</span>
            <button className="btn btn-subtle btn-sm" style={{ padding: "4px 10px", fontSize: 10 }}><ChevronRight size={12} /> Tout voir</button>
          </div>
          <div style={{ padding: "4px 0" }}>
            {ACTIVITIES.length > 0 ? ACTIVITIES.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: i < ACTIVITIES.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
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
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", background: "rgba(10, 6, 22, 0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--red)" }}>
              ● Alertes de Suivi
            </span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {AT_RISK.length > 0 ? AT_RISK.map((m, i) => (
              <div key={i} style={{ padding: "16px 24px", borderBottom: i < AT_RISK.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div className="avatar avatar-gradient avatar-effect-pulse" style={{ width: 36, height: 36, fontSize: 12, color: "var(--red)", borderColor: "var(--red)" }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.issue}</div>
                  </div>
                </div>
                <div className="progress" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${m.score}%`, background: "var(--red)" }} /></div>
              </div>
            )) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Aucun membre à risque détecté</div>
            )}
          </div>
        </div>
      </div>

      {/* Challenges + Objectifs */}
      <div className="bento bento-1-1 d4">
        <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10, 6, 22, 0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Challenges Actifs</span>
            <span className="badge badge-red" style={{ fontSize: 9 }}>{CHALLENGES.length}</span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {CHALLENGES.length > 0 ? CHALLENGES.map((c, i) => (
              <div key={i} style={{ padding: "16px 24px", borderBottom: i < CHALLENGES.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{c.member}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}><MessageSquare size={11} style={{ color: "var(--gold-light)", opacity: 0.8 }} /> {c.notes}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--cream-dim)", lineHeight: 1.5 }}>{c.text}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6, marginTop: 6, letterSpacing: 0.5 }}>{c.date}</div>
              </div>
            )) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Aucun challenge pastoral en cours</div>
            )}
          </div>
        </div>

        <div className="glass" style={{ border: "1px solid rgba(212, 175, 55, 0.15)", display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Objectifs du Mois</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 4 }}>
            {OBJECTIVES.length > 0 ? OBJECTIVES.map((o, i) => {
              const pct = Math.round((o.current / o.target) * 100);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-end" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{o.title}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-display)", color: o.color }}>{o.current} / {o.target}</span>
                  </div>
                  <div className="progress progress-thick" style={{ height: 8 }}><div className="progress-fill" style={{ width: `${pct}%`, background: o.color }} /></div>
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>Aucun objectif pastoral défini pour ce mois</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

