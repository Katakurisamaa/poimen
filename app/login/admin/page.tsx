"use client";

import { useState } from "react";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanEmail = email.toLowerCase().trim();
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authErr) {
        throw authErr;
      }

      // Check if user is Super Admin in Profiles table
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profErr || !profile || (profile.role !== "super_admin" && cleanEmail !== "minkojunior400@gmail.com")) {
        await supabase.auth.signOut();
        throw new Error("Accès refusé. Cette console est réservée aux Super Administrateurs.");
      }

      localStorage.setItem("is_super_admin", "true");
      localStorage.setItem("poimen_user_info", JSON.stringify({
        id: profile.id,
        email: cleanEmail,
        role: "super_admin",
        firstName: profile.display_name?.split(' ')[0] || "Super",
        lastName: profile.display_name?.split(' ').slice(1).join(' ') || "Admin",
      }));

      window.location.href = "/dashboard/admin";
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects. Accès réservé au Super Admin.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Ambient glows */}
      <div style={{ position: "absolute", top: "10%", left: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,160,60,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 12px" }}>
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--gold-light)", margin: 0 }}>Poimén</h1>
          <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 3, textTransform: "uppercase", marginTop: 6 }}>Administration Centrale</p>
        </div>

        <div className="glass" style={{ padding: "32px 28px", border: "1px solid var(--gold-glow)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 28 }}>Connexion Super Admin</h2>

          {error && (
            <div className="fade-in" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--red)", color: "var(--red)", padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 20, textAlign: "center" }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="form-label">Identifiant Admin</label>
              <input className="input" type="email" placeholder="admin@poimen.org" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Mot de passe</label>
              <div style={{ position: "relative" }}>
                <input className="input" type={show ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: "12px 0", fontSize: 13, justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? <span className="spinner" /> : <><LogIn size={16} /> Authentification</>}
            </button>
            <Link href="/" style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", textDecoration: "none", marginTop: 12 }}>Retour à l'accueil</Link>
          </form>
        </div>
      </div>
    </div>
  );
}
