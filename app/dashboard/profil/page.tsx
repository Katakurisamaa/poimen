"use client";

import { useState, useEffect } from "react";
import { 
  User, Mail, Phone, Lock, Save, Loader2, 
  CheckCircle2, AlertCircle, Camera, ShieldCheck,
  Eye, EyeOff, LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getActiveUserInfo } from "@/lib/client-session";

const AGE_RANGES = [
  "Moins de 18 ans",
  "18-25 ans",
  "26-30 ans",
  "31-35 ans",
  "36-40 ans",
  "41-45 ans",
  "46-50 ans",
  "Plus de 50 ans"
];

export default function ProfilePage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [memberData, setMemberData] = useState<any>(null);
  const [isMemberRecord, setIsMemberRecord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password update states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMessage({ type: "error", text: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }

    setPwdLoading(true);
    setPwdMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPwdMessage({ type: "success", text: "Votre mot de passe a été mis à jour avec succès !" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdMessage({ type: "error", text: err.message || "Une erreur est survenue lors de la mise à jour." });
    } finally {
      setPwdLoading(false);
    }
  };


  async function fetchMemberData(email: string, role?: string, userId?: string, bergerieId?: string | null, fallbackInfo?: any) {
    try {
      const isUserIntegration = role?.toLowerCase().startsWith("integration_");
      const isSuperAdmin = role === "super_admin";

      if (isUserIntegration) {
        setIsMemberRecord(false);
        const parsedRole = role === "integration_responsable"
          ? "Responsable Integration"
          : role === "integration_second"
          ? "Second Integration"
          : "Conseiller Integration";

        setMemberData({
          id: userId,
          firstName: fallbackInfo?.firstName || "",
          lastName: fallbackInfo?.lastName || "",
          email,
          role,
          status: parsedRole,
          civility: fallbackInfo?.civility || "M.",
          age: fallbackInfo?.age || "",
          phone: fallbackInfo?.phone || ""
        });
        return;

        // Query profiles table
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId || "")
          .maybeSingle();

        if (data) {
          const parsedRole = data.role === "integration_responsable" 
            ? "Responsable Intégration" 
            : data.role === "integration_second" 
            ? "Second Intégration" 
            : "Conseiller Intégration";

          setMemberData({
            id: data.id,
            firstName: data.display_name?.split(' ')[0] || "",
            lastName: data.display_name?.split(' ').slice(1).join(' ') || "",
            email: data.email,
            role: data.role,
            status: parsedRole,
            civility: data.civility || "M.",
            age: data.age || "",
            phone: data.phone || ""
          });
        }
      } else if (isSuperAdmin) {
        setIsMemberRecord(false);
        // Query profiles table directly
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId || "")
          .maybeSingle();

        if (profile) {
          setMemberData({
            id: profile.id,
            firstName: profile.display_name?.split(' ')[0] || "",
            lastName: profile.display_name?.split(' ').slice(1).join(' ') || "",
            email: profile.email,
            role: profile.role,
            status: "Super Admin",
            civility: profile.civility || "M.",
            age: profile.age || "",
            phone: profile.phone || ""
          });
        }
      } else {
        // Query members table with email and optional bergerie_id
        let query = supabase.from("members").select("*").eq("email", email);
        if (bergerieId) {
          query = query.eq("bergerie_id", bergerieId);
        }
        const { data, error } = await query.maybeSingle();

        if (data) {
          setIsMemberRecord(true);
          setMemberData({
            ...data,
            firstName: data.first_name,
            lastName: data.last_name
          });
        } else {
          setIsMemberRecord(false);
          // Fallback to profiles table if not found in members
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", email)
            .maybeSingle();
            
          if (profile) {
            setMemberData({
              id: profile.id,
              firstName: profile.display_name?.split(' ')[0] || "",
              lastName: profile.display_name?.split(' ').slice(1).join(' ') || "",
              email: profile.email,
              role: profile.role,
              status: profile.role === "super_admin" ? "Super Admin" : (profile.role || "Membre"),
              civility: profile.civility || "M.",
              age: profile.age || "",
              phone: profile.phone || ""
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching member profile:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true";
    const activeUserInfo = getActiveUserInfo();
    const info = activeUserInfo ? JSON.stringify(activeUserInfo) : localStorage.getItem("poimen_user_info");
    
    // Only use mock admin if we don't have real user info in localStorage
    if (isLocalSuperAdmin && (!info || JSON.parse(info).id?.includes("mock"))) {
      const mockAdmin = {
        firstName: "Junior",
        lastName: "Super Admin",
        email: "minkojunior400@gmail.com",
        role: "super_admin",
        status: "Super Admin",
        civility: "M.",
        phone: "+33 6 00 00 00 00",
        age: "31-35 ans"
      };
      setTimeout(() => {
        setUserInfo(mockAdmin);
        setMemberData(mockAdmin);
        setLoading(false);
      }, 0);
      return;
    }

    if (info) {
      const parsed = JSON.parse(info);
      setTimeout(() => {
        setUserInfo(parsed);
        fetchMemberData(parsed.email, parsed.role, parsed.id, parsed.bergerie_id, parsed);
      }, 0);
    } else {
      setTimeout(() => setLoading(false), 0);
    }
  }, []);

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [46, 8, 9, 27, 13].includes(e.keyCode) ||
      (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+A
      (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+C
      (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+V
      (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+X
      (e.keyCode >= 35 && e.keyCode <= 39) // Fin, Début, Flèches
    ) {
      return;
    }
    const allowedChars = /[0-9+\-\s()]/;
    if (!allowedChars.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePhoneChange = (val: string) => {
    return val.replace(/[^0-9+\-\s()]/g, "");
  };

  const SPECIAL_ROLES = ["Berger", "Second", "Responsable", "Conseiller", "Super Admin"];
  const isSpecial = memberData && SPECIAL_ROLES.includes(memberData.status);
  const isIntegration = userInfo?.role?.toLowerCase().startsWith("integration_");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const isLocalSuperAdmin = localStorage.getItem("is_super_admin") === "true" && (!userInfo?.id || String(userInfo.id).includes("mock"));

      if (isLocalSuperAdmin) {
        const newUserInfo = {
          ...userInfo,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          email: memberData.email,
        };
        localStorage.setItem("poimen_user_info", JSON.stringify(newUserInfo));
        setUserInfo(newUserInfo);
        setMessage({ type: "success", text: "Profil administrateur mis à jour localement !" });
        setSaving(false);
        return;
      }

      // Check if email is changing in Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      let emailMessage = "";
      if (currentUser && memberData.email.toLowerCase().trim() !== currentUser.email?.toLowerCase().trim()) {
        const { data: authUpdate, error: authUpdateErr } = await supabase.auth.updateUser({
          email: memberData.email.toLowerCase().trim()
        });

        if (authUpdateErr) throw authUpdateErr;

        if (authUpdate.user?.new_email) {
          emailMessage = " Un e-mail de confirmation a été envoyé à votre nouvelle adresse. Veuillez valider le lien reçu pour confirmer le changement.";
        }
      }

      if (userInfo?.role === "super_admin") {
        const displayName = `${memberData.firstName} ${memberData.lastName}`;
        const { error } = await supabase
          .from("profiles")
          .update({
            display_name: displayName,
            email: memberData.email.toLowerCase().trim(),
            phone: memberData.phone || null,
            age: memberData.age || null,
            civility: memberData.civility || "M."
          })
          .eq("id", userInfo.id);

        if (error) throw error;

        // Proactively sync integration_email in churches table if this superadmin email was used as responsible
        const oldEmail = currentUser?.email?.toLowerCase().trim();
        if (oldEmail) {
          await supabase
            .from("churches")
            .update({ integration_email: memberData.email.toLowerCase().trim() })
            .eq("integration_email", oldEmail);
        }
      } else if (isIntegration) {
        const displayName = `${memberData.firstName} ${memberData.lastName}`;
        const { error } = await supabase
          .from("profiles")
          .update({
            display_name: displayName,
            email: memberData.email.toLowerCase().trim(),
            phone: memberData.phone || null,
            age: memberData.age || null,
            civility: memberData.civility || "M."
          })
          .eq("id", memberData.id);

        if (error) throw error;

        // Proactively sync integration_email in churches table for this responsible
        if (userInfo?.role === "integration_responsable" && userInfo.church_id) {
          await supabase
            .from("churches")
            .update({ integration_email: memberData.email.toLowerCase().trim() })
            .eq("id", userInfo.church_id);
        }
      } else {
        if (isMemberRecord) {
          // Update members table
          const { error } = await supabase
            .from("members")
            .update({
              civility: memberData.civility,
              first_name: memberData.firstName,
              last_name: memberData.lastName,
              phone: memberData.phone,
              email: memberData.email.toLowerCase().trim(),
              age: memberData.age
            })
            .eq("id", memberData.id);

          if (error) throw error;
        }

        // Sync with profiles table
        if (userInfo?.id) {
          const displayName = `${memberData.firstName} ${memberData.lastName}`;
          await supabase
            .from("profiles")
            .update({
              display_name: displayName,
              email: memberData.email.toLowerCase().trim(),
              phone: memberData.phone || null,
              age: memberData.age || null,
              civility: memberData.civility || "M."
            })
            .eq("id", userInfo.id);
        }
      }

      // Update localStorage
      const newUserInfo = {
        ...userInfo,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email.toLowerCase().trim(),
      };
      localStorage.setItem("poimen_user_info", JSON.stringify(newUserInfo));
      setUserInfo(newUserInfo);
      window.dispatchEvent(new Event("storage")); // Trigger sidebar update

      setMessage({ type: "success", text: `Profil mis à jour avec succès !${emailMessage}` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[var(--gold)]" size={40} />
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="p-8 text-center glass rounded-2xl border border-[rgba(212,175,55,0.15)] max-w-lg mx-auto mt-12">
        <AlertCircle className="mx-auto mb-4 text-[var(--red)]" size={48} />
        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>Profil introuvable</h2>
        <p className="text-[var(--muted)]">Nous n'avons pas pu charger vos informations personnelles.</p>
      </div>
    );
  }

  return (
    <div className="profile-page fade-in">
      {/* ── Page Header ── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="profile-header"
      >
        <div className="profile-header-glow" />
        <h1 className="profile-title">
          <User className="profile-title-icon" size={28} />
          Mon Profil
        </h1>
        <p className="profile-subtitle">Gérez vos informations personnelles et vos paramètres de sécurité.</p>
      </motion.div>

      <div className="profile-grid">
        {/* ══ Left Col: Avatar Card ══ */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="profile-sidebar"
        >
          <div className="profile-avatar-card">
            {/* Decorative top bar */}
            <div className="profile-avatar-card-accent" />

            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-ring">
                <User size={44} className="profile-avatar-icon" />
              </div>
              <button className="profile-avatar-camera" type="button">
                <Camera size={12} strokeWidth={2.5} />
              </button>
            </div>

            <div className="profile-avatar-info">
              <h2 className="profile-avatar-name">
                {memberData.firstName} {memberData.lastName}
              </h2>
              <div className="badge badge-gold profile-avatar-badge" style={{ marginBottom: 12 }}>
                {memberData.status || "Membre"}
              </div>
              <button
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                  } catch (err) {
                    console.error("Error signing out:", err);
                  }
                  localStorage.setItem("poimen_logging_out", "true");
                  localStorage.removeItem("poimen_active_context");
                  localStorage.removeItem("poimen_user_info");
                  localStorage.removeItem("selected_family");
                  localStorage.removeItem("is_super_admin");
                  window.location.href = "/";
                }}
                className="btn btn-outline btn-sm"
                style={{
                  width: "100%",
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  color: "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 34,
                  fontSize: 12,
                  fontWeight: 600,
                  marginTop: 6
                }}
              >
                <LogOut size={13} /> Se déconnecter
              </button>
            </div>
            
            <div className="profile-status-list">
              <div className="profile-status-item">
                <div className="profile-status-left">
                  <ShieldCheck size={16} className="profile-status-icon profile-status-icon--green" />
                  <span className="profile-status-label">Compte</span>
                </div>
                <span className="profile-status-value profile-status-value--green">Actif</span>
              </div>
              <div className="profile-status-item">
                <div className="profile-status-left">
                  <Lock size={16} className="profile-status-icon profile-status-icon--gold" />
                  <span className="profile-status-label">Sécurité</span>
                </div>
                <span className="profile-status-value profile-status-value--gold">Sécurisé</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══ Right Col: Forms ══ */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="profile-main"
        >
          {/* ── Personal Info Card ── */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-icon-wrap">
                <User size={18} />
              </div>
              <div>
                <h3 className="profile-card-title">Informations personnelles</h3>
                <p className="profile-card-desc">Modifiez votre identité et vos coordonnées.</p>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`profile-alert ${message.type === "success" ? "profile-alert--success" : "profile-alert--error"}`}
                  >
                    {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <p>{message.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="profile-form-grid">
                {/* Civilité */}
                <div className="profile-field">
                  <label className="form-label">Civilité</label>
                  <select 
                    value={memberData.civility || ""}
                    onChange={(e) => setMemberData({...memberData, civility: e.target.value})}
                    className="input w-full profile-input"
                  >
                    <option value="M.">M.</option>
                    <option value="Mme.">Mme.</option>
                  </select>
                </div>

                {/* Âge */}
                <div className="profile-field">
                  <label className="form-label">Tranche d'âge</label>
                  <select 
                    value={memberData.age || ""}
                    onChange={(e) => setMemberData({...memberData, age: e.target.value})}
                    className="input w-full profile-input"
                  >
                    <option value="" disabled>Sélectionnez</option>
                    {AGE_RANGES.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                </div>

                {/* Prénom */}
                <div className="profile-field">
                  <label className="form-label">Prénom</label>
                  <div className="profile-input-wrap">
                    <User className="profile-input-icon" size={15} />
                    <input 
                      type="text"
                      required
                      value={memberData.firstName || ""}
                      onChange={(e) => setMemberData({...memberData, firstName: e.target.value})}
                      className="input w-full profile-input profile-input--icon"
                    />
                  </div>
                </div>

                {/* Nom */}
                <div className="profile-field">
                  <label className="form-label">Nom</label>
                  <div className="profile-input-wrap">
                    <User className="profile-input-icon" size={15} />
                    <input 
                      type="text"
                      required
                      value={memberData.lastName || ""}
                      onChange={(e) => setMemberData({...memberData, lastName: e.target.value})}
                      className="input w-full profile-input profile-input--icon"
                    />
                  </div>
                </div>

                {/* Téléphone */}
                <div className="profile-field profile-field--full">
                  <label className="form-label">Téléphone</label>
                  <div className="profile-input-wrap">
                    <Phone className="profile-input-icon" size={15} />
                    <input 
                      type="text"
                      value={memberData.phone || ""}
                      onKeyDown={handlePhoneKeyDown}
                      onChange={(e) => setMemberData({...memberData, phone: handlePhoneChange(e.target.value)})}
                      placeholder="+32 470 12 34 56"
                      className="input w-full profile-input profile-input--icon"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="profile-field profile-field--full">
                  <label className="form-label">Email (Identifiant de Connexion)</label>
                  <div className="profile-input-wrap">
                    <Mail className="profile-input-icon" size={15} />
                    <input 
                      type="email"
                      required
                      value={memberData.email || ""}
                      onChange={(e) => setMemberData({...memberData, email: e.target.value})}
                      className="input w-full profile-input profile-input--icon"
                    />
                  </div>
                  <p className="profile-field-hint">L'email sert d'identifiant de connexion et de suivi.</p>
                </div>
              </div>

              <div className="profile-card-footer">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary profile-btn"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>

          {/* ── Change Password Card ── */}
          {userInfo?.role === "super_admin" ? (
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-card-icon-wrap profile-card-icon-wrap--lock" style={{ background: "rgba(212, 175, 55, 0.1)", color: "var(--gold)" }}>
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="profile-card-title">Sécurité & Mot de passe</h3>
                  <p className="profile-card-desc">Le mot de passe du Super Administrateur est géré au niveau de la configuration système sécurisée.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-card-icon-wrap profile-card-icon-wrap--lock">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="profile-card-title">Sécurité & Mot de passe</h3>
                  <p className="profile-card-desc">Mettez à jour votre mot de passe pour sécuriser votre compte.</p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword}>
                <AnimatePresence>
                  {pwdMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`profile-alert ${pwdMessage.type === "success" ? "profile-alert--success" : "profile-alert--error"}`}
                    >
                      {pwdMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <p>{pwdMessage.text}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="profile-form-grid">
                  {/* Nouveau mot de passe */}
                  <div className="profile-field">
                    <label className="form-label">Nouveau mot de passe</label>
                    <div className="profile-input-wrap">
                      <Lock className="profile-input-icon" size={15} />
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input w-full profile-input profile-input--icon profile-input--pwd"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="profile-pwd-toggle"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmer */}
                  <div className="profile-field">
                    <label className="form-label">Confirmer le mot de passe</label>
                    <div className="profile-input-wrap">
                      <Lock className="profile-input-icon" size={15} />
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input w-full profile-input profile-input--icon profile-input--pwd"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="profile-pwd-toggle"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="profile-card-footer">
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="btn btn-primary profile-btn"
                  >
                    {pwdLoading ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                    Mettre à jour
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
