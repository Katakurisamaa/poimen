"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, MapPin, Key, Trash2, Edit2, Globe, ShieldCheck, Users, Link as LinkIcon, Check, Copy, X, CheckCircle2, XCircle, Church } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SuperAdminDashboard() {
  return (
    <Suspense fallback={<div className="loading-state" style={{ padding: 40, textAlign: "center", color: "var(--gold-light)", fontFamily: "var(--font-display)", fontSize: 18 }}>Initialisation de la Divine Console...</div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState("ecosystem"); 
  const [churches, setChurches] = useState<any[]>([]);
  const [pendingBergeries, setPendingBergeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync activeTab with URL param
    if (!tabParam || tabParam === "ecosystem") {
      setActiveTab("ecosystem");
    } else if (["churches", "approvals"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [chRes, pRes] = await Promise.all([
      supabase.from("churches").select("*, bergeries(*)").order("name"),
      supabase.from("bergeries").select("*, churches(name)").eq("status", "pending"),
    ]);

    if (chRes.data) setChurches(chRes.data);
    if (pRes.data) setPendingBergeries(pRes.data);
    setLoading(false);
  };

  const [isAdding, setIsAdding] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [newChurch, setNewChurch] = useState({ name: "", city: "", country: "Belgique", access_code: "" });

  const generateInvite = () => {
    const token = Math.random().toString(36).substring(7);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://poimen.org";
    setInviteLink(`${origin}/setup-church?token=${token}`);
    setIsInviting(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addChurch = async () => {
    if (!newChurch.name || !newChurch.access_code) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    const { data, error } = await supabase.from("churches").insert([newChurch]).select();
    if (!error && data) {
      setChurches([...churches, data[0]]);
      setIsAdding(false);
      setNewChurch({ name: "", city: "", country: "Belgique", access_code: "" });
    } else {
      console.error("Error creating church:", error);
      const isSchemaError = error?.message?.includes("column") || error?.message?.includes("access_code");
      alert(
        `Erreur: ${error?.message || "Inconnue"}\n\n` +
        (isSchemaError 
          ? "Il semble que la table 'churches' n'est pas à jour. Exécutez le patch SQL (v1.3) dans votre éditeur Supabase." 
          : "Vérifiez les politiques RLS sur la table 'churches' ou assurez-vous d'être bien connecté avec le compte Admin.")
      );
    }
  };

  const deleteChurch = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette église ?")) {
      const { error } = await supabase.from("churches").delete().eq("id", id);
      if (!error) setChurches(churches.filter(c => c.id !== id));
    }
  };

  const deleteBergerie = async (id: string) => {
    if (confirm("Supprimer cette Famille de Disciple ?")) {
      const { error } = await supabase.from("bergeries").delete().eq("id", id);
      if (!error) {
        setChurches(churches.map(c => ({
          ...c,
          bergeries: c.bergeries?.filter((b: any) => b.id !== id)
        })));
        setPendingBergeries(pendingBergeries.filter(b => b.id !== id));
      }
    }
  };

  const approveBergerie = async (id: string) => {
    const { error } = await supabase.from("bergeries").update({ status: "active" }).eq("id", id);
    if (!error) {
      fetchData(); // Refresh to get the nested structure updated
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <div style={{ color: "var(--gold-light)", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.05em" }}>
          Chargement de l'Écosystème Céleste...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="page-header fade-in">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--gold-light)", marginBottom: 6 }}>
            <ShieldCheck size={16} />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700 }}>Console de Contrôle Suprême</span>
          </div>
          <h2 className="page-title" style={{ margin: 0 }}>
            {activeTab === "churches" ? "Églises & Familles" : 
             activeTab === "approvals" ? "Approbations en attente" : 
             "Écosystème"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={generateInvite}>
            <LinkIcon size={14} /> <span>Inviter une Église</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> <span>Nouvelle Église</span>
          </button>
        </div>
      </header>

      {activeTab === "ecosystem" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="bento bento-3">
            <div className="stat-card" style={{ cursor: "pointer", transition: "all 0.3s ease" }} onClick={() => router.push("/dashboard/admin?tab=churches")}>
              <Church size={24} className="stat-icon" style={{ color: "var(--sky)" }} />
              <span className="stat-label">Églises Partenaires</span>
              <div className="stat-value" style={{ background: "linear-gradient(135deg, #FFF, var(--sky) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {churches.length}
              </div>
              <div className="stat-sub">Réseau d'édification actif</div>
            </div>
            <div className="stat-card" style={{ cursor: "pointer", transition: "all 0.3s ease" }} onClick={() => router.push("/dashboard/admin?tab=churches")}>
              <Users size={24} className="stat-icon" style={{ color: "var(--gold)" }} />
              <span className="stat-label">Total Familles</span>
              <div className="stat-value">
                {churches.reduce((acc, c) => acc + (c.bergeries?.length || 0), 0)}
              </div>
              <div className="stat-sub">Unités spirituelles de croissance</div>
            </div>
            <div className="stat-card" style={{ cursor: "pointer", border: pendingBergeries.length > 0 ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border)", boxShadow: pendingBergeries.length > 0 ? "0 0 20px rgba(245, 158, 11, 0.1)" : "", transition: "all 0.3s ease" }} onClick={() => router.push("/dashboard/admin?tab=approvals")}>
              <Globe size={24} className="stat-icon" style={{ color: "var(--orange)" }} />
              <span className="stat-label">En attente</span>
              <div className="stat-value" style={{ background: "linear-gradient(135deg, #FFF, var(--orange) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {pendingBergeries.length}
              </div>
              <div className="stat-sub">Demandes d'approbations de bergeries</div>
            </div>
          </div>

          <div className="glass">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>Actions Administratives Rapides</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              <div className="glass arch-card" style={{ padding: "32px 24px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, transition: "all 0.35s ease" }} onClick={generateInvite}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                  <LinkIcon size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cream)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-body)" }}>Inviter une Église</div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>Générer un lien d'invitation sécurisé pour permettre à un pasteur de déployer son église.</p>
              </div>
              <div className="glass arch-card" style={{ padding: "32px 24px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, transition: "all 0.35s ease" }} onClick={() => setIsAdding(true)}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                  <Plus size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cream)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-body)" }}>Enregistrer une Église</div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>Créer et configurer manuellement une nouvelle église partenaire dans l'écosystème Poimén.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "churches" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {churches.map((church) => (
            <div key={church.id} className="glass" style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ padding: "20px 24px", background: "linear-gradient(90deg, rgba(212, 175, 55, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", border: "1px solid rgba(212,175,55,0.25)" }}>
                    <Church size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cream)" }}>{church.name}</h3>
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <MapPin size={12} /> {church.city}, {church.country}
                      <span style={{ color: "rgba(212,175,55,0.15)" }}>|</span>
                      <Key size={12} style={{ color: "var(--gold)" }} /> <code style={{ color: "var(--gold-light)", fontWeight: 700 }}>{church.access_code}</code>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-icon btn-icon-gold" title="Modifier l'église"><Edit2 size={14} /></button>
                  <button className="btn-icon btn-icon-red" onClick={() => deleteChurch(church.id)} title="Supprimer l'église"><Trash2 size={14} /></button>
                </div>
              </div>
              
              <div style={{ padding: "24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                  <span>Familles de Disciples Rattachées ({church.bergeries?.length || 0})</span>
                </div>
                
                {(!church.bergeries || church.bergeries.length === 0) ? (
                  <div style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)", fontSize: 13, border: "1px dashed rgba(212, 175, 55, 0.15)", borderRadius: 12, background: "rgba(0, 0, 0, 0.1)" }}>
                    Aucune famille de disciples n'est encore enregistrée pour cette église.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                    {church.bergeries.map((b: any) => (
                      <div key={b.id} className="glass glass-compact" style={{ background: "rgba(10, 6, 22, 0.4)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(212, 175, 55, 0.1)", borderRadius: "12px", transition: "all 0.25s ease" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cream-dim)" }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            Leader: {[b.creator_civility, b.creator_first_name, b.creator_last_name].filter(Boolean).join(" ") || "Non renseigné"}
                          </div>
                        </div>
                        <button className="btn-icon btn-icon-red" onClick={() => deleteBergerie(b.id)} title="Supprimer la bergerie">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {churches.length === 0 && (
            <div className="glass" style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
              <Church size={48} style={{ margin: "0 auto 16px", color: "var(--gold)", opacity: 0.3 }} />
              <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--cream)" }}>Aucune église configurée dans l'écosystème.</p>
              <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ margin: "16px auto 0" }}>Déployer la première église</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "approvals" && (
        <div className="fade-in">
          <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "linear-gradient(90deg, rgba(212, 175, 55, 0.03) 0%, transparent 100%)" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)" }}>Demandes d'Approbation de Nouvelles Bergeries</h3>
            </div>
            {pendingBergeries.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                <CheckCircle2 size={40} style={{ color: "var(--green)", opacity: 0.5, margin: "0 auto 16px" }} />
                <span>Aucune demande d'approbation en attente. Tout est en ordre !</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Famille</th>
                      <th>Église Rattachée</th>
                      <th>Demandeur / Fondateur</th>
                      <th>E-mail</th>
                      <th>Statut Demandeur</th>
                      <th style={{ textAlign: "right" }}>Décision administrative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBergeries.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: "var(--cream)" }}>{b.name}</td>
                        <td style={{ color: "var(--gold-light)", fontWeight: 500 }}>{b.churches?.name}</td>
                        <td>
                          {b.creator_civility || b.creator_first_name || b.creator_last_name ? (
                            <div style={{ fontWeight: 600, color: "var(--cream-dim)" }}>
                              {[b.creator_civility, b.creator_first_name, b.creator_last_name].filter(Boolean).join(" ")}
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Non renseigné</span>
                          )}
                        </td>
                        <td style={{ color: "var(--sky)" }}>
                          {b.creator_email || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>—</span>}
                        </td>
                        <td>
                          <span className="badge badge-gold" style={{ textTransform: "capitalize" }}>{b.creator_role || "Berger"}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button className="btn btn-sm" style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)", color: "#FFF", border: "1px solid rgba(16, 185, 129, 0.3)", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)" }} onClick={() => approveBergerie(b.id)}>
                              <CheckCircle2 size={13} /> Activer
                            </button>
                            <button className="btn btn-subtle btn-sm" style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)" }} onClick={() => deleteBergerie(b.id)}>
                              <XCircle size={13} /> Rejeter
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invitation Modal */}
      {isInviting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(2, 1, 4, 0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} onClick={() => setIsInviting(false)} />
          <div className="glass" style={{ width: "100%", maxWidth: 500, padding: 32, position: "relative", zIndex: 101, textAlign: "center", border: "1px solid var(--gold)", boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(212, 175, 55, 0.15)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 20px", border: "1px solid rgba(212, 175, 55, 0.3)" }}>
              <LinkIcon size={26} />
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, fontFamily: "var(--font-display)" }}>Invitation Prête</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>Partagez ce lien sacré avec le pasteur responsable pour qu'il puisse configurer son église locale.</p>
            
            <div style={{ background: "rgba(0,0,0,0.4)", padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <input readOnly value={inviteLink} style={{ background: "none", border: "none", color: "var(--gold-light)", fontSize: 13, width: "100%", outline: "none", fontFamily: "monospace" }} />
              <button onClick={copyLink} style={{ background: "none", border: "none", color: copied ? "var(--green)" : "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copié" : "Copier"}
              </button>
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setIsInviting(false)}>Terminer</button>
          </div>
        </div>
      )}

      {/* Add Church Modal */}
      {isAdding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(2, 1, 4, 0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} onClick={() => setIsAdding(false)} />
          <div className="glass" style={{ width: "100%", maxWidth: 460, padding: 32, position: "relative", zIndex: 101, border: "1px solid var(--gold)", boxShadow: "0 20px 50px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Déployer une Église locale</h3>
              <button onClick={() => setIsAdding(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="form-label">Dénomination de l'Église</label>
                <input className="input" placeholder="ex: ICC Bruxelles" value={newChurch.name} onChange={e => setNewChurch({...newChurch, name: e.target.value})} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label">Ville</label>
                  <input className="input" placeholder="Bruxelles" value={newChurch.city} onChange={e => setNewChurch({...newChurch, city: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Pays</label>
                  <input className="input" value={newChurch.country} onChange={e => setNewChurch({...newChurch, country: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="form-label">Code Secret de Connexion</label>
                <div style={{ position: "relative" }}>
                  <Key size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gold)" }} />
                  <input className="input" style={{ paddingLeft: 38 }} placeholder="BRU2026" value={newChurch.access_code} onChange={e => setNewChurch({...newChurch, access_code: e.target.value.toUpperCase()})} />
                </div>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>Ce code secret unique sera requis par les bergers et membres pour s'enregistrer sous cette église locale.</p>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button className="btn btn-subtle" style={{ flex: 1 }} onClick={() => setIsAdding(false)}>Annuler</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: "center" }} onClick={addChurch}>Initialiser l'Église</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

