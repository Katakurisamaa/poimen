"use client";

import { useState, useEffect } from "react";
import { 
  User, Mail, Phone, Lock, Save, Loader2, 
  CheckCircle2, AlertCircle, Camera, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [memberData, setMemberData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);


  const SPECIAL_ROLES = ["Berger", "Second", "Responsable", "Conseiller", "Super Admin"];
  const isSpecial = memberData && SPECIAL_ROLES.includes(memberData.status);

  useEffect(() => {
    const info = localStorage.getItem("poimen_user_info");
    if (info) {
      const parsed = JSON.parse(info);
      setUserInfo(parsed);
      fetchMemberData(parsed.email);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMemberData = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("email", email)
        .single();

      if (data) {
        setMemberData({
          ...data,
          firstName: data.first_name,
          lastName: data.last_name
        });
        // Profile check can be kept for future avatar_url usage (images)
        const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("email", email).maybeSingle();
      }
    } catch (err) {
      console.error("Error fetching member profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Update members table
      const { error } = await supabase
        .from("members")
        .update({
          civility: memberData.civility,
          first_name: memberData.firstName,
          last_name: memberData.lastName,
          phone: memberData.phone,
          email: memberData.email,
          age: memberData.age
        })
        .eq("id", memberData.id);

      if (error) throw error;

      // Update profiles table if needed (placeholder for image upload)
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user) {
        // No avatar effect anymore
      }

      // Update localStorage
      const newUserInfo = {
        ...userInfo,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email,
      };
      localStorage.setItem("poimen_user_info", JSON.stringify(newUserInfo));
      setUserInfo(newUserInfo);
      window.dispatchEvent(new Event("storage")); // Trigger sidebar update

      setMessage({ type: "success", text: "Profil mis à jour avec succès !" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gold" size={40} />
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
        <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
        <h2 className="text-2xl font-bold text-white mb-2">Profil introuvable</h2>
        <p className="text-white/60">Nous n'avons pas pu charger vos informations personnelles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8"
      >
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <User className="text-gold" />
          Mon Profil
        </h1>
        <p className="text-white/60 mt-2">Gérez vos informations personnelles et vos paramètres d'accès.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Avatar & Status */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <div className="glass" style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minHeight: "100%" }}>
            <div style={{ position: "relative", marginBottom: "32px" }}>
              <div className="w-28 h-28 rounded-full border-2 border-gold/30 flex items-center justify-center bg-white/5 overflow-hidden shadow-[0_0_30px_rgba(212,160,60,0.1)] relative z-10">
                <User size={48} className="text-gold/40" />
              </div>
              <div className="absolute bottom-1 right-1 p-2 bg-gold text-navy rounded-full shadow-lg z-20">
                <Camera size={14} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white leading-tight" style={{ marginBottom: "12px" }}>
              {memberData.firstName} {memberData.lastName}
            </h2>
            <div className="inline-block px-4 py-1 rounded-full border border-gold/20 bg-gold/5 text-gold text-[10px] font-black uppercase tracking-[2px]" style={{ marginBottom: "40px" }}>
              {memberData.status}
            </div>
            
            <div className="w-full border-t border-white/5" style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="flex items-center justify-between bg-white/5 rounded-xl border border-white/10" style={{ padding: "14px 18px" }}>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-green-500" />
                  <span className="text-xs font-medium text-white/70">Compte</span>
                </div>
                <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded uppercase tracking-wider">Vérifié</span>
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-xl border border-white/10" style={{ padding: "14px 18px" }}>
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-gold/50" />
                  <span className="text-xs font-medium text-white/70">Sécurité</span>
                </div>
                <span className="text-[10px] font-bold text-gold/60 bg-gold/10 px-2 py-0.5 rounded uppercase tracking-wider">Activée</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Col: Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <div className="glass" style={{ padding: "40px" }}>
            <form onSubmit={handleSave} className="space-y-8">
              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-xl flex items-center gap-3 ${
                      message.type === "success" 
                        ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{message.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                {/* Civilité */}
                <div className="flex flex-col gap-2">
                  <label className="form-label">Civilité</label>
                  <select 
                    value={memberData.civility}
                    onChange={(e) => setMemberData({...memberData, civility: e.target.value})}
                    className="input w-full"
                    style={{ height: '48px' }}
                  >
                    <option value="M.">Monsieur (M.)</option>
                    <option value="Mme">Madame (Mme)</option>
                    <option value="Mlle">Mademoiselle (Mlle)</option>
                  </select>
                </div>

                {/* Âge */}
                <div className="flex flex-col gap-2">
                  <label className="form-label">Âge</label>
                  <input 
                    type="number"
                    value={memberData.age || ""}
                    onChange={(e) => setMemberData({...memberData, age: e.target.value})}
                    placeholder="Votre âge"
                    className="input w-full"
                    style={{ height: '48px' }}
                  />
                </div>

                {/* Prénom */}
                <div className="flex flex-col gap-2">
                  <label className="form-label">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text"
                      required
                      value={memberData.firstName}
                      onChange={(e) => setMemberData({...memberData, firstName: e.target.value})}
                      className="input w-full"
                      style={{ height: '48px', paddingLeft: '48px' }}
                    />
                  </div>
                </div>

                {/* Nom */}
                <div className="flex flex-col gap-2">
                  <label className="form-label">Nom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text"
                      required
                      value={memberData.lastName}
                      onChange={(e) => setMemberData({...memberData, lastName: e.target.value})}
                      className="input w-full"
                      style={{ height: '48px', paddingLeft: '48px' }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="form-label">Email (Identifiant)</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="email"
                      required
                      value={memberData.email}
                      onChange={(e) => setMemberData({...memberData, email: e.target.value})}
                      className="input w-full"
                      style={{ height: '48px', paddingLeft: '48px' }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 italic ml-1 mt-1">L'email sert d'identifiant de connexion.</p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary px-10"
                  style={{ height: '50px' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
