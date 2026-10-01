"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { X, QrCode, Copy, Check, Download, Share2, ExternalLink } from "lucide-react";

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  churchId: string;
  churchName?: string;
}

export default function ShareInviteModal({
  isOpen,
  onClose,
  churchId,
  churchName = "ICC",
}: ShareInviteModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const cleanChurchName = churchName.replace(/^ICC\s+/i, "").trim() || "CHARLEROI";
  const link =
    typeof window !== "undefined" && churchId
      ? `${window.location.origin}/public-invite?church_id=${churchId}`
      : "";

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !link) return;

    QRCode.toDataURL(link, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Erreur génération QR Code:", err));
  }, [isOpen, link]);

  // Lock body scroll and handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error("Erreur lors de la copie du lien:", e);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    const safeChurch = cleanChurchName.replace(/[^a-zA-Z0-9]/g, "_");
    a.download = `QR_Code_Invites_ICC_${safeChurch}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Fiche d'accueil — ICC ${cleanChurchName}`,
          text: `Bienvenue à ICC ${cleanChurchName} ! Remplissez cette fiche pour que nous puissions faire connaissance :`,
          url: link,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Erreur lors du partage:", err);
        }
      }
    } else {
      handleCopy();
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        zIndex: 9999,
        background: "rgba(8, 12, 20, 0.78)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="custom-modal fade-in"
        style={{
          maxWidth: 480,
          width: "92vw",
          padding: "24px 22px",
          background: "var(--surface-solid)",
          border: "1px solid var(--border)",
          borderRadius: 22,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
          color: "var(--cream)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--gold-glow)",
                border: "1px solid var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gold)",
                flexShrink: 0,
              }}
            >
              <QrCode size={22} />
            </div>
            <div>
              <h3
                id="share-modal-title"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--cream)",
                  lineHeight: 1.25,
                }}
              >
                Partager le formulaire d'accueil
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  margin: "3px 0 0 0",
                }}
              >
                ICC {cleanChurchName} • Fiche d'intégration des invités
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
            background: "var(--bg)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: 12,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR Code pour la fiche d'invité"
                style={{
                  width: 220,
                  height: 220,
                  display: "block",
                  borderRadius: 8,
                }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                Génération du QR Code...
              </div>
            )}
          </div>
          <p
            style={{
              fontSize: 13,
              textAlign: "center",
              color: "var(--cream-dim)",
              margin: 0,
              maxWidth: 320,
              lineHeight: 1.45,
            }}
          >
            Faites scanner ce code par l'invité avec son smartphone pour ouvrir directement le formulaire.
          </p>
        </div>

        {/* Link Row */}
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            Lien direct vers la fiche
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "6px 6px 6px 12px",
            }}
          >
            <input
              type="text"
              readOnly
              value={link}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--cream)",
                fontSize: 12,
                outline: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopy}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderColor: copied ? "var(--green)" : "var(--gold)",
                color: copied ? "var(--green)" : "var(--gold)",
                background: copied ? "var(--green-glow)" : "transparent",
                flexShrink: 0,
              }}
            >
              {copied ? (
                <>
                  <Check size={14} /> Copié !
                </>
              ) : (
                <>
                  <Copy size={14} /> Copier
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: canShare ? "1fr 1fr" : "1fr",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
            }}
            title="Télécharger l'image PNG pour l'imprimer ou la projeter"
          >
            <Download size={16} /> Télécharger QR (PNG)
          </button>

          {canShare ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleShare}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Share2 size={16} /> Partager (WhatsApp/SMS)
            </button>
          ) : (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <ExternalLink size={16} /> Ouvrir la fiche
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
