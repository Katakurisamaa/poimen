"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Share, PlusSquare, CheckCircle2, X, Smartphone, Monitor, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaInstallButtonProps {
  variant?: "icon" | "pill" | "badge";
  className?: string;
  style?: React.CSSProperties;
  tooltipAlign?: "center" | "left" | "right";
}

export default function PwaInstallButton({
  variant = "icon",
  className = "",
  style,
  tooltipAlign = "center",
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [justInstalled, setJustInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Detect if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect device platform for tailored instructions
    const ua = navigator.userAgent || "";
    const isIosDevice = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroidDevice = /Android/.test(ua);

    if (isIosDevice) {
      setPlatform("ios");
    } else if (isAndroidDevice) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // Capture the beforeinstallprompt event (Chrome, Edge, Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Capture appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 4000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If native prompt is available, trigger it directly
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
        setShowModal(true);
      }
      return;
    }

    // Otherwise (iOS, already prompted, or unsupported browser), show the visual guide modal
    setShowModal(true);
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <div
          className={`pwa-install-icon-wrapper ${className}`}
          style={{ position: "relative", display: "inline-flex", ...style }}
        >
          <button
            type="button"
            onClick={handleInstallClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="pwa-install-icon-btn"
            title={isInstalled ? "Poimén est installée en local" : "Télécharger / Installer l'application en local"}
            aria-label={isInstalled ? "Poimén est installée" : "Installer l'application Poimén en local"}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: isInstalled
                ? "var(--green-bg, rgba(16, 185, 129, 0.12))"
                : "var(--surface-solid, rgba(16, 20, 21, 0.85))",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: isInstalled ? "1px solid var(--green, #10b981)" : "1px solid var(--border, rgba(212, 175, 55, 0.35))",
              color: isInstalled ? "var(--green, #10b981)" : "var(--gold, #d4af37)",
              boxShadow: isInstalled
                ? "0 2px 10px rgba(16, 185, 129, 0.2)"
                : "0 2px 12px rgba(212, 175, 55, 0.15)",
              cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: isHovered ? "translateY(-1px) scale(1.05)" : "translateY(0) scale(1)",
            }}
          >
            {isInstalled ? <CheckCircle2 size={18} /> : <Download size={18} />}
            {!isInstalled && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--gold, #d4af37)",
                  boxShadow: "0 0 6px var(--gold, #d4af37)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            )}
          </button>

          {/* Hover Tooltip */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  bottom: -34,
                  left: tooltipAlign === "left" ? 0 : tooltipAlign === "right" ? "auto" : "50%",
                  right: tooltipAlign === "right" ? 0 : "auto",
                  transform: tooltipAlign === "center" ? "translateX(-50%)" : "none",
                  whiteSpace: "nowrap",
                  background: "var(--surface-solid, #121720)",
                  border: "1px solid var(--border, rgba(212, 175, 55, 0.35))",
                  color: "var(--cream, #f4f1ea)",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 8,
                  pointerEvents: "none",
                  zIndex: 50,
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
                }}
              >
                {isInstalled ? "App installée en local" : "Télécharger en local"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : variant === "pill" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`pwa-install-pill-btn ${className}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: "30px",
            background: isInstalled
              ? "var(--green-bg, rgba(16, 185, 129, 0.12))"
              : "var(--surface-solid, rgba(212, 175, 55, 0.08))",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: isInstalled ? "1px solid var(--green, #10b981)" : "1px solid var(--border, rgba(212, 175, 55, 0.3))",
            color: isInstalled ? "var(--green, #10b981)" : "var(--gold-light, #f4e5a9)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            ...style,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = isInstalled
              ? "var(--green-bg, rgba(16, 185, 129, 0.2))"
              : "rgba(212, 175, 55, 0.16)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.background = isInstalled
              ? "var(--green-bg, rgba(16, 185, 129, 0.12))"
              : "var(--surface-solid, rgba(212, 175, 55, 0.08))";
          }}
        >
          {isInstalled ? <Check size={14} /> : <Download size={14} />}
          <span>{isInstalled ? "App installée en local" : "Installer l'application en local"}</span>
        </button>
      ) : (
        /* Badge variant */
        <button
          type="button"
          onClick={handleInstallClick}
          className={`pwa-install-badge-btn ${className}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: "20px",
            background: "var(--surface-solid, rgba(255, 255, 255, 0.05))",
            border: "1px solid var(--border, rgba(212, 175, 55, 0.25))",
            color: "var(--cream, #f4f1ea)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s ease",
            ...style,
          }}
        >
          <Download size={13} style={{ color: "var(--gold, #d4af37)" }} />
          <span>Installer l'app</span>
        </button>
      )}

      {/* Installation Instruction Modal Portal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {showModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                overflowY: "auto",
              }}
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(2, 1, 6, 0.88)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  zIndex: 1,
                }}
                onClick={() => setShowModal(false)}
              />

              {/* Modal Card */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 320 }}
                className="glass"
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 440,
                  maxHeight: "min(560px, calc(100dvh - 32px))",
                  padding: "26px 22px 20px",
                  background: "var(--surface-solid, #121720)",
                  border: "1px solid var(--gold, rgba(212, 175, 55, 0.4))",
                  borderRadius: 20,
                  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(212, 175, 55, 0.15)",
                  color: "var(--cream, #f4f1ea)",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 2,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--muted, #94a3b8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    zIndex: 3,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--cream, #f4f1ea)";
                    e.currentTarget.style.borderColor = "var(--gold, #d4af37)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--muted, #94a3b8)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }}
                >
                  <X size={15} />
                </button>

                {/* Icon & Title */}
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: isInstalled
                        ? "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.06) 100%)"
                        : "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(139,92,246,0.1) 100%)",
                      border: isInstalled
                        ? "1.5px solid rgba(16, 185, 129, 0.5)"
                        : "1.5px solid rgba(212, 175, 55, 0.45)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isInstalled ? "var(--green, #10b981)" : "var(--gold-light, #f4e5a9)",
                      margin: "0 auto 12px",
                      boxShadow: isInstalled
                        ? "0 0 25px rgba(16, 185, 129, 0.25)"
                        : "0 0 25px rgba(212, 175, 55, 0.2)",
                    }}
                  >
                    {isInstalled ? <CheckCircle2 size={26} /> : <Download size={24} />}
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      margin: "0 0 6px",
                      fontFamily: "var(--font-display, serif)",
                      color: "var(--cream, #f4f1ea)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {isInstalled ? "Application installée en local" : "Installer Poimén en local"}
                  </h3>
                  <p style={{ fontSize: 12.5, color: "var(--muted, #94a3b8)", margin: 0, lineHeight: 1.45 }}>
                    {isInstalled
                      ? "Poimén est déjà installée sur cet appareil et prête pour une utilisation fluide et hors ligne."
                      : "Utilisez Poimén comme une vraie application sur votre téléphone, tablette ou ordinateur, avec accès rapide et confort plein écran."}
                  </p>
                </div>

                {isInstalled ? (
                  /* Already installed confirmation */
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: 14,
                      padding: "16px 18px",
                      marginBottom: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(16, 185, 129, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--green, #10b981)",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--cream, #f4f1ea)", lineHeight: 1.4 }}>
                        Accès direct et instantané depuis votre écran d&apos;accueil
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(16, 185, 129, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--green, #10b981)",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--cream, #f4f1ea)", lineHeight: 1.4 }}>
                        Expérience plein écran immersive sans barre de navigation
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(16, 185, 129, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--green, #10b981)",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--cream, #f4f1ea)", lineHeight: 1.4 }}>
                        Données conservées en cache local et synchronisation automatique
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Platform Selector Tabs */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        padding: 3,
                        background: "rgba(0, 0, 0, 0.35)",
                        borderRadius: 12,
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        marginBottom: 16,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPlatform("ios")}
                        style={{
                          flex: 1,
                          padding: "7px 8px",
                          borderRadius: 9,
                          border: "none",
                          background: platform === "ios" ? "rgba(212, 175, 55, 0.2)" : "transparent",
                          color: platform === "ios" ? "var(--gold-light, #f4e5a9)" : "var(--muted, #94a3b8)",
                          fontSize: 12,
                          fontWeight: platform === "ios" ? 700 : 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Smartphone size={13} />
                        <span>iPhone / iPad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlatform("android")}
                        style={{
                          flex: 1,
                          padding: "7px 8px",
                          borderRadius: 9,
                          border: "none",
                          background: platform === "android" ? "rgba(212, 175, 55, 0.2)" : "transparent",
                          color: platform === "android" ? "var(--gold-light, #f4e5a9)" : "var(--muted, #94a3b8)",
                          fontSize: 12,
                          fontWeight: platform === "android" ? 700 : 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Smartphone size={13} />
                        <span>Android</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlatform("desktop")}
                        style={{
                          flex: 1,
                          padding: "7px 8px",
                          borderRadius: 9,
                          border: "none",
                          background: platform === "desktop" ? "rgba(212, 175, 55, 0.2)" : "transparent",
                          color: platform === "desktop" ? "var(--gold-light, #f4e5a9)" : "var(--muted, #94a3b8)",
                          fontSize: 12,
                          fontWeight: platform === "desktop" ? 700 : 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Monitor size={13} />
                        <span>PC / Mac</span>
                      </button>
                    </div>

                    {/* Instructions per Platform */}
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 14,
                        padding: "14px 16px",
                        marginBottom: 18,
                      }}
                    >
                      {platform === "ios" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              1
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Dans Safari, touchez le bouton <strong>Partager</strong> en bas de l&apos;écran :
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.08)",
                                  color: "var(--gold-light, #f4e5a9)",
                                  marginLeft: 6,
                                }}
                              >
                                <Share size={12} />
                                <span>Partager</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              2
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Faites défiler vers le bas et touchez :
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.08)",
                                  color: "var(--gold-light, #f4e5a9)",
                                  marginLeft: 6,
                                }}
                              >
                                <PlusSquare size={12} />
                                <span>Sur l&apos;écran d&apos;accueil</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              3
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Touchez <strong>Ajouter</strong> en haut à droite. L&apos;icône <strong>Poimén</strong> apparaîtra
                              sur votre écran d&apos;accueil !
                            </div>
                          </div>
                        </div>
                      ) : platform === "android" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              1
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Dans votre navigateur Chrome ou Edge, appuyez sur le menu (les <strong>3 points ⋮</strong> en
                              haut à droite).
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              2
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Sélectionnez <strong>« Installer l&apos;application »</strong> ou{" "}
                              <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              3
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Confirmez l&apos;installation. L&apos;application sera installée et accessible hors ligne !
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              1
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Dans Chrome, Edge ou Brave, repérez l&apos;icône <strong>Installer</strong> (petit écran avec flèche
                              ou symbole <strong>+</strong>) située à droite dans la <strong>barre d&apos;adresse</strong>.
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "rgba(212, 175, 55, 0.2)",
                                color: "var(--gold-light, #f4e5a9)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              2
                            </span>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              Cliquez dessus puis confirmez <strong>« Installer »</strong> pour lancer Poimén dans sa propre
                              fenêtre dédiée.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Native Prompt Trigger Button if available in modal */}
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    style={{
                      width: "100%",
                      height: 42,
                      borderRadius: 12,
                      background: "var(--gold, #d4af37)",
                      color: "#0a0d14",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginBottom: 8,
                      boxShadow: "0 4px 15px rgba(212, 175, 55, 0.35)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <Download size={16} />
                    <span>Installer maintenant</span>
                  </button>
                )}

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 12,
                    background: deferredPrompt ? "transparent" : "rgba(255, 255, 255, 0.08)",
                    color: "var(--cream, #f4f1ea)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: deferredPrompt ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s ease",
                  }}
                >
                  J&apos;ai compris
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
