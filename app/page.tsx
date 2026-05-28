"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Lock, ChevronRight, X, Loader2, Church, Flame } from "lucide-react";
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

  const fetchChurches = async () => {
    const { data } = await supabase.from("churches").select("*").order("name");
    if (data) {
      setTimeout(() => setChurches(data), 0);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("poimen_logging_out") === "true") {
      localStorage.removeItem("selected_family");
      localStorage.removeItem("poimen_user_info");
      localStorage.removeItem("poimen_user");
      localStorage.removeItem("is_super_admin");
      localStorage.removeItem("poimen_logging_out");
      window.dispatchEvent(new Event("storage"));
    }
    setTimeout(() => {
      fetchChurches();
    }, 0);
  }, []);

  const filteredChurches = churches.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  const handleValidateCode = async () => {
    if (!selectedChurch) return;
    setValidating(true);
    setError("");

    try {
      const { data: isValid, error: rpcErr } = await supabase.rpc("verify_church_code", {
        p_church_id: selectedChurch.id,
        p_code: code
      });

      if (rpcErr) {
        // Safe fallback if patch_v3.5 has not been applied to Supabase SQL editor yet
        if (rpcErr.code === "PGRST202" || rpcErr.message?.includes("verify_church_code")) {
          console.warn("verify_church_code RPC not found. Falling back to client-side verification. Please apply patch_v3.5 SQL.");
          if (code === selectedChurch.access_code) {
            localStorage.setItem("selected_church", JSON.stringify(selectedChurch));
            router.push("/dashboard");
          } else {
            setError("Code d'accès invalide. Veuillez réessayer.");
            setValidating(false);
          }
          return;
        }
        throw rpcErr;
      }

      if (isValid) {
        localStorage.setItem("selected_church", JSON.stringify(selectedChurch));
        router.push("/dashboard");
      } else {
        setError("Code d'accès invalide. Veuillez réessayer.");
        setValidating(false);
      }
    } catch (err: any) {
      console.error("Code verification error:", err);
      setError("Erreur de validation. Veuillez réessayer.");
      setValidating(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "white", padding: "60px 20px", overflowX: "hidden", position: "relative" }}>
      {/* Background Decor - Divine Angelic Lights */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Liturgical Violet Aura */}
        <motion.div 
          animate={{
            scale: [1, 1.12, 0.93, 1],
            x: [0, 40, -30, 0],
            y: [0, -50, 30, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            position: "absolute", 
            top: "-15%", 
            right: "-10%", 
            width: "60vw", 
            height: "60vw", 
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, rgba(212,175,55,0.015) 50%, transparent 70%)",
            filter: "blur(70px)"
          }} 
        />
        
        {/* Celestial Gold Aura */}
        <motion.div 
          animate={{
            scale: [1, 0.92, 1.15, 1],
            x: [0, -30, 40, 0],
            y: [0, 40, -40, 0],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            position: "absolute", 
            bottom: "-15%", 
            left: "-10%", 
            width: "55vw", 
            height: "55vw", 
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, rgba(56,189,248,0.015) 50%, transparent 70%)",
            filter: "blur(70px)"
          }} 
        />

        {/* Dynamic Center Sparkle Glow */}
        <div style={{ 
          position: "absolute", 
          top: "25%", 
          left: "30%", 
          width: "40vw", 
          height: "40vw", 
          background: "radial-gradient(circle, rgba(139,92,246,0.02) 0%, transparent 60%)",
          filter: "blur(90px)"
        }} />
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 50, position: "relative" }} className="fade-in">
          {/* Sublime Liturgical Indicator */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, gap: 8 }}>
            <Flame size={16} style={{ color: "var(--gold)", opacity: 0.7 }} className="animate-pulse" />
            <div style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, var(--gold))" }} />
          </div>
          
          <h1 style={{ 
            fontFamily: "var(--font-display)", 
            fontSize: 66, 
            fontWeight: 800, 
            marginBottom: 8,
            letterSpacing: "-0.01em",
            background: "linear-gradient(135deg, #FFF6D6 0%, #D4AF37 55%, #AA771C 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 25px rgba(212,175,55,0.18))"
          }}>
            Poimén
          </h1>
          
          <p style={{ 
            fontSize: 11, 
            color: "var(--gold-light)", 
            letterSpacing: 6, 
            textTransform: "uppercase", 
            fontWeight: 700,
            opacity: 0.8,
            margin: "0 auto",
            maxWidth: 400
          }}>
            Plateforme des Familles de Disciples
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "24px auto 32px" }}>
            <div style={{ height: 1, width: 45, background: "linear-gradient(90deg, transparent, var(--gold))" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", border: "1.5px solid var(--gold)" }} />
            <div style={{ height: 1, width: 45, background: "linear-gradient(270deg, transparent, var(--gold))" }} />
          </div>

          <h2 style={{ 
            fontSize: 22, 
            fontWeight: 500, 
            color: "var(--cream)", 
            fontFamily: "var(--font-body)", 
            letterSpacing: "0.02em" 
          }}>
            Sélectionnez votre église locale
          </h2>
        </header>

        {/* Search Bar */}
        <div 
          className="glass-compact fade-in d1" 
          style={{ 
            maxWidth: 480, 
            margin: "0 auto 45px", 
            display: "flex", 
            alignItems: "center", 
            gap: 12, 
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(212, 175, 55, 0.22)",
            background: "rgba(10, 6, 22, 0.65)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
          }}
        >
          <Search size={18} style={{ color: "var(--gold-light)", opacity: 0.8 }} />
          <input 
            type="text" 
            placeholder="Rechercher une église..." 
            className="input" 
            style={{ 
              background: "none", 
              border: "none", 
              padding: "6px 0", 
              boxShadow: "none",
              fontSize: "14px"
            }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Church Grid */}
        <div className="bento bento-3 fade-in d2">
          {filteredChurches.map((church) => (
            <motion.div 
              key={church.id}
              whileHover={{ scale: 1.03, y: -6 }}
              whileTap={{ scale: 0.98 }}
              className="arch-card"
              style={{ 
                cursor: "pointer", 
                textAlign: "left", 
                padding: "36px 24px 28px", 
                display: "flex", 
                flexDirection: "column", 
                gap: 20 
              }}
              onClick={() => setSelectedChurch(church)}
            >
              {/* Arch ornament decor at top */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 4, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", borderRadius: "0 0 4px 4px" }} />
              
              <div style={{ 
                width: 52, 
                height: 52, 
                borderRadius: "50%", 
                background: "linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(139,92,246,0.05) 100%)", 
                border: "1px solid rgba(212, 175, 55, 0.3)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "var(--gold-light)",
                boxShadow: "0 0 15px rgba(212, 175, 55, 0.1)"
              }}>
                <Church size={24} />
              </div>
              
              <div>
                <h3 style={{ 
                  fontSize: 20, 
                  fontWeight: 700, 
                  margin: 0, 
                  color: "var(--cream)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.01em"
                }}>
                  {church.name}
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} style={{ color: "var(--gold)", opacity: 0.8 }} />
                  {church.city}, {church.country}
                </p>
              </div>
              
              <div style={{ 
                marginTop: "auto", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.03)"
              }}>
                <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.8 }}>Entrer</span>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: "50%", 
                  background: "rgba(212, 175, 55, 0.1)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "var(--gold-light)" 
                }}>
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredChurches.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            Aucune église locale trouvée pour "{search}"
          </div>
        )}
      </div>

      {/* Super Admin Access */}
      <footer style={{ marginTop: 90, textAlign: "center", padding: "30px 0 10px", borderTop: "1px solid rgba(212, 175, 55, 0.1)", position: "relative", zIndex: 1 }}>
        <a 
          href="/login/admin" 
          style={{ 
            fontSize: 10, 
            color: "var(--gold-light)", 
            textDecoration: "none", 
            letterSpacing: 2, 
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: 0.5,
            transition: "all 0.25s ease" 
          }}
          onMouseEnter={e => { 
            e.currentTarget.style.opacity = "0.9"; 
            e.currentTarget.style.textShadow = "0 0 8px rgba(212,175,55,0.4)"; 
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.opacity = "0.5"; 
            e.currentTarget.style.textShadow = "none"; 
          }}
        >
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
              style={{ position: "absolute", inset: 0, background: "rgba(2, 1, 6, 0.85)", backdropFilter: "blur(12px)" }}
              onClick={() => { setSelectedChurch(null); setCode(""); setError(""); }}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="glass"
              style={{ 
                width: "100%", 
                maxWidth: 420, 
                padding: "44px 40px", 
                position: "relative", 
                zIndex: 101, 
                border: "1px solid var(--gold)",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                maxHeight: "90vh",
                overflowY: "auto"
              }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => { setSelectedChurch(null); setCode(""); setError(""); }}
                style={{ 
                  position: "absolute", 
                  top: 20, 
                  right: 20, 
                  background: "none", 
                  border: "none", 
                  color: "var(--muted)", 
                  cursor: "pointer",
                  transition: "color 0.2s ease" 
                }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
              >
                <X size={20} />
              </button>

              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ 
                  width: 68, 
                  height: 68, 
                  borderRadius: "50%", 
                  background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(139,92,246,0.08) 100%)", 
                  border: "1px solid rgba(212, 175, 55, 0.4)",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "var(--gold-light)", 
                  margin: "0 auto 20px",
                  boxShadow: "0 0 20px rgba(212,175,55,0.15)"
                }}>
                  <Lock size={30} />
                </div>
                <h3 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "var(--cream)", fontFamily: "var(--font-display)" }}>Code d'accès</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
                  Veuillez entrer le code de sécurité pour accéder à l'église locale <strong style={{ color: "var(--gold-light)" }}>{selectedChurch.name}</strong>
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <input 
                    type="text" 
                    placeholder="CODE" 
                    className="input" 
                    style={{ 
                      textAlign: "center", 
                      fontSize: 22, 
                      letterSpacing: 6, 
                      textTransform: "uppercase", 
                      height: 64,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid rgba(212, 175, 55, 0.3)",
                      background: "rgba(10, 6, 22, 0.7)",
                      color: "var(--gold-light)",
                      fontWeight: 700
                    }}
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleValidateCode()}
                    autoFocus
                  />
                  {error && <p style={{ color: "var(--red)", fontSize: 12, textAlign: "center", marginTop: 10, fontWeight: 500 }}>{error}</p>}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", height: 52, justifyContent: "center", borderRadius: "var(--radius-sm)" }}
                  onClick={handleValidateCode}
                  disabled={validating || !code}
                >
                  {validating ? <Loader2 className="animate-spin" /> : "Vérifier et entrer"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(212, 175, 55, 0.15)" }} />
                  <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(212, 175, 55, 0.15)" }} />
                </div>

                <button 
                  type="button"
                  className="btn"
                  style={{ 
                    width: "100%", 
                    height: 48, 
                    justifyContent: "center", 
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(139, 92, 246, 0.12)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#c084fc",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                  onClick={() => {
                    localStorage.setItem("selected_church", JSON.stringify(selectedChurch));
                    router.push("/login");
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
                    e.currentTarget.style.border = "1px solid rgba(139, 92, 246, 0.45)";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(139, 92, 246, 0.15)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
                    e.currentTarget.style.border = "1px solid rgba(139, 92, 246, 0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Espace Intégration & Leaders
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
