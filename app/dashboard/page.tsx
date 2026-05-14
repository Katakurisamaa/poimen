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

  if (loading && !church) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" /></div>;

  if (!myBergerie) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }} className="fade-in">
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 12, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Bienvenue à {church?.name}</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 42, margin: 0 }}>Espace Communautaire</h1>
            <p style={{ color: "var(--muted)", maxWidth: 600, margin: "16px auto" }}>Rejoignez une Famille de Disciple existante ou demandez la création d&apos;une nouvelle unité.</p>
          </div>

          <div className="bento bento-2-1">
            <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(212,160,60,0.03)", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ color: "var(--gold)" }}><Users size={20} /></div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Familles de Disciples</h3>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, maxWidth: 500 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                    <input type="text" placeholder="Rechercher une famille..." className="input" style={{ paddingLeft: 34, height: 36, fontSize: 12 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ height: 36, whiteSpace: "nowrap" }} onClick={() => setIsCreating(true)}>
                    <Plus size={16} /> <span className="hide-mobile">Proposer une famille</span>
                  </button>
                </div>
              </div>
              <div style={{ padding: 28 }}>
                {filteredBergeries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
                    <div style={{ opacity: 0.3, marginBottom: 16 }}><Users size={48} style={{ margin: "0 auto" }} /></div>
                    <p style={{ marginBottom: 20 }}>{searchQuery ? "Aucune famille ne correspond à votre recherche." : "Aucune famille n'est encore active dans cette église."}</p>
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> Créer la première famille</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
                    {filteredBergeries.map((b, idx) => (
                      <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="glass glass-compact" style={{ cursor: "pointer", border: "1px solid var(--border)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }} onClick={() => selectFamily(b)}>
                        <div style={{ width: 48, height: 48, borderRadius: "12px", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}><Users size={24} /></div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Famille de Disciples</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 4 }} onClick={(e) => { e.stopPropagation(); selectFamily(b); }}>Rejoindre</button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {pendingRequest && (
                <div className="glass" style={{ border: "1px solid var(--orange)", background: "rgba(255,165,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <Clock3 style={{ color: "var(--orange)" }} />
                    <span style={{ fontWeight: 700 }}>Demande en cours</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Votre demande pour <strong>{pendingRequest.name}</strong> en tant que <strong>{pendingRequest.creator_role}</strong> est en attente de validation.</p>
                </div>
              )}
              <div className="glass">
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Pourquoi rejoindre une famille ?</h4>
                <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {["Un accompagnement spirituel de proximité", "Des moments de partage authentiques", "Une croissance mutuelle dans la foi", "Le soutien dans les épreuves"].map((t, i) => (
                    <li key={i} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><CheckCircle2 size={14} style={{ color: "var(--green)" }} /> {t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {typeof window !== "undefined" && selectedForJoin && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }} onClick={() => setSelectedForJoin(null)} />
            <div className="glass" style={{ width: "100%", maxWidth: 400, maxHeight: "85vh", padding: "24px", position: "relative", display: "flex", flexDirection: "column", overflowY: "auto", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Identifier votre accès</h3>
                <button onClick={() => setSelectedForJoin(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: "rgba(212,160,60,0.1)", border: "1px solid var(--gold)" }}>
                <p style={{ fontSize: 12, margin: 0, color: "var(--gold-light)" }}>Famille : <strong>{selectedForJoin.name}</strong></p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label">E-mail de connexion</label>
                  <input className="input" type="email" placeholder="votre@email.com" value={registration.email} onChange={e => setRegistration({...registration, email: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Code d'accès</label>
                  <input className="input" type="password" placeholder="••••••" value={registration.code} onChange={e => setRegistration({...registration, code: e.target.value})} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "var(--muted)", paddingTop: 2 }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }}
                  />
                  Se souvenir de moi
                </label>
                <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
                  <button className="btn btn-subtle" style={{ flex: 1 }} onClick={() => setSelectedForJoin(null)}>Annuler</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={confirmJoin}>Se connecter</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {typeof window !== "undefined" && isCreating && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }} onClick={() => setIsCreating(false)} />
            <div className="glass" style={{ width: "100%", maxWidth: 400, maxHeight: "85vh", padding: "24px", position: "relative", display: "flex", flexDirection: "column", overflowY: "auto", zIndex: 1 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Nouvelle Famille</h3>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>Soumis à approbation administrative.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="form-label">Nom de la famille</label><input type="text" placeholder="Ex: Famille Philadelphie" className="input" value={newBergerie.name} onChange={e => setNewBergerie({...newBergerie, name: e.target.value})} /></div>
                <div>
                  <label className="form-label">Civilité</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["M.", "Mme"].map(c => (<button key={c} className={`btn btn-sm ${newBergerie.civility === c ? "btn-primary" : "btn-subtle"}`} onClick={() => setNewBergerie({...newBergerie, civility: c})} style={{ padding: "0 20px" }}>{c}</button>))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label className="form-label">Prénom</label><input className="input" placeholder="Jean" value={newBergerie.firstName} onChange={e => setNewBergerie({...newBergerie, firstName: e.target.value})} /></div>
                  <div><label className="form-label">Nom</label><input className="input" placeholder="Dupont" value={newBergerie.lastName} onChange={e => setNewBergerie({...newBergerie, lastName: e.target.value})} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label className="form-label">Votre E-mail</label><input className="input" type="email" placeholder="jean@email.com" value={newBergerie.email} onChange={e => setNewBergerie({...newBergerie, email: e.target.value})} /></div>
                  <div><label className="form-label">Code d'accès</label><input className="input" type="text" placeholder="Ex: 123456" value={newBergerie.code} onChange={e => setNewBergerie({...newBergerie, code: e.target.value})} /></div>
                </div>
                <div>
                  <label className="form-label">Rôle de leadership</label>
                  <select className="input" value={newBergerie.creator_role} onChange={e => setNewBergerie({...newBergerie, creator_role: e.target.value})}>
                    <option value="Berger">Berger</option>
                    <option value="Second">Second du berger</option>
                    <option value="Responsable">Responsable de brebis</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
                  <button className="btn btn-subtle" style={{ flex: 1 }} onClick={() => setIsCreating(false)}>Annuler</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateRequest} disabled={!newBergerie.name}>Soumettre</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Original Dashboard (when Bergerie selected)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Welcome */}
      <div className="fade-in">
        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 2 }}>{dateStr}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="page-title" style={{ marginTop: 4 }}>
            Bonjour, {userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : "Utilisateur"}
            <span style={{ fontSize: 12, color: "var(--gold)", marginLeft: 10, fontWeight: 500, textTransform: "uppercase", verticalAlign: "middle" }}>
              ({userInfo?.role || "Membre"})
            </span>
          </h2>
          <button className="btn btn-subtle btn-sm" onClick={() => {
            setMyBergerie(null);
            localStorage.removeItem("selected_family");
            window.dispatchEvent(new Event("storage"));
          }}>Changer de Famille</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="bento bento-4 fade-in d1">
        {DYNAMIC_STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={i}>
              <Icon size={28} className="stat-icon" style={{ color: s.color }} />
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
      <div className="glass fade-in d2">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Engagement global</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{counts.members} membres</span>
        </div>
        <div className="seg-bar" style={{ marginBottom: 12 }}>
          {engagementStats.map((e, i) => <div key={i} style={{ width: `${e.pct}%`, background: e.color }} />)}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {engagementStats.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
              <span style={{ color: "var(--muted)" }}>{e.label}</span>
              <span style={{ fontWeight: 700 }}>{e.count}</span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>({e.pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activities + À risque */}
      <div className="bento bento-2-1 fade-in d3">
        <div className="glass glass-flush">
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Activités</span>
            <button className="btn btn-subtle btn-sm"><ChevronRight size={12} /> Tout voir</button>
          </div>
          {ACTIVITIES.length > 0 ? ACTIVITIES.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < ACTIVITIES.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="color-bar" style={{ background: "var(--gold)", height: 36 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  <Calendar size={10} style={{ display: "inline", verticalAlign: "-1px" }} /> {a.date} · <Clock size={10} style={{ display: "inline", verticalAlign: "-1px" }} /> {a.time}
                </div>
              </div>
              {a.upcoming ? <span className="badge badge-gold">À venir</span> : <span style={{ fontSize: 13, fontWeight: 700, color: (a.attendance ?? 0) >= 70 ? "var(--green)" : "var(--orange)" }}>{a.attendance}%</span>}
            </div>
          )) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Aucune activité enregistrée</div>
          )}
        </div>

        <div className="glass glass-flush">
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}><span style={{ color: "var(--red)" }}>●</span> À risque</span>
          </div>
          {AT_RISK.length > 0 ? AT_RISK.map((m, i) => (
            <div key={i} style={{ padding: "14px 18px", borderBottom: i < AT_RISK.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className="avatar" style={{ background: "var(--red-glow)", border: "1.5px solid var(--red)", color: "var(--red)" }}>{m.initials}</div>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{m.issue}</div></div>
              </div>
              <div className="progress"><div className="progress-fill" style={{ width: `${m.score}%`, background: "var(--red)" }} /></div>
            </div>
          )) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Aucun membre à risque détecté</div>
          )}
        </div>
      </div>

      {/* Challenges + Objectifs */}
      <div className="bento bento-1-1 fade-in d4">
        <div className="glass glass-flush">
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Challenges actifs</span>
            <span className="badge badge-red">{CHALLENGES.length}</span>
          </div>
          {CHALLENGES.length > 0 ? CHALLENGES.map((c, i) => (
            <div key={i} style={{ padding: "14px 18px", borderBottom: i < CHALLENGES.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold-light)" }}>{c.member}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--muted)" }}><MessageSquare size={10} /> {c.notes}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{c.text}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6, marginTop: 4 }}>{c.date}</div>
            </div>
          )) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Aucun challenge actif</div>
          )}
        </div>

        <div className="glass" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Objectifs du mois</span>
          {OBJECTIVES.length > 0 ? OBJECTIVES.map((o, i) => {
            const pct = Math.round((o.current / o.target) * 100);
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{o.title}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-display)", color: o.color }}>{o.current}/{o.target}</span>
                </div>
                <div className="progress progress-thick"><div className="progress-fill" style={{ width: `${pct}%`, background: o.color }} /></div>
              </div>
            );
          }) : (
            <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Aucun objectif défini</div>
          )}
        </div>
      </div>
    </div>
  );
}

