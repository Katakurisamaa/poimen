"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { adminSignUp } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [church, setChurch] = useState<{ name: string; city: string } | null>(null);

  // Safely initialize state after mount to avoid server/client mismatch and effect warnings
  useEffect(() => {
    const savedChurch = localStorage.getItem("selected_church");
    if (savedChurch) {
      try {
        const parsed = JSON.parse(savedChurch);
        setTimeout(() => setChurch(parsed), 0);
      } catch (e) {}
    }

    const savedEmail = localStorage.getItem("poimen_remember_email");
    if (savedEmail) {
      setTimeout(() => {
        setEmail(savedEmail);
        setRememberMe(true);
      }, 0);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.toLowerCase().trim();

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) throw authError;

      if (rememberMe) {
        localStorage.setItem("poimen_remember_email", cleanEmail);
      } else {
        localStorage.removeItem("poimen_remember_email");
      }

      const mapToDBRole = (role: string) => {
        if (!role) return "membre";
        const r = role.toLowerCase().trim();
        if (r === 'responsable') return 'responsable de brebi';
        if (r === 'second') return 'second du berger';
        return r;
      };

      // Récupérer le profil pour stocker les infos de session locales
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user?.id)
        .single();

      if (profErr) {
        console.error("Login Page submit: Error fetching profile from DB:", profErr.message, profErr.details);
      }

      let activeProfile = profile;
      if (!activeProfile && data.user) {
        // Self-healing profile on login
        // Check integration responsable
        const { data: churchData } = await supabase
          .from("churches")
          .select("*")
          .eq("integration_email", cleanEmail)
          .maybeSingle();

        if (churchData) {
          const displayName = (churchData.integration_first_name && churchData.integration_last_name)
            ? `${churchData.integration_first_name} ${churchData.integration_last_name}`
            : "Responsable Intégration";

          const { data: newProfile, error: insErr } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              email: cleanEmail,
              display_name: displayName,
              role: "integration_responsable",
              church_id: churchData.id
            })
            .select()
            .single();
          if (insErr) console.error("Self-healing: Error inserting responsable integration profile:", insErr);
          if (newProfile) activeProfile = newProfile;
        } else {
          // Check pending counselor
          const { data: pendingCounselor } = await supabase
            .from("pending_counselors")
            .select("*")
            .eq("email", cleanEmail)
            .maybeSingle();

          if (pendingCounselor) {
            const displayName = `${pendingCounselor.first_name} ${pendingCounselor.last_name}`;
            const { data: newProfile, error: insErr } = await supabase
              .from("profiles")
              .insert({
                id: data.user.id,
                email: cleanEmail,
                display_name: displayName,
                role: mapToDBRole(pendingCounselor.role),
                church_id: pendingCounselor.church_id
              })
              .select()
              .single();
            if (insErr) console.error("Self-healing: Error inserting pending counselor profile:", insErr);
            if (newProfile) {
              activeProfile = newProfile;
              await supabase.from("pending_counselors").delete().eq("id", pendingCounselor.id);
            }
          } else {
            // Check member
            const { data: member } = await supabase
              .from("members")
              .select("*, bergeries(*)")
              .eq("email", cleanEmail)
              .maybeSingle();

            if (member) {
              const displayName = `${member.first_name} ${member.last_name}`;
              const dbRole = mapToDBRole(member.status);
              const { data: newProfile, error: insErr } = await supabase
                .from("profiles")
                .insert({
                  id: data.user.id,
                  email: cleanEmail,
                  display_name: displayName,
                  role: dbRole,
                  bergerie_id: member.bergerie_id,
                  church_id: member.bergeries?.church_id
                })
                .select()
                .single();
              if (insErr) console.error(`Self-healing: Error inserting member profile (role: ${dbRole}):`, insErr);
              if (newProfile) activeProfile = newProfile;
            }
          }
        }

        // ULTIMATE FALLBACK: If still no profile, create a default profile row for this auth user!
        if (!activeProfile) {
          const { data: chData } = await supabase.from("churches").select("id").limit(1);
          const defaultChurchId = chData?.[0]?.id;
          const displayName = cleanEmail.split('@')[0] || "Nouvel Équipier";
          
          const { data: newProfile, error: insErr } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              email: cleanEmail,
              display_name: displayName,
              role: "integration_counselor",
              church_id: defaultChurchId
            })
            .select()
            .single();
            
          if (!insErr && newProfile) {
            activeProfile = newProfile;
          } else {
            console.error("Ultimate fallback profile creation failed:", insErr);
          }
        }
      }

      if (activeProfile) {
        localStorage.setItem("poimen_user_info", JSON.stringify({
          id: activeProfile.id,
          email: activeProfile.email,
          role: activeProfile.role,
          firstName: activeProfile.display_name?.split(' ')[0] || '',
          lastName: activeProfile.display_name?.split(' ').slice(1).join(' ') || '',
          church_id: activeProfile.church_id
        }));

        // Load and save church details for integration roles
        if (activeProfile.church_id && activeProfile.role?.toLowerCase().startsWith("integration_")) {
          const { data: chInfo } = await supabase
            .from("churches")
            .select("*")
            .eq("id", activeProfile.church_id)
            .single();

          if (chInfo) {
            localStorage.setItem("selected_church", JSON.stringify(chInfo));
          }
        }
      }

      router.push("/dashboard");
    } catch (err: any) {
      // Intercept credentials error to see if they are a first-time integration user
      if (err.message === "Invalid login credentials") {
        try {
          const res = await adminSignUp(cleanEmail, password);
          if (!res.success) {
            throw new Error(res.error);
          }

          const signUpUser = res.user;
          if (signUpUser) {
            // Sign in client-side to establish token session
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (signInErr) throw signInErr;

            // Store session locals
            localStorage.setItem("poimen_user_info", JSON.stringify({
              id: signUpUser.id,
              email: cleanEmail,
              role: res.role,
              firstName: res.displayName?.split(' ')[0] || "",
              lastName: res.displayName?.split(' ').slice(1).join(' ') || "",
              church_id: res.churchId,
              bergerie_id: res.bergerieId
            }));

            if (res.churchData) {
              localStorage.setItem("selected_church", JSON.stringify(res.churchData));
            }
            if (res.familyData) {
              localStorage.setItem("selected_family", JSON.stringify(res.familyData));
            }

            router.push("/dashboard");
            return;
          }
        } catch (innerErr: any) {
          console.error("Dynamic signup error:", innerErr);
          setError(innerErr.message || "Email ou mot de passe incorrect");
          setLoading(false);
          return;
        }
      }

      setError(err.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Ambient glows */}
      <div style={{ position: "absolute", top: "10%", left: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,168,224,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "20%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,160,60,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 700, color: "var(--gold-light)", letterSpacing: "-0.02em", margin: 0 }}>Poimén</h1>
          <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 3, textTransform: "uppercase", marginTop: 6 }}>Famille de Disciple</p>
        </div>

        <div className="glass" style={{ padding: "32px 28px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>Connexion</h2>
          
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "10px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12 }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          
          {church && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20, padding: "8px 12px", background: "var(--gold-glow)", borderRadius: 8, border: "1px solid rgba(212,160,60,0.1)" }}>
              <MapPin size={14} style={{ color: "var(--gold)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-light)" }}>{church.name}</span>
              <Link href="/" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8, textDecoration: "underline" }}>Changer</Link>
            </div>
          )}
          
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginBottom: 28 }}>Accédez à votre espace Poimén</p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="form-label">Adresse e-mail</label>
              <input className="input" type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Mot de passe</label>
              <div style={{ position: "relative" }}>
                <input className="input" type={show ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ accentColor: "var(--gold)" }} 
                /> Se souvenir de moi
              </label>
              <Link href="/forgot" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}>Mot de passe oublié ?</Link>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: "12px 0", fontSize: 13, justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? <span className="spinner" /> : <><LogIn size={16} /> Se connecter</>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", marginTop: 28, letterSpacing: 1 }}>© 2025 ICC · Poimén v1.0</p>
      </div>
    </div>
  );
}
