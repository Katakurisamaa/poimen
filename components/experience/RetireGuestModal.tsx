"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  X, UserMinus, AlertTriangle, PhoneOff, PhoneForwarded, 
  Church, ShieldAlert, MapPin, MessageSquare, Loader2
} from "lucide-react";
import styles from "./RetireGuestModal.module.css";

export interface RetirePayload {
  motif: string;
  autreEglise?: string;
  commentaire: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  guest: {
    id: string;
    civility: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  } | null;
  onConfirm: (payload: RetirePayload) => Promise<void>;
}

const MOTIFS = [
  { id: "ne_decroche_pas", label: "Ne décroche pas suite à plusieurs relances", icon: PhoneForwarded },
  { id: "faux_numero", label: "Faux numéro / Numéro erroné", icon: PhoneOff },
  { id: "autre_eglise", label: "Fréquente déjà une autre église", icon: Church },
  { id: "pas_interesse", label: "Ne souhaite pas être contacté(e) / suivi(e)", icon: ShieldAlert },
  { id: "demenagement", label: "A déménagé / Hors secteur géographique", icon: MapPin },
  { id: "autre", label: "Autre raison", icon: AlertTriangle }
];

export default function RetireGuestModal({ isOpen, onClose, guest, onConfirm }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMotif, setSelectedMotif] = useState<string>("ne_decroche_pas");
  const [autreEglise, setAutreEglise] = useState<string>("");
  const [commentaire, setCommentaire] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !guest) return;
    setSelectedMotif("ne_decroche_pas");
    setAutreEglise("");
    setCommentaire("");
    setErrorMsg("");
  }, [isOpen, guest]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !guest || typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!commentaire.trim()) {
      setErrorMsg("Veuillez renseigner un commentaire ou rapport pour justifier le retrait.");
      return;
    }

    if (selectedMotif === "autre_eglise" && !autreEglise.trim()) {
      setErrorMsg("Veuillez préciser le nom de l'église fréquentée.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);
    try {
      await onConfirm({
        motif: selectedMotif,
        autreEglise: selectedMotif === "autre_eglise" ? autreEglise.trim() : undefined,
        commentaire: commentaire.trim()
      });
      onClose();
    } catch (err) {
      console.error("Error retiring guest", err);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div 
        ref={modalRef} 
        className={styles.modal} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="retire-modal-title"
      >
        <div className={styles.mobileHandle} />

        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.badgeCategory}>
              <UserMinus size={13} /> Rapport de clôture / Retrait
            </span>
            <h2 id="retire-modal-title" className={styles.personName}>
              Retirer {guest.civility} {guest.firstName} {guest.lastName}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={submitting}
            className={styles.closeBtn} 
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.content}>
          <div className={styles.warningBox}>
            Cette personne sera retirée de vos affectations et transférée dans l&apos;onglet <strong>Sans suite</strong>. Elle restera conservée dans l&apos;annuaire général des invités de l&apos;église.
          </div>

          {/* Sélection du motif */}
          <div className={styles.motifSection}>
            <span className={styles.sectionLabel}>Motif principal</span>
            <div className={styles.motifList}>
              {MOTIFS.map((item) => {
                const isSelected = selectedMotif === item.id;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`${styles.motifOption} ${isSelected ? styles.motifOptionActive : ""}`}
                    onClick={() => setSelectedMotif(item.id)}
                  >
                    <div className={styles.radioCircle}>
                      {isSelected && <div className={styles.radioDot} />}
                    </div>
                    <Icon size={16} color={isSelected ? "var(--red)" : "var(--muted)"} />
                    <span className={styles.motifText}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Précision autre église si sélectionné */}
          {selectedMotif === "autre_eglise" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="autre-eglise-input" className={styles.sectionLabel}>
                Nom de l&apos;autre église
              </label>
              <input
                id="autre-eglise-input"
                type="text"
                value={autreEglise}
                onChange={(e) => setAutreEglise(e.target.value)}
                placeholder="Ex : Assemblée de Dieu, Église Protestante..."
                className={styles.inputField}
              />
            </div>
          )}

          {/* Rapport / Commentaire obligatoire */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="retire-comment" className={styles.sectionLabel}>
              <MessageSquare size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
              Rapport &amp; Commentaire détaillé (obligatoire)
            </label>
            <textarea
              id="retire-comment"
              value={commentaire}
              onChange={(e) => {
                setCommentaire(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder="Expliquez brièvement le déroulement des tentatives d'appel ou la raison exacte de la clôture..."
              className={styles.textarea}
              rows={3}
            />
          </div>

          {errorMsg && (
            <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}

          <div className={styles.footer}>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={submitting}
              className="btn btn-outline btn-sm"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className={styles.submitBtn}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spinner" /> Enregistrement...
                </>
              ) : (
                <>
                  <UserMinus size={15} /> Confirmer le retrait
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
