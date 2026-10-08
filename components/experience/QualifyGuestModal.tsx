"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  X, Check, UserCheck, Calendar, BookOpen, Heart, 
  MessageSquare, Loader2
} from "lucide-react";
import type { ConserveGuestPayload } from "@/app/actions/auth";
import styles from "./QualifyGuestModal.module.css";

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
    prevuRevenir?: boolean;
    estRevenuCulte?: boolean;
    groupeWhatsapp?: boolean;
    interetFormation?: boolean;
    interetCDM?: boolean;
    piliers1?: boolean;
    souhaitSuivi?: boolean;
    rdvPastoral?: boolean;
    visiteDomicile?: boolean;
    aps?: boolean;
    commentaireSuivi?: string;
  } | null;
  onConfirm: (payload: ConserveGuestPayload) => Promise<void>;
}

export default function QualifyGuestModal({ isOpen, onClose, guest, onConfirm }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states matching CR Call Center
  const [prevuRevenir, setPrevuRevenir] = useState(true);
  const [estRevenuCulte, setEstRevenuCulte] = useState(false);
  const [groupeWhatsapp, setGroupeWhatsapp] = useState(false);
  const [interetFormation, setInteretFormation] = useState(false);
  const [interetCDM, setInteretCDM] = useState(false);
  const [piliers1, setPiliers1] = useState(false);
  const [souhaitSuivi, setSouhaitSuivi] = useState(true);
  const [rdvPastoral, setRdvPastoral] = useState(false);
  const [visiteDomicile, setVisiteDomicile] = useState(false);
  const [aps, setAps] = useState(false);
  const [commentaireSuivi, setCommentaireSuivi] = useState("");

  useEffect(() => {
    if (!isOpen || !guest) return;
    setPrevuRevenir(guest.prevuRevenir ?? true);
    setEstRevenuCulte(guest.estRevenuCulte ?? false);
    setGroupeWhatsapp(guest.groupeWhatsapp ?? false);
    setInteretFormation(guest.interetFormation ?? false);
    setInteretCDM(guest.interetCDM ?? false);
    setPiliers1(guest.piliers1 ?? false);
    setSouhaitSuivi(guest.souhaitSuivi ?? true);
    setRdvPastoral(guest.rdvPastoral ?? false);
    setVisiteDomicile(guest.visiteDomicile ?? false);
    setAps(guest.aps ?? false);
    setCommentaireSuivi(guest.commentaireSuivi || "");
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
    setSubmitting(true);
    try {
      await onConfirm({
        prevuRevenir,
        estRevenuCulte,
        groupeWhatsapp,
        interetFormation,
        interetCDM,
        piliers1,
        souhaitSuivi,
        rdvPastoral,
        visiteDomicile,
        aps,
        commentaireSuivi: commentaireSuivi.trim()
      });
      onClose();
    } catch (err) {
      console.error("Error submitting qualification", err);
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
        aria-labelledby="qualify-modal-title"
      >
        <div className={styles.mobileHandle} />

        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.badgeCategory}>
              <UserCheck size={13} /> Premier contact abouti
            </span>
            <h2 id="qualify-modal-title" className={styles.personName}>
              Conserver {guest.civility} {guest.firstName} {guest.lastName}
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
          <div className={styles.introNote}>
            En conservant cette personne, l&apos;appel est marqué comme <strong>abouti</strong> et elle rejoint directement votre suivi <strong>Mes âmes</strong>. Cochez les informations relevées lors de ce premier échange :
          </div>

          {/* Section Présence & Culte */}
          <div className={styles.categoryGroup}>
            <span className={styles.groupLabel}>
              <Calendar size={14} /> Culte & Présence
            </span>
            <div className={styles.checklistGrid}>
              <div 
                className={`${styles.checkItem} ${prevuRevenir ? styles.checkItemActive : ""}`}
                onClick={() => setPrevuRevenir(!prevuRevenir)}
              >
                <div className={styles.checkboxSquare}>
                  {prevuRevenir && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Prévoit de revenir au culte</span>
              </div>

              <div 
                className={`${styles.checkItem} ${estRevenuCulte ? styles.checkItemActive : ""}`}
                onClick={() => setEstRevenuCulte(!estRevenuCulte)}
              >
                <div className={styles.checkboxSquare}>
                  {estRevenuCulte && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Est déjà revenu(e)</span>
              </div>

              <div 
                className={`${styles.checkItem} ${groupeWhatsapp ? styles.checkItemActive : ""}`}
                onClick={() => setGroupeWhatsapp(!groupeWhatsapp)}
              >
                <div className={styles.checkboxSquare}>
                  {groupeWhatsapp && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Groupe WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Section Intégration & Formations */}
          <div className={styles.categoryGroup}>
            <span className={styles.groupLabel}>
              <BookOpen size={14} /> Intégration & Parcours
            </span>
            <div className={styles.checklistGrid}>
              <div 
                className={`${styles.checkItem} ${interetFormation ? styles.checkItemActive : ""}`}
                onClick={() => setInteretFormation(!interetFormation)}
              >
                <div className={styles.checkboxSquare}>
                  {interetFormation && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Intérêt PCNC (001)</span>
              </div>

              <div 
                className={`${styles.checkItem} ${interetCDM ? styles.checkItemActive : ""}`}
                onClick={() => setInteretCDM(!interetCDM)}
              >
                <div className={styles.checkboxSquare}>
                  {interetCDM && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Intérêt Cellule (CDM)</span>
              </div>

              <div 
                className={`${styles.checkItem} ${piliers1 ? styles.checkItemActive : ""}`}
                onClick={() => setPiliers1(!piliers1)}
              >
                <div className={styles.checkboxSquare}>
                  {piliers1 && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Inscrit 12 Piliers</span>
              </div>
            </div>
          </div>

          {/* Section Accompagnement Pastoral */}
          <div className={styles.categoryGroup}>
            <span className={styles.groupLabel}>
              <Heart size={14} /> Accompagnement Pastoral
            </span>
            <div className={styles.checklistGrid}>
              <div 
                className={`${styles.checkItem} ${souhaitSuivi ? styles.checkItemActive : ""}`}
                onClick={() => setSouhaitSuivi(!souhaitSuivi)}
              >
                <div className={styles.checkboxSquare}>
                  {souhaitSuivi && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Souhait de suivi</span>
              </div>

              <div 
                className={`${styles.checkItem} ${rdvPastoral ? styles.checkItemActive : ""}`}
                onClick={() => setRdvPastoral(!rdvPastoral)}
              >
                <div className={styles.checkboxSquare}>
                  {rdvPastoral && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>RDV Pastoral demandé</span>
              </div>

              <div 
                className={`${styles.checkItem} ${visiteDomicile ? styles.checkItemActive : ""}`}
                onClick={() => setVisiteDomicile(!visiteDomicile)}
              >
                <div className={styles.checkboxSquare}>
                  {visiteDomicile && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Visite à domicile</span>
              </div>

              <div 
                className={`${styles.checkItem} ${aps ? styles.checkItemActive : ""}`}
                onClick={() => setAps(!aps)}
              >
                <div className={styles.checkboxSquare}>
                  {aps && <Check size={13} />}
                </div>
                <span className={styles.checkLabel}>Fiche APS</span>
              </div>
            </div>
          </div>

          {/* Commentaire libre */}
          <div className={styles.commentArea}>
            <label htmlFor="first-contact-note" className={styles.commentLabel}>
              <MessageSquare size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
              Note de premier échange
            </label>
            <textarea
              id="first-contact-note"
              value={commentaireSuivi}
              onChange={(e) => setCommentaireSuivi(e.target.value)}
              placeholder="Ex : Échange chaleureux, touché(e) par la louange, demande la prière pour son travail..."
              className={styles.textarea}
              rows={3}
            />
          </div>

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
                  <Check size={15} /> Confirmer et ajouter à Mes âmes
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
