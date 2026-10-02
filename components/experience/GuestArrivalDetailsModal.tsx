"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  X, Phone, Mail, MapPin, Copy, Check, Circle, UserCheck, PhoneCall,
  CheckCircle2, AlertCircle, PhoneOff, Clock, Sparkles, Home,
  Award, Shield, Edit3
} from "lucide-react";
import CustomSelect from "@/components/ui/CustomSelect";
import styles from "./GuestArrivalDetailsModal.module.css";

export interface GuestFullProfile {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  age: string;
  phone?: string;
  email?: string;
  address?: string;
  pays?: string;
  arrivalDate: string;
  event: string;
  aps?: boolean;
  localChurch?: boolean;
  autreEglise?: string;
  aEteInvite?: boolean;
  parQui?: string;
  souhaiteEtreContacte?: boolean;
  baptemeEau?: boolean;
  baptemeEsprit?: boolean;
  interetFormation?: boolean;
  interetCDM?: boolean;
  interetBapteme?: boolean;
  commentaire?: string;

  // Counselor follow-up fields
  responsible?: string;
  assigned_to?: string | null;
  statutAffectation?: string;
  status?: string;
  appelAbouti?: boolean;
  neDecrochePas?: boolean;
  fauxNumero?: boolean;
  raisonEchec?: string;
  prevuRevenir?: boolean;
  estRevenuCulte?: boolean;
  rencontreEffectuee?: boolean;
  visiteDomicile?: boolean;
  cocktailBienvenue?: boolean;
  groupeWhatsapp?: boolean;
  smsBienvenue?: boolean;
  rdvPastoral?: boolean;
  prierePartage?: boolean;
  pcnc?: boolean;
  p101?: boolean;
  p201?: boolean;
  p301?: boolean;
  terminePCNC?: boolean;
  piliers1?: boolean;
  piliers2?: boolean;
  piliers3?: boolean;
  piliers4?: boolean;
  termine12Piliers?: boolean;
  veutServir?: boolean;
  devenuStar?: boolean;
  famille_disciple?: string;
  dansFamilleDisciple?: boolean;
  integreCDM?: boolean;
  commentaireSuivi?: string;
  notes?: string;
  attendance?: Record<string, boolean>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  guest: GuestFullProfile | null;
  counselors?: { id: string; display_name: string; email: string }[];
  onAssign?: (guestId: string, counselorId: string | null) => Promise<void>;
  onEdit?: (guest: GuestFullProfile) => void;
  isLeader?: boolean;
}

export default function GuestArrivalDetailsModal({ 
  isOpen, 
  onClose, 
  guest, 
  counselors = [], 
  onAssign, 
  onEdit,
  isLeader = false 
}: Props) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

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

  const copyToClipboard = async (text: string, type: "phone" | "email") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "phone") {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      } else {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      }
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  const formattedDate = useMemo(() => {
    if (!guest?.arrivalDate) return "Date non renseignée";
    try {
      const parts = guest.arrivalDate.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return guest.arrivalDate;
    } catch {
      return guest.arrivalDate;
    }
  }, [guest?.arrivalDate]);

  const formattedAge = useMemo(() => {
    if (!guest?.age) return "Non renseignée";
    const trimmed = guest.age.trim();
    if (!trimmed) return "Non renseignée";
    return trimmed.toLowerCase().endsWith("ans") ? trimmed : `${trimmed} ans`;
  }, [guest?.age]);

  const presenceList = useMemo(() => {
    if (!guest?.attendance) return [];
    return Object.entries(guest.attendance)
      .filter(([_, present]) => Boolean(present))
      .map(([dateStr]) => {
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const day = dateObj.getDay();
        const eventType = day === 0 ? "Culte (Dimanche)" : day === 4 ? "CDM (Jeudi)" : "Réunion";
        const formatted = `${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}/${y}`;
        return { dateStr, formatted, eventType, day };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [guest?.attendance]);

  const counselorObj = useMemo(() => {
    if (!guest?.assigned_to) return null;
    return counselors.find(c => c.id === guest.assigned_to) || null;
  }, [guest?.assigned_to, counselors]);

  const counselorName = counselorObj?.display_name || guest?.responsible || "Non assigné";

  const handleReassign = async (counselorId: string) => {
    if (!onAssign || !guest) return;
    setIsReassigning(true);
    try {
      await onAssign(guest.id, counselorId === "none" ? null : counselorId);
    } finally {
      setIsReassigning(false);
    }
  };

  if (!isOpen || !guest || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        ref={drawerRef} 
        className={styles.drawer} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="drawer-title"
      >
        {/* Top Header */}
        <div className={styles.drawerHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={styles.kicker}>FICHE DE SUIVI · INVITÉ</span>
            {isLeader && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(guest);
                }}
                className={styles.headerEditBtn}
                title="Modifier les informations saisies au formulaire"
              >
                <Edit3 size={13} /> Modifier la fiche
              </button>
            )}
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className={styles.closeBtn} 
            aria-label="Fermer la fiche"
          >
            <X size={18} />
          </button>
        </div>

        {/* Continuous Flowing Content */}
        <div className={styles.drawerContent}>
          {/* 1. Identity Block */}
          <div className={styles.identityBlock}>
            <div className={styles.avatar}>
              {guest.firstName?.[0] || ""}{guest.lastName?.[0] || ""}
            </div>
            <div className={styles.identityInfo}>
              <span className={styles.civilityBadge}>{guest.civility || "Invité"}</span>
              <h2 id="drawer-title" className={styles.personName}>
                {guest.firstName} {guest.lastName}
              </h2>
              <div className={styles.arrivalSubtitle}>
                Arrivé(e) le {formattedDate} · {guest.event || "Culte"} · {formattedAge}
              </div>
            </div>
          </div>

          {/* 2. Counselor & Direct Reassignment Block */}
          <div className={styles.counselorBox}>
            <div className={styles.counselorHeaderRow}>
              <div className={styles.counselorNameWrap}>
                <span className={styles.counselorDot} />
                <span>
                  {counselorName !== "Non assigné"
                    ? `Conseiller : ${counselorName}`
                    : "Non assigné"}
                </span>
              </div>
              <span className={styles.counselorStatusBadge}>
                {guest.statutAffectation === "conserve"
                  ? "Suivi actif"
                  : guest.statutAffectation === "sans_suite"
                  ? "Sans suite"
                  : "À affecter"}
              </span>
            </div>

            {/* Direct reassignment for Leader/Second */}
            {isLeader && onAssign && counselors.length > 0 && (
              <div className={styles.reassignRow}>
                <span className={styles.reassignLabel}>Réaffecter à :</span>
                <div className={styles.reassignSelectWrap}>
                  <CustomSelect
                    size="sm"
                    value={guest.assigned_to || ""}
                    onChange={handleReassign}
                    disabled={isReassigning}
                    placeholder={isReassigning ? "Réaffectation en cours…" : "Choisir un conseiller…"}
                    options={[
                      { value: "none", label: "Non assigné" },
                      ...counselors.map(c => ({ value: c.id, label: c.display_name }))
                    ]}
                    searchable={counselors.length >= 6}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Counselor Follow-up & Calls */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Suivi & Échanges du conseiller</h3>

            {/* Call status banner */}
            {guest.appelAbouti ? (
              <div className={styles.callStatusSuccess}>
                <CheckCircle2 size={16} />
                <span>Premier contact téléphonique établi</span>
              </div>
            ) : guest.fauxNumero ? (
              <div className={styles.callStatusDanger}>
                <PhoneOff size={16} />
                <span>Numéro non attribuable / Faux numéro</span>
              </div>
            ) : guest.neDecrochePas ? (
              <div className={styles.callStatusWarning}>
                <AlertCircle size={16} />
                <span>Ne décroche pas (relance à prévoir)</span>
              </div>
            ) : (
              <div className={styles.callStatusNeutral}>
                <Clock size={16} />
                <span>Premier appel non entamé</span>
              </div>
            )}

            {/* Companion Actions */}
            <div className={styles.actionList}>
              {[
                { label: "SMS de bienvenue", done: guest.smsBienvenue },
                { label: "Rencontre effectuée", done: guest.rencontreEffectuee },
                { label: "Visite à domicile", done: guest.visiteDomicile },
                { label: "Cocktail de bienvenue", done: guest.cocktailBienvenue },
                { label: "Groupe WhatsApp", done: guest.groupeWhatsapp },
                { label: "Rendez-vous pastoral", done: guest.rdvPastoral },
              ].map((act, i) => (
                <div key={i} className={`${styles.actionRow} ${act.done ? styles.actionRowDone : styles.actionRowPending}`}>
                  <div className={styles.actionLeft}>
                    <span className={act.done ? styles.actionIconDone : styles.actionIconPending}>
                      {act.done ? <Check size={14} strokeWidth={2.5} /> : <Circle size={14} strokeWidth={2} />}
                    </span>
                    <span className={act.done ? styles.actionLabelDone : styles.actionLabelPending}>
                      {act.label}
                    </span>
                  </div>
                  <span className={act.done ? styles.actionTagDone : styles.actionTagPending}>
                    {act.done ? "Effectué" : "Non réalisé"}
                  </span>
                </div>
              ))}
            </div>

            {/* Counselor report & notes */}
            {guest.commentaireSuivi ? (
              <div>
                <div className={styles.subLabel}>
                  Compte-rendu du conseiller
                </div>
                <div className={styles.notesBlock}>
                  {guest.commentaireSuivi}
                </div>
              </div>
            ) : (
              <p className={styles.emptyText}>Aucun compte-rendu consigné par le conseiller pour le moment.</p>
            )}

            {guest.notes && (
              <div>
                <div className={styles.subLabel}>
                  Notes internes
                </div>
                <div className={styles.notesBlock}>
                  {guest.notes}
                </div>
              </div>
            )}
          </div>

          {/* 4. Contact Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Coordonnées</h3>
            <div className={styles.contactRows}>
              <div className={styles.contactRow}>
                <span className={styles.contactLabel}>Téléphone</span>
                <div className={styles.contactValueWrap}>
                  {guest.phone ? (
                    <>
                      <a href={`tel:${guest.phone.replace(/\s+/g, "")}`} className={styles.contactLink}>
                        {guest.phone}
                      </a>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(guest.phone!, "phone")}
                        className={styles.copyBtn}
                        title="Copier"
                      >
                        {copiedPhone ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                        <span>{copiedPhone ? "Copié" : "Copier"}</span>
                      </button>
                    </>
                  ) : (
                    <span className={styles.emptyText}>Non renseigné</span>
                  )}
                </div>
              </div>

              <div className={styles.contactRow}>
                <span className={styles.contactLabel}>E-mail</span>
                <div className={styles.contactValueWrap}>
                  {guest.email ? (
                    <>
                      <a href={`mailto:${guest.email}`} className={styles.contactLink}>
                        {guest.email}
                      </a>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(guest.email!, "email")}
                        className={styles.copyBtn}
                        title="Copier"
                      >
                        {copiedEmail ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                        <span>{copiedEmail ? "Copié" : "Copier"}</span>
                      </button>
                    </>
                  ) : (
                    <span className={styles.emptyText}>Non renseigné</span>
                  )}
                </div>
              </div>

              {guest.address && (
                <div className={styles.contactRow}>
                  <span className={styles.contactLabel}>Adresse</span>
                  <span style={{ color: "var(--cream)", fontWeight: 500 }}>
                    {guest.address}
                  </span>
                </div>
              )}

              <div className={styles.contactRow}>
                <span className={styles.contactLabel}>Pays</span>
                <span style={{ color: "var(--cream)", fontWeight: 500 }}>
                  {guest.pays || "Belgique"}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Arrival Form & Expressed Wishes */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Formulaire d&apos;accueil & Souhaits</h3>
            <div className={styles.specList}>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Église d&apos;origine</span>
                <span className={styles.specVal}>
                  {guest.localChurch ? "Membre d'une église locale" : guest.autreEglise ? `Autre église : ${guest.autreEglise}` : "Sans église locale"}
                </span>
              </div>

              <div className={styles.specRow}>
                <span className={styles.specKey}>Modalité de venue</span>
                <span className={styles.specVal}>
                  {guest.aEteInvite && guest.parQui ? `Invité(e) par ${guest.parQui}` : guest.aEteInvite ? "Invité(e)" : "Venue spontanée"}
                </span>
              </div>
            </div>

            {/* Wishes tags */}
            <div className={styles.wishesWrap}>
              <span className={`${styles.wishTag} ${guest.souhaiteEtreContacte !== false ? styles.wishTagActive : ""}`}>
                {guest.souhaiteEtreContacte !== false ? "✓ Souhaite être contacté(e)" : "✕ Ne souhaite pas être contacté(e)"}
              </span>

              {guest.interetFormation && (
                <span className={`${styles.wishTag} ${styles.wishTagActive}`}>
                  ✓ Intérêt PCNC
                </span>
              )}

              {guest.interetCDM && (
                <span className={`${styles.wishTag} ${styles.wishTagActive}`}>
                  ✓ Intérêt Cellule de maison (CDM)
                </span>
              )}

              {guest.interetBapteme && (
                <span className={`${styles.wishTag} ${styles.wishTagActive}`}>
                  ✓ Intérêt Baptême par immersion
                </span>
              )}

              {guest.aps && (
                <span className={`${styles.wishTag} ${styles.wishTagActive}`}>
                  ✓ Fiche APS complétée
                </span>
              )}
            </div>

            {/* Initial Comment from arrival form */}
            {guest.commentaire && (
              <div>
                <div className={styles.subLabel}>
                  Requête ou commentaire initial
                </div>
                <blockquote className={styles.quoteCard}>
                  &ldquo;{guest.commentaire}&rdquo;
                </blockquote>
              </div>
            )}
          </div>

          {/* 6. Spiritual Journey & Integration */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Parcours d&apos;intégration & Présences</h3>
            <div className={styles.specList}>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Famille de disciples</span>
                <span className={styles.specVal} style={{ color: guest.famille_disciple && guest.famille_disciple !== "AUCUNE" ? "var(--gold-light)" : "var(--muted)" }}>
                  {guest.famille_disciple && guest.famille_disciple !== "AUCUNE" ? guest.famille_disciple : "Sans famille affectée"}
                </span>
              </div>

              <div className={styles.specRow}>
                <span className={styles.specKey}>Cellule de maison</span>
                <span className={styles.specVal}>
                  {guest.integreCDM ? "Intégré(e) en CDM" : "Non intégré(e)"}
                </span>
              </div>

              <div className={styles.specRow}>
                <span className={styles.specKey}>Baptême d&apos;eau</span>
                <span className={styles.specVal}>
                  {guest.baptemeEau ? "Effectué par immersion" : "En attente"}
                </span>
              </div>

              {guest.status === "Brebi" && (
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Statut bergerie</span>
                  <span className={styles.specVal} style={{ color: "var(--gold)" }}>
                    Brebis du Seigneur
                  </span>
                </div>
              )}
            </div>

            {/* PCNC Steps */}
            <div>
              <div className={styles.subLabel}>
                Progression PCNC
              </div>
              <div className={styles.pcncGrid}>
                {[
                  { code: "001", name: "Naissance", done: guest.pcnc || guest.terminePCNC },
                  { code: "101", name: "Fondements", done: guest.p101 || guest.terminePCNC },
                  { code: "201", name: "Croissance", done: guest.p201 || guest.terminePCNC },
                  { code: "301", name: "Service", done: guest.p301 || guest.terminePCNC },
                ].map(step => (
                  <div key={step.code} className={`${styles.pcncCard} ${step.done ? styles.pcncCardDone : ""}`}>
                    <span className={styles.pcncNum}>{step.code}</span>
                    <span className={styles.pcncName}>{step.name}</span>
                    <span className={styles.pcncStatus}>{step.done ? "Validé" : "À suivre"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Presence History */}
            <div>
              <div className={styles.subLabel}>
                Historique des présences ({presenceList.length})
              </div>
              {presenceList.length === 0 ? (
                <p className={styles.emptyText}>Aucun pointage de présence consigné.</p>
              ) : (
                <div className={styles.presenceList}>
                  {presenceList.map((item) => (
                    <div key={item.dateStr} className={styles.presenceRow}>
                      <span className={styles.presenceDate}>{item.formatted}</span>
                      <span className={item.day === 0 ? styles.tagSunday : styles.tagThursday}>
                        {item.eventType}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <button type="button" onClick={onClose} className={styles.footerCloseBtn}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
