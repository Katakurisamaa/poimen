"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Church, MapPin, Key, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { setupChurch } from "@/app/actions/church";

function SetupChurchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [church, setChurch] = useState({
    name: "",
    city: "",
    country: "Belgique",
    access_code: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!church.name.trim()) {
      setError("Le nom de l'église est obligatoire.");
      return;
    }
    if (!church.city.trim()) {
      setError("La ville est obligatoire.");
      return;
    }

    setLoading(true);
    
    const res = await setupChurch(token || "", {
      name: church.name,
      city: church.city,
      country: church.country,
      access_code: church.access_code || undefined
    });

    if (!res.success || !res.church) {
      setError("Erreur : " + (res.error || "Impossible de configurer l'église."));
      setLoading(false);
      return;
    }

    setChurch(prev => ({ ...prev, access_code: res.church.access_code }));
    setStep("success");
    setLoading(false);
  };

  if (!token) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="glass" style={{ maxWidth: 450, padding: 40, textAlign: "center" }}>
          <AlertTriangle size={48} style={{ color: "var(--orange)", margin: "0 auto 20px" }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Lien invalide</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
            Ce lien d'invitation est invalide ou a expiré. Veuillez contacter l'administrateur pour obtenir un nouveau lien.
          </p>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => router.push("/")}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        {/* Background Decor */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(61,191,140,0.05) 0%, transparent 70%)" }} />
        </div>

        <div className="glass fade-in" style={{ maxWidth: 500, padding: 48, textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(61,191,140,0.1)", border: "2px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle2 size={40} style={{ color: "var(--green)" }} />
          </div>
          
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Église enregistrée !</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
            <strong style={{ color: "var(--gold-light)" }}>{church.name}</strong> a été ajoutée avec succès à la plateforme Poimén.
          </p>

          <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 24, marginBottom: 32, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontWeight: 700, marginBottom: 12 }}>Code d'accès de votre église</p>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 6, color: "var(--gold)", fontFamily: "monospace" }}>
              {church.access_code}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              Communiquez ce code à vos membres pour qu'ils puissent accéder à la plateforme.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button 
              className="btn btn-primary" 
              style={{ width: "100%", justifyContent: "center", height: 50 }} 
              onClick={() => router.push("/")}
            >
              Accéder à Poimén
            </button>
            <button 
              className="btn btn-subtle" 
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                navigator.clipboard.writeText(church.access_code);
                alert("Code copié !");
              }}
            >
              Copier le code d'accès
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Background Decor */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(212,160,60,0.04) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(91,168,224,0.03) 0%, transparent 70%)" }} />
      </div>

      <div className="glass fade-in" style={{ width: "100%", maxWidth: 520, padding: 40, position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 16px" }}>
            <Church size={32} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--gold-light)", marginBottom: 8 }}>Poimén</h1>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Enregistrez votre Église</h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Vous avez été invité à rejoindre la plateforme. Remplissez les informations ci-dessous pour configurer votre église.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6, display: "block" }}>
              Nom de l'église *
            </label>
            <input
              className="input"
              placeholder="ex: ICC Charleroi"
              value={church.name}
              onChange={e => setChurch({ ...church, name: e.target.value })}
              required
              style={{ height: 48 }}
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6, display: "block" }}>
                Ville *
              </label>
              <div style={{ position: "relative" }}>
                <MapPin size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                <input
                  className="input"
                  placeholder="Charleroi"
                  value={church.city}
                  onChange={e => setChurch({ ...church, city: e.target.value })}
                  required
                  style={{ paddingLeft: 36, height: 48 }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6, display: "block" }}>
                Pays
              </label>
              <input
                className="input"
                value={church.country}
                onChange={e => setChurch({ ...church, country: e.target.value })}
                style={{ height: 48 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6, display: "block" }}>
              Code d'accès secret
            </label>
            <div style={{ position: "relative" }}>
              <Key size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gold)" }} />
              <input
                className="input"
                placeholder="Laissez vide pour en générer un automatiquement"
                value={church.access_code}
                onChange={e => setChurch({ ...church, access_code: e.target.value.toUpperCase() })}
                style={{ paddingLeft: 36, height: 48, letterSpacing: 2 }}
              />
            </div>
            <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
              Ce code sera requis par vos membres pour accéder à la plateforme. Si vous n'en saisissez pas, il sera généré automatiquement.
            </p>
          </div>

          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, padding: "10px 16px", color: "#ef4444", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", height: 52, justifyContent: "center", fontSize: 16, fontWeight: 700, marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Enregistrer mon Église"}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 24 }}>
          En enregistrant votre église, vous acceptez de rejoindre l'écosystème Poimén.
        </p>
      </div>

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function SetupChurchPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--gold)" }} />
      </div>
    }>
      <SetupChurchContent />
    </Suspense>
  );
}
