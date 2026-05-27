"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, UserPlus, Trash2, Mail, ShieldAlert, Loader2, CheckCircle2, Clock3, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function IntegrationTeamPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [church, setChurch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newCounselor, setNewCounselor] = useState({
    firstName: "",
    lastName: "",
    email: "",
    accessCode: "",
    role: "integration_conseiller"
  });

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (isAdding) {
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
  }, [isAdding]);

  const init = async () => {
    try {
      const savedChurch = localStorage.getItem("selected_church");
      if (!savedChurch) {
        window.location.href = "/";
        return;
      }
      const churchObj = JSON.parse(savedChurch);
      setChurch(churchObj);

      const savedUserInfo = localStorage.getItem("poimen_user_info");
      if (savedUserInfo) {
        const info = JSON.parse(savedUserInfo);
        setUserInfo(info);
        
        // Fetch team only if integration leader
        const role = info.role?.toLowerCase() || "";
        if (role === "integration_responsable" || role === "integration_second") {
          await fetchTeam(churchObj.id);
        } else {
          // Bypassed if counselor
          window.location.href = "/dashboard";
        }
      } else {
        window.location.href = "/login";
      }
    } catch (e) {
      console.error("Initialization error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async (churchId: string) => {
    try {
      // 1. Fetch active profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("church_id", churchId)
        .in("role", ["integration_conseiller", "integration_second"]);

      // 2. Fetch pending counselors
      const { data: pending } = await supabase
        .from("pending_counselors")
        .select("*")
        .eq("church_id", churchId);

      // 3. Fetch invites to calculate workloads
      const { data: invites } = await supabase
        .from("invites")
        .select("assigned_to, bergerie_id")
        .eq("church_id", churchId);

      const workloadMap: Record<string, number> = {};
      if (invites) {
        invites.forEach(inv => {
          if (inv.assigned_to && !inv.bergerie_id) {
            workloadMap[inv.assigned_to] = (workloadMap[inv.assigned_to] || 0) + 1;
          }
        });
      }

      const activeList = (profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        name: p.display_name,
        role: p.role === "integration_second" ? "Second" : "Conseiller",
        status: "active",
        workload: workloadMap[p.id] || 0,
        createdAt: p.created_at
      }));

      const pendingList = (pending || []).map(p => ({
        id: p.id,
        email: p.email,
        name: `${p.first_name} ${p.last_name}`,
        role: p.role === "integration_second" ? "Second" : "Conseiller",
        status: "pending",
        workload: 0,
        createdAt: p.created_at
      }));

      setTeam([...activeList, ...pendingList]);
    } catch (e) {
      console.error("Error fetching team:", e);
    }
  };

  const handleAddCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounselor.firstName || !newCounselor.lastName || !newCounselor.email || !newCounselor.accessCode) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    setSubmitting(true);
    try {
      // Verify counselor doesn't already exist in team
      const existing = team.find(t => t.email.toLowerCase() === newCounselor.email.toLowerCase().trim());
      if (existing) {
        alert("Un membre avec cet e-mail fait déjà partie de l'équipe.");
        setSubmitting(false);
        return;
      }

      // Insert pending counselor
      const { error } = await supabase
        .from("pending_counselors")
        .insert({
          church_id: church.id,
          email: newCounselor.email.toLowerCase().trim(),
          first_name: newCounselor.firstName,
          last_name: newCounselor.lastName,
          access_code: newCounselor.accessCode,
          role: newCounselor.role
        });

      if (error) throw error;

      alert("Membre de l'équipe pré-enregistré avec succès ! Il pourra se connecter immédiatement avec son adresse email et le code d'accès.");
      
      setNewCounselor({ firstName: "", lastName: "", email: "", accessCode: "", role: "integration_conseiller" });
      setIsAdding(false);
      await fetchTeam(church.id);
    } catch (err: any) {
      console.error("Error adding counselor:", err);
      alert("Erreur lors de l'enregistrement: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (member: any) => {
    const confirmMsg = member.status === "pending"
      ? "Annuler l'invitation de ce conseiller ?"
      : "Supprimer définitivement ce conseiller de votre équipe ? Il perdra tout accès à ses affectations.";
      
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      if (member.status === "pending") {
        const { error } = await supabase
          .from("pending_counselors")
          .delete()
          .eq("id", member.id);
        if (error) throw error;
      } else {
        // Delete counselor profile ( cascade will clean up or set null to invites.assigned_to )
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("id", member.id);
        if (error) throw error;
        
        // Also delete them from auth users if we could, but since we are client-side only,
        // deleting the profile is enough to prevent login because profiles policies require profile row
      }

      alert("Conseiller supprimé avec succès.");
      await fetchTeam(church.id);
    } catch (err: any) {
      console.error("Error deleting member:", err);
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Loader2 className="animate-spin" style={{ color: "var(--gold)" }} size={36} />
        <div style={{ color: "var(--gold-light)", fontSize: 14 }}>Chargement de l'équipe d'intégration...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }} className="fade-in">
      <header style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.12)", paddingBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold-light)", marginBottom: 4 }}>
            <Users size={16} />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Intégration & Suivi</span>
          </div>
          <h2 className="page-title" style={{ margin: 0 }}>Gestion de l'Équipe</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>
          <Plus size={16} /> <span>Ajouter un Conseiller</span>
        </button>
      </header>

      {/* Team Load metrics */}
      <div className="glass" style={{ border: "1px solid rgba(212, 175, 55, 0.15)", padding: 24 }}>
        <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 700, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 0.5 }}>Charge de Suivi de l'Équipe</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          <div style={{ padding: 18, background: "rgba(10,6,22,0.4)", borderRadius: 10, border: "1px solid rgba(212,175,55,0.08)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total Conseillers</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--cream)", marginTop: 6 }}>{team.length}</div>
            <div style={{ fontSize: 10, color: "var(--gold-light)", marginTop: 4 }}>{team.filter(t => t.status === "active").length} actifs · {team.filter(t => t.status === "pending").length} en attente</div>
          </div>
          <div style={{ padding: 18, background: "rgba(10,6,22,0.4)", borderRadius: 10, border: "1px solid rgba(212,175,55,0.08)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total affectations actives</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--sky)", marginTop: 6 }}>
              {team.reduce((acc, t) => acc + t.workload, 0)}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Invités pris en charge</div>
          </div>
          <div style={{ padding: 18, background: "rgba(10,6,22,0.4)", borderRadius: 10, border: "1px solid rgba(212,175,55,0.08)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Charge Moyenne</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--purple-light)", marginTop: 6 }}>
              {team.length > 0 ? (team.reduce((acc, t) => acc + t.workload, 0) / team.filter(t => t.status === "active").length || 0).toFixed(1) : "0.0"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Suivis par conseiller actif</div>
          </div>
        </div>
      </div>

      {/* Grid listing */}
      <div className="glass glass-flush" style={{ border: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(212, 175, 55, 0.15)", background: "rgba(10, 6, 22, 0.3)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold-light)" }}>Membres de l'Équipe</span>
        </div>
        <div>
          {team.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--muted)" }}>
              <div style={{ opacity: 0.3, marginBottom: 16 }}><Users size={48} style={{ margin: "0 auto" }} /></div>
              <p style={{ fontSize: 14, marginBottom: 16 }}>Aucun conseiller n'est configuré dans votre équipe.</p>
              <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={16} /> Ajouter le premier conseiller</button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(212,175,55,0.1)", textAlign: "left" }}>
                    <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1 }}>Nom & Prénom</th>
                    <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1 }}>Rôle</th>
                    <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1 }}>Statut</th>
                    <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1, textAlign: "center" }}>Charge active</th>
                    <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1 }}>Enregistré le</th>
                    <th style={{ padding: "14px 24px", textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((member, i) => (
                    <tr key={member.id} style={{ borderBottom: i < team.length - 1 ? "1px solid rgba(212,175,55,0.06)" : "none", background: member.status === "pending" ? "rgba(245,158,11,0.02)" : "transparent" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div className={`avatar avatar-gradient ${member.status === "pending" ? "avatar-effect-pulse" : ""}`} style={{ width: 34, height: 34, fontSize: 11, borderColor: member.status === "pending" ? "var(--orange)" : "" }}>
                            {member.name[0] || ""}{member.name.split(" ")[1]?.[0] || ""}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{member.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <Mail size={11} /> {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--cream-dim)" }}>{member.role}</td>
                      <td style={{ padding: "16px 24px" }}>
                        {member.status === "active" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--green)", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: 12, fontWeight: 600 }}>
                            <CheckCircle2 size={12} /> Actif
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--orange)", background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 12, fontWeight: 600 }}>
                            <Clock3 size={12} /> En attente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "center" }}>
                        {member.status === "active" ? (
                          <span className={`badge ${member.workload > 5 ? "badge-red" : member.workload > 2 ? "badge-gold" : ""}`} style={{ fontSize: 12, padding: "3px 10px", fontWeight: 700 }}>
                            {member.workload} invités
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 12, color: "var(--muted)" }}>
                        {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleDeleteMember(member)}
                          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", transition: "color 0.2s ease" }}
                          onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                          title={member.status === "pending" ? "Annuler l'invitation" : "Supprimer de l'équipe"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Pre-register new counselor */}
      {typeof window !== "undefined" && isAdding && createPortal(
        <div className="modal-overlay" onClick={() => setIsAdding(false)}>
          <div 
            className="custom-modal" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <button onClick={() => setIsAdding(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}><X size={20} /></button>
            
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--gold-glow)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 12px" }}>
                <UserPlus size={20} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Nouveau Conseiller</h3>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Pré-enregistrer un membre de votre équipe d'intégration</p>
            </div>

            <form onSubmit={handleAddCounselor} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">Prénom</label>
                  <input className="input" placeholder="Ex: Jean" value={newCounselor.firstName} onChange={e => setNewCounselor({...newCounselor, firstName: e.target.value})} required style={{ height: 40 }} />
                </div>
                <div>
                  <label className="form-label">Nom</label>
                  <input className="input" placeholder="Ex: Dupont" value={newCounselor.lastName} onChange={e => setNewCounselor({...newCounselor, lastName: e.target.value})} required style={{ height: 40 }} />
                </div>
              </div>
              <div>
                <label className="form-label">Adresse e-mail</label>
                <input className="input" type="email" placeholder="counselor@email.com" value={newCounselor.email} onChange={e => setNewCounselor({...newCounselor, email: e.target.value})} required style={{ height: 40 }} />
              </div>
              <div>
                <label className="form-label">Rôle dans l'équipe</label>
                <select 
                  className="input" 
                  value={newCounselor.role} 
                  onChange={e => setNewCounselor({...newCounselor, role: e.target.value})} 
                  style={{ height: 40, background: "rgba(10, 6, 22, 0.6)", color: "var(--cream)", border: "1px solid rgba(212, 175, 55, 0.25)" }}
                >
                  <option value="integration_conseiller">Conseiller Intégration</option>
                  <option value="integration_second">Second Intégration</option>
                </select>
              </div>
              <div>
                <label className="form-label">Code d'accès secret (Mot de passe)</label>
                <input className="input" placeholder="Ex: INTEG92" value={newCounselor.accessCode} onChange={e => setNewCounselor({...newCounselor, accessCode: e.target.value})} required style={{ height: 40, letterSpacing: 1.5 }} />
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Ce code servira de mot de passe lors de sa toute première connexion.</p>
              </div>

              <div style={{ display: "flex", gap: 12, paddingTop: 10 }}>
                <button type="button" className="btn btn-subtle" style={{ flex: 1, height: 44 }} onClick={() => setIsAdding(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: 44, justifyContent: "center" }} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
