"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, MapPin, Key, Trash2, Edit2, Globe, ShieldCheck, Users, Link as LinkIcon, Check, Copy, X, AlertTriangle, CheckCircle2, XCircle, Church } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SuperAdminDashboard() {
  return (
    <Suspense fallback={<div className="loading-state">Initialisation de la Console...</div>}>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header className="fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--gold-light)", marginBottom: 4 }}>
            <ShieldCheck size={16} />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Console de Contrôle Suprême</span>
          </div>
          <h2 className="page-title" style={{ margin: 0 }}>
            {activeTab === "churches" ? "Églises & Familles" : 
             activeTab === "approvals" ? "Approbations en attente" : 
             "Écosystème"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-subtle" onClick={generateInvite}>
            <LinkIcon size={16} /> <span className="hide-mobile">Inviter une Église</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={16} /> <span className="hide-mobile">Nouvelle Église</span>
          </button>
        </div>
      </header>      {activeTab === "ecosystem" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="bento bento-3">
            <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/admin?tab=churches")}>
              <Church size={24} className="stat-icon" style={{ color: "var(--sky)" }} />
              <span className="stat-label">Églises Partenaires</span>
              <div className="stat-value" style={{ color: "var(--sky)" }}>{churches.length}</div>
              <div className="stat-sub">Réseau actif</div>
            </div>
            <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/admin?tab=churches")}>
              <Users size={24} className="stat-icon" style={{ color: "var(--gold)" }} />
              <span className="stat-label">Total Familles</span>
              <div className="stat-value" style={{ color: "var(--gold)" }}>
                {churches.reduce((acc, c) => acc + (c.bergeries?.length || 0), 0)}
              </div>
              <div className="stat-sub">Unités de croissance</div>
            </div>
            <div className="stat-card" style={{ cursor: "pointer", border: pendingBergeries.length > 0 ? "1px solid var(--orange)" : "" }} onClick={() => router.push("/dashboard/admin?tab=approvals")}>
              <Globe size={24} className="stat-icon" style={{ color: "var(--orange)" }} />
              <span className="stat-label">En attente</span>
              <div className="stat-value" style={{ color: "var(--orange)" }}>{pendingBergeries.length}</div>
              <div className="stat-sub">Demandes d'approbation</div>
            </div>
          </div>

          <div className="glass">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Actions rapides</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              <button className="btn btn-subtle" style={{ padding: 20, flexDirection: "column", height: "auto", gap: 12 }} onClick={generateInvite}>
                <LinkIcon size={24} style={{ color: "var(--gold)" }} />
                <span>Générer un lien d'invitation</span>
              </button>
              <button className="btn btn-subtle" style={{ padding: 20, flexDirection: "column", height: "auto", gap: 12 }} onClick={() => setIsAdding(true)}>
                <Plus size={24} style={{ color: "var(--gold)" }} />
                <span>Enregistrer une église</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "churches" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {churches.map((church) => (
            <div key={church.id} className="glass" style={{ overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                    <Church size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{church.name}</h3>
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                      <MapPin size={12} /> {church.city}, {church.country}
                      <span style={{ color: "var(--border)" }}>|</span>
                      <Key size={12} style={{ color: "var(--gold)" }} /> <code>{church.access_code}</code>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-subtle btn-sm" title="Modifier l'église"><Edit2 size={14} /></button>
                  <button className="btn btn-subtle btn-sm" style={{ color: "var(--red)" }} onClick={() => deleteChurch(church.id)} title="Supprimer l'église"><Trash2 size={14} /></button>
                </div>
              </div>
              
              <div style={{ padding: "12px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>Familles de Disciples ({church.bergeries?.length || 0})</span>
                </div>
                
                {(!church.bergeries || church.bergeries.length === 0) ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 8 }}>
                    Aucune famille enregistrée pour cette église.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                    {church.bergeries.map((b: any) => (
                      <div key={b.id} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 16, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            {[b.creator_civility, b.creator_first_name, b.creator_last_name].filter(Boolean).join(" ")}
                          </div>
                        </div>
                        <button className="btn btn-icon btn-sm" style={{ color: "var(--red)", opacity: 0.5 }} onClick={() => deleteBergerie(b.id)}>
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
              <Church size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
              <p>Aucune église configurée dans l'écosystème.</p>
              <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ margin: "16px auto 0" }}>Déployer la première église</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "approvals" && (
        <div className="fade-in">
          <div className="glass">
            <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Demandes de Nouvelles Familles</h3>
            </div>
            {pendingBergeries.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Aucune demande en attente.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 1 }}>
                      <th style={{ padding: "16px 20px" }}>Famille</th>
                      <th style={{ padding: "16px 20px" }}>Église</th>
                      <th style={{ padding: "16px 20px" }}>Demandeur</th>
                      <th style={{ padding: "16px 20px" }}>E-mail</th>
                      <th style={{ padding: "16px 20px" }}>Rôle</th>
                      <th style={{ padding: "16px 20px", textAlign: "right" }}>Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBergeries.map((b) => (
                      <tr key={b.id} style={{ borderTop: "1px solid var(--border)", fontSize: 14 }}>
                        <td style={{ padding: "16px 20px", fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: "16px 20px", color: "var(--gold-light)" }}>{b.churches?.name}</td>
                        <td style={{ padding: "16px 20px" }}>
                          {b.creator_civility || b.creator_first_name || b.creator_last_name ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {[b.creator_civility, b.creator_first_name, b.creator_last_name].filter(Boolean).join(" ")}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Non renseigné</span>
                          )}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          {b.creator_email ? (
                            <span style={{ color: "var(--sky)" }}>{b.creator_email}</span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span className="badge badge-gold" style={{ textTransform: "capitalize" }}>{b.creator_role}</span>
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                            <button className="btn btn-primary btn-sm" style={{ background: "var(--green)", borderColor: "var(--green)" }} onClick={() => approveBergerie(b.id)}>
                              <CheckCircle2 size={14} /> Approuver
                            </button>
                            <button className="btn btn-subtle btn-sm" style={{ color: "var(--red)" }} onClick={() => deleteBergerie(b.id)}>
                              <XCircle size={14} /> Refuser
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
          <div className="glass" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }} onClick={() => setIsInviting(false)} />
          <div className="glass" style={{ width: "100%", maxWidth: 500, padding: 32, position: "relative", zIndex: 101, textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 20px" }}>
              <LinkIcon size={32} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Lien d'Invitation Généré</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>Envoyez ce lien à un responsable pour qu'il puisse configurer sa propre église.</p>
            
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <input readOnly value={inviteLink} style={{ background: "none", border: "none", color: "var(--gold-light)", fontSize: 13, width: "100%", outline: "none" }} />
              <button onClick={copyLink} style={{ background: "none", border: "none", color: copied ? "var(--green)" : "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copié" : "Copier"}
              </button>
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setIsInviting(false)}>Terminé</button>
          </div>
        </div>
      )}

      {/* Add Church Modal */}
      {isAdding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="glass" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }} onClick={() => setIsAdding(false)} />
          <div className="glass" style={{ width: "100%", maxWidth: 450, padding: 32, position: "relative", zIndex: 101 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Déployer une Nouvelle Église</h3>
              <button onClick={() => setIsAdding(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label">Dénomination</label>
                <input className="input" placeholder="ex: ICC Bruxelles" value={newChurch.name} onChange={e => setNewChurch({...newChurch, name: e.target.value})} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                  <Key size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gold)" }} />
                  <input className="input" style={{ paddingLeft: 36 }} placeholder="BRU2025" value={newChurch.access_code} onChange={e => setNewChurch({...newChurch, access_code: e.target.value.toUpperCase()})} />
                </div>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>Ce code sera requis pour tous les membres de cette église.</p>
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
