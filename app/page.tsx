"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Lock, ChevronRight, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<any | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    const { data } = await supabase.from("churches").select("*").order("name");
    if (data) setChurches(data);
    setLoading(false);
  };

  const filteredChurches = churches.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  const handleValidateCode = () => {
    if (!selectedChurch) return;
    setValidating(true);
    setError("");

    if (code === selectedChurch.access_code) {
      localStorage.setItem("selected_church", JSON.stringify(selectedChurch));
      router.push("/dashboard");
    } else {
      setError("Code d'accès invalide. Veuillez réessayer.");
      setValidating(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", padding: "40px 20px" }}>
      {/* Background Decor */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(212,160,60,0.03) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(91,168,224,0.02) 0%, transparent 70%)" }} />
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 60 }} className="fade-in">
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 700, color: "var(--gold-light)", marginBottom: 12 }}>Poimén</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", letterSpacing: 4, textTransform: "uppercase" }}>Plateforme des Familles de Disciples</p>
          <div style={{ height: 1, width: 60, background: "var(--gold)", margin: "24px auto" }} />
          <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 20 }}>Sélectionnez votre église local</h2>
        </header>

        {/* Search Bar */}
        <div className="glass-compact fade-in d1" style={{ maxWidth: 500, margin: "0 auto 40px", display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
          <Search size={18} style={{ color: "var(--muted)" }} />
          <input 
            type="text" 
            placeholder="Rechercher une église..." 
            className="input" 
            style={{ background: "none", border: "none", padding: "8px 0" }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Church Grid */}
        <div className="bento bento-3 fade-in d2">
          {filteredChurches.map((church) => (
            <motion.div 
              key={church.id}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              className="glass stat-card"
              style={{ cursor: "pointer", textAlign: "left", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
              onClick={() => setSelectedChurch(church)}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                <MapPin size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{church.name}</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{church.city}, {church.country}</p>
              </div>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Entrer</span>
                <ChevronRight size={16} style={{ color: "var(--gold)" }} />
              </div>
            </motion.div>
          ))}
        </div>

        {filteredChurches.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
            Aucune église trouvée pour "{search}"
          </div>
        )}
      </div>

      {/* Super Admin Access */}
      <footer style={{ marginTop: 80, textAlign: "center", padding: "20px 0", borderTop: "1px solid var(--border)", opacity: 0.5 }}>
        <a href="/login/admin" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", letterSpacing: 1, textTransform: "uppercase" }}>
          Accès Administration Centrale
        </a>
      </footer>

      {/* Code Modal */}
      <AnimatePresence>
        {selectedChurch && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass"
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
              onClick={() => { setSelectedChurch(null); setCode(""); setError(""); }}
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass"
              style={{ width: "100%", maxWidth: 400, padding: 40, position: "relative", zIndex: 101, border: "1px solid var(--gold-glow)" }}
            >
              <button 
                onClick={() => { setSelectedChurch(null); setCode(""); setError(""); }}
                style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>

              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gold-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", margin: "0 auto 16px" }}>
                  <Lock size={32} />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Code d'accès</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>Veuillez entrer le code pour <strong>{selectedChurch.name}</strong></p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <input 
                    type="text" 
                    placeholder="Entrez le code..." 
                    className="input" 
                    style={{ textAlign: "center", fontSize: 20, letterSpacing: 4, textTransform: "uppercase", height: 60 }}
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleValidateCode()}
                    autoFocus
                  />
                  {error && <p style={{ color: "var(--red)", fontSize: 12, textAlign: "center", marginTop: 8 }}>{error}</p>}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", height: 50, justifyContent: "center" }}
                  onClick={handleValidateCode}
                  disabled={validating || !code}
                >
                  {validating ? <Loader2 className="animate-spin" /> : "Vérifier et entrer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
