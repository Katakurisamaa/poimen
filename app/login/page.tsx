"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, MapPin, AlertCircle, ShieldCheck, Users, UserRoundCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { adminSignUp } from "@/app/actions/auth";
import { contextLabel, contextToUserInfo, inferContextType, type UserContextRecord } from "@/lib/auth-contexts";
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
  const [availableContexts, setAvailableContexts] = useState<UserContextRecord[]>([]);

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

  const legacyProfileToContext = (profile: any, userId: string, cleanEmail: string): UserContextRecord => ({
    id: `legacy-${userId}`,
    user_id: userId,
    email: profile?.email || cleanEmail,
    context_type: inferContextType(profile?.role, profile?.bergerie_id),
    role: profile?.role || "membre",
    church_id: profile?.church_id || null,
    bergerie_id: profile?.bergerie_id || null,
    display_name: profile?.display_name || cleanEmail.split("@")[0],
    active: true
  });

  const loadContexts = async (userId: string, cleanEmail: string, fallbackProfile?: any) => {
    const { data: contexts, error: contextsError } = await supabase
      .from("user_contexts")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("context_type", { ascending: true });

    if (!contextsError && contexts?.length) {
      return contexts as UserContextRecord[];
    }

    if (fallbackProfile) {
      return [legacyProfileToContext(fallbackProfile, userId, cleanEmail)];
    }

    return [];
  };

  const applyContext = async (context: UserContextRecord) => {
    const userInfo = contextToUserInfo(context);

    localStorage.setItem("poimen_active_context", JSON.stringify(context));
    localStorage.setItem("poimen_user_info", JSON.stringify(userInfo));
    localStorage.removeItem("poimen_space_exited");

    if (context.context_type === "super_admin") {
      localStorage.setItem("is_super_admin", "true");
      localStorage.removeItem("selected_family");
      router.push("/dashboard/admin");
      return;
    }

    localStorage.removeItem("is_super_admin");

    if (context.church_id) {
      const { data: chInfo } = await supabase
        .from("churches")
        .select("*")
        .eq("id", context.church_id)
        .maybeSingle();
      if (chInfo) {
        localStorage.setItem("selected_church", JSON.stringify(chInfo));
      }
    }

    if (context.bergerie_id) {
      const { data: familyInfo } = await supabase
        .from("bergeries")
        .select("*")
        .eq("id", context.bergerie_id)
        .maybeSingle();
      if (familyInfo) {
        localStorage.setItem("selected_family", JSON.stringify(familyInfo));
      }
    } else {
      localStorage.removeItem("selected_family");
    }

    router.push("/dashboard");
  };

  const continueWithContexts = async (contexts: UserContextRecord[]) => {
    if (contexts.length > 1) {
      localStorage.removeItem("poimen_active_context");
      localStorage.removeItem("poimen_user_info");
      localStorage.removeItem("selected_family");
      localStorage.removeItem("is_super_admin");
      localStorage.removeItem("poimen_space_exited");
      setAvailableContexts(contexts);
      setLoading(false);
      return;
    }

    if (contexts.length === 1) {
      await applyContext(contexts[0]);
      return;
    }

    router.push("/dashboard");
  };

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

      const contexts = await loadContexts(data.user.id, cleanEmail, activeProfile);
      await continueWithContexts(contexts);
    } catch (err: any) {
      // Intercept credentials error to see if they are a first-time integration user
      if (err.message === "Invalid login credentials") {
        try {
          const res = await adminSignUp(cleanEmail, password);
          if (!res.success) {
            throw new Error(res.error);
          }

          if (res.requiresPrimaryPassword) {
            setError("Cette adresse existe deja. La casquette a ete ajoutee si le code est valide : reconnectez-vous avec votre mot de passe principal pour choisir l'espace.");
            setLoading(false);
            return;
          }

          const signUpUser = res.user;
          if (signUpUser) {
            // Sign in client-side to establish token session
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (signInErr) throw signInErr;

            const contexts = res.context
              ? [res.context as UserContextRecord]
              : await loadContexts(signUpUser.id, cleanEmail);
            await continueWithContexts(contexts);
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

          {availableContexts.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <p style={{ margin: 0, color: "var(--text)", fontSize: 13, fontWeight: 700 }}>Choisissez votre espace</p>
              {availableContexts.map((context) => {
                const Icon = context.context_type === "super_admin" ? ShieldCheck : context.context_type === "integration" ? UserRoundCheck : Users;

                return (
                  <button
                    key={context.id || `${context.context_type}-${context.role}-${context.bergerie_id || context.church_id}`}
                    type="button"
                    onClick={() => applyContext(context)}
                    className="glass"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      border: "1px solid var(--line)",
                      color: "var(--text)",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--gold-glow)", color: "var(--gold)", flex: "0 0 auto" }}>
                      <Icon size={18} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 800, fontSize: 14 }}>{contextLabel(context)}</span>
                      <span style={{ display: "block", color: "var(--muted)", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {context.display_name || context.email} · {context.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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
