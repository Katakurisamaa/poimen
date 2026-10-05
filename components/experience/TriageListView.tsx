"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Phone, Mail, Calendar, User, Eye, UserCheck, UserMinus, 
  AlertTriangle, ShieldCheck, Clock, UserPlus, PhoneCall,
  Home, Trash2, Search, X, MoreHorizontal, Edit3
} from "lucide-react";
import CustomSelect from "@/components/ui/CustomSelect";
import styles from "./TriageListView.module.css";

interface CounselorOption {
  id: string;
  display_name: string;
  email: string;
}

interface TriageListViewProps {
  mode: "unassigned" | "my_assignments" | "retired" | "all_guests";
  guests: any[];
  counselors: CounselorOption[];
  onAssign?: (guestId: string, counselorId: string | null) => Promise<void>;
  onOpenVoirPlus: (guest: any) => void;
  onOpenConserver?: (guest: any) => void;
  onOpenRetirer?: (guest: any) => void;
  onDeleteGuest?: (guestId: string) => Promise<void>;
  onEditGuest?: (guest: any) => void;
  isLeader?: boolean;
}

const formatDisplayDate = (d?: string) => {
  if (!d) return "—";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    return d;
  } catch {
    return d;
  }
};

const MOTIF_LABELS: Record<string, string> = {
  ne_decroche_pas: "Ne décroche pas",
  faux_numero: "Faux numéro",
  autre_eglise: "Autre église",
  pas_interesse: "Pas intéressé(e)",
  demenagement: "Déménagement",
  retire_depuis_mes_ames: "Retiré de mon suivi",
  autre: "Autre raison"
};

function parseRetiredComment(raw?: string): { humanNote: string; lastCall: string } {
  if (!raw) return { humanNote: "", lastCall: "" };

  // 1. Strip technical bracket metadata tags [TAG:value] or [TAG]
  const text = raw
    .replace(/\[[A-Za-z0-9_]+:[^\]]*\]/gi, " ")
    .replace(/\[(?:FAUX_NUMERO|NE_DECROCHE_PAS)\]/gi, " ")
    .replace(/Retir[ée] directement depuis l'onglet Mes [âa]mes/gi, " ")
    .trim();

  // 2. Identify automated call and email events
  const callRegex = /(?:Appel tenté le \d{1,2}\/\d{1,2}\/\d{2,4}[^)]*\)|Contact établi\s*\([^)]*\)|Contact établi par e-mail le \d{1,2}\/\d{1,2}\/\d{2,4}|Appel abouti le \d{1,2}\/\d{1,2}\/\d{2,4})/gi;

  const matches = text.match(callRegex);
  let lastCall = "";
  if (matches && matches.length > 0) {
    const reversed = [...matches].reverse();
    const contactEvent = reversed.find(m => /contact établi/i.test(m)) || reversed[0];
    lastCall = contactEvent.trim();
  }

  // 3. Remove automated call snippets to isolate genuine human note
  let humanNote = text
    .replace(callRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If humanNote contains only punctuation or whitespace, clear it
  if (/^[\s,;.:!?-]+$/.test(humanNote)) {
    humanNote = "";
  } else {
    humanNote = humanNote.replace(/^[\s,;:]+/, "").trim();
  }

  return { humanNote, lastCall };
}

export default function TriageListView({
  mode,
  guests,
  counselors,
  onAssign,
  onOpenVoirPlus,
  onOpenConserver,
  onOpenRetirer,
  onDeleteGuest,
  onEditGuest,
  isLeader = false
}: TriageListViewProps) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [activeMenuGuestId, setActiveMenuGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeMenuGuestId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuGuestId(null);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Do not close if clicking inside CustomSelect popup / dropdown, or inside the panel or trigger
      if (
        target.closest?.('[role="listbox"]') ||
        target.closest?.(`.${styles.rowToolsPanel}`) ||
        target.closest?.(`.${styles.btnActionsTrigger}`)
      ) {
        return;
      }
      setActiveMenuGuestId(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeMenuGuestId]);

  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const query = normalize(search.trim());
  const visibleGuests = guests.filter(guest => normalize([guest.firstName, guest.lastName, guest.phone, guest.email].filter(Boolean).join(" ")).includes(query));

  const counselorSelectOptions = useMemo(() => [
    { value: "", label: "— Sélectionner un conseiller —" },
    ...counselors.map(c => ({
      value: c.id,
      label: c.display_name || c.email
    }))
  ], [counselors]);

  const handleSelectCounselor = async (guestId: string, counselorId: string) => {
    if (!onAssign) return;
    setAssigningId(guestId);
    try {
      await onAssign(guestId, counselorId || null);
    } finally {
      setAssigningId(null);
    }
  };

  const counselorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    counselors.forEach(c => map.set(c.id, c.display_name || c.email));
    return map;
  }, [counselors]);

  if (guests.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          {mode === "unassigned" && <ShieldCheck size={26} />}
          {mode === "my_assignments" && <UserCheck size={26} />}
          {mode === "retired" && <Clock size={26} />}
          {mode === "all_guests" && <User size={26} />}
        </div>
        <h3 className={styles.emptyTitle}>
          {mode === "unassigned" && "Aucun invité en attente d'affectation"}
          {mode === "my_assignments" && "Toutes vos affectations sont traitées !"}
          {mode === "retired" && "Aucune personne dans Sans suite"}
          {mode === "all_guests" && "Aucun invité trouvé"}
        </h3>
        <p className={styles.emptySubtitle}>
          {mode === "unassigned" && "Tous les nouveaux arrivants ont déjà été attribués à un conseiller de l'équipe."}
          {mode === "my_assignments" && "Vous n'avez aucune nouvelle personne en attente de premier contact. Vos brebis suivies se trouvent dans l'onglet 'Mes brebis'."}
          {mode === "retired" && "Les personnes retirées suite à un premier contact sans suite apparaîtront ici avec leur rapport de clôture."}
          {mode === "all_guests" && "Aucune personne ne correspond à vos filtres ou aucun invité n'a encore été enregistré."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {mode !== "all_guests" && (
        <div className={styles.searchToolbar}>
          <label className={styles.searchField}>
            <Search size={18} aria-hidden="true" className={styles.searchIcon} />
            <span className={styles.srOnly}>Rechercher dans cette liste</span>
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nom, téléphone ou e-mail…"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <span className={styles.searchResultBadge} role="status">
            {visibleGuests.length} résultat{visibleGuests.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
      {/* Summary info banner */}
      <div className={styles.summaryBanner} hidden={mode === "all_guests"}>
        <div className={styles.summaryText}>
          {mode === "unassigned" && (
            <>
              <span className={styles.summaryHighlight}>{guests.length}</span> invité{guests.length > 1 ? "s" : ""} non affecté{guests.length > 1 ? "s" : ""} (classés du plus récent au plus ancien)
            </>
          )}
          {mode === "my_assignments" && (
            <>
              <span className={styles.summaryHighlight}>{guests.length}</span> personne{guests.length > 1 ? "s" : ""} à contacter pour premier échange et qualification
            </>
          )}
          {mode === "retired" && (
            <>
              <span className={styles.summaryHighlight}>{guests.length}</span> dossier{guests.length > 1 ? "s" : ""} sans suite clôturé{guests.length > 1 ? "s" : ""}
            </>
          )}
          {mode === "all_guests" && (
            <>
              <span className={styles.summaryHighlight}>{guests.length}</span> invité{guests.length > 1 ? "s" : ""} enregistré{guests.length > 1 ? "s" : ""} (supervision globale)
            </>
          )}
        </div>
      </div>

      {/* Cards list */}
      <div className={styles.cardsGrid}>
        {visibleGuests.length === 0 && <div className={styles.emptyState}><h3 className={styles.emptyTitle}>Aucun résultat pour cette recherche</h3><p className={styles.emptySubtitle}>Essayez un autre nom, téléphone ou e-mail.</p><button type="button" className={styles.btnVoirPlus} onClick={() => setSearch("")}>Effacer la recherche</button></div>}
        {visibleGuests.map((g) => {
          const initials = `${(g.firstName || "")[0] || ""}${(g.lastName || "")[0] || ""}`.toUpperCase() || "IN";
          const primaryContact = g.phone ? g.phone : g.email ? g.email : null;
          const isPhone = Boolean(g.phone);
          const motifLabel = g.motifRetrait ? (MOTIF_LABELS[g.motifRetrait] || g.motifRetrait) : (g.raisonEchec || "Sans suite");
          const retiredByName = g.retirePar ? (counselorNameMap.get(g.retirePar) || "Conseiller") : null;

          return (
            <div key={g.id} className={styles.card}>
              <div className={styles.personMain}>
                <div className={styles.avatarCircle}>{initials}</div>
                <div className={styles.infoWrap}>
                  <div className={styles.nameRow}>
                    <span className={styles.personFullName}>
                      {g.civility} {g.firstName} {g.lastName}
                    </span>
                    {g.age && <span className={styles.badgeAge}>{g.age}</span>}
                    {mode === "retired" && (
                      <span className={styles.badgeMotif}>
                        <AlertTriangle size={12} /> {motifLabel}
                      </span>
                    )}
                    {mode === "all_guests" && (
                      <>
                        {g.famille_disciple && g.famille_disciple !== "AUCUNE" ? (
                          <span className={styles.badgeFamily}>
                            <Home size={12} /> {g.famille_disciple}
                          </span>
                        ) : (
                          <span className={styles.badgeNoFamily}>
                            <Home size={12} /> Sans famille
                          </span>
                        )}
                        {(() => {
                          const counselorName = g.assigned_to 
                            ? (counselorNameMap.get(g.assigned_to) || g.responsible || "") 
                            : (g.responsible && g.responsible !== "Non assigné" ? g.responsible : "");
                          const counselorFirstName = counselorName ? counselorName.trim().split(" ")[0] : "";
                          return counselorFirstName ? (
                            <span className={styles.badgeCounselor}>
                              <UserCheck size={12} /> {counselorFirstName}
                            </span>
                          ) : (
                            <span className={styles.badgeUnassigned}>
                              <UserPlus size={12} /> Non assigné(e)
                            </span>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}>
                      <Calendar size={13} /> Arrivé(e) le {formatDisplayDate(g.arrivalDate)}
                    </span>

                    {primaryContact && (
                      <span className={styles.metaItem}>
                        {isPhone ? <Phone size={13} /> : <Mail size={13} />}
                        {isPhone ? (
                          <a href={`tel:${primaryContact.replace(/\s+/g, "")}`} className={styles.contactLink}>
                            {primaryContact}
                          </a>
                        ) : (
                          <a href={`mailto:${primaryContact}`} className={styles.contactLink}>
                            {primaryContact}
                          </a>
                        )}
                      </span>
                    )}

                    {mode === "retired" && retiredByName && (
                      <span className={styles.metaItem}>
                        <User size={13} /> Retiré par {retiredByName}
                      </span>
                    )}
                  </div>

                  {/* Comment snippet and call history in retired mode */}
                  {mode === "retired" && (() => {
                    const { humanNote, lastCall } = parseRetiredComment(g.commentaireSuivi);
                    if (!humanNote && !lastCall) return null;
                    return (
                      <div className={styles.retiredFeedbackWrap}>
                        {humanNote && (
                          <div className={styles.reportSnippet}>
                            &ldquo;{humanNote}&rdquo;
                          </div>
                        )}
                        {lastCall && (
                          <div className={styles.callSnippet}>
                            <PhoneCall size={12} className={styles.callIcon} />
                            <span>Dernier échange : {lastCall}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Actions based on mode */}
              <div className={styles.actionsWrap}>
                {mode === "unassigned" && (
                  <>
                    <div className={styles.assignSelectTrigger}>
                      <CustomSelect
                        size="sm"
                        value={g.assigned_to || ""}
                        onChange={(val) => handleSelectCounselor(g.id, val)}
                        disabled={assigningId === g.id}
                        placeholder={assigningId === g.id ? "Affectation..." : "Affecter à..."}
                        options={counselorSelectOptions}
                        searchable={true}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.btnVoirPlus}
                      onClick={() => onOpenVoirPlus(g)}
                      title="Voir les informations saisies au formulaire"
                    >
                      <Eye size={14} /> Voir la fiche
                    </button>
                  </>
                )}

                {mode === "my_assignments" && (
                  <>
                    <button
                      type="button"
                      className={styles.btnConserver}
                      onClick={() => onOpenConserver && onOpenConserver(g)}
                      title="Confirmer l'appel et conserver dans Mes brebis"
                    >
                      <UserCheck size={14} /> Conserver
                    </button>
                    <button
                      type="button"
                      className={styles.btnRetirer}
                      onClick={() => onOpenRetirer && onOpenRetirer(g)}
                      title="Retirer avec rapport vers l'onglet Sans suite"
                    >
                      <UserMinus size={14} /> Retirer
                    </button>
                    <button
                      type="button"
                      className={styles.btnVoirPlus}
                      onClick={() => onOpenVoirPlus(g)}
                      title="Voir les informations saisies au formulaire"
                    >
                      <Eye size={14} /> Voir la fiche
                    </button>
                  </>
                )}

                {mode === "retired" && (
                  <>
                    {isLeader && onAssign && (
                      <div className={styles.assignSelectTrigger}>
                        <CustomSelect
                          size="sm"
                          value=""
                          onChange={(val) => handleSelectCounselor(g.id, val)}
                          disabled={assigningId === g.id}
                          placeholder={assigningId === g.id ? "Réaffectation..." : "Réaffecter à..."}
                          options={counselorSelectOptions}
                          searchable={true}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.btnVoirPlus}
                      onClick={() => onOpenVoirPlus(g)}
                      title="Voir les informations saisies au formulaire"
                    >
                      <Eye size={14} /> Voir la fiche
                    </button>
                  </>
                )}

                {mode === "all_guests" && (
                  <>
                    <button type="button" className={styles.btnVoirPlus} onClick={() => onOpenVoirPlus(g)}>
                      <Eye size={15} /> Voir la fiche
                    </button>
                    {isLeader && onEditGuest && (
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={() => onEditGuest(g)}
                        title="Modifier les informations du formulaire"
                      >
                        <Edit3 size={14} /> Modifier
                      </button>
                    )}
                    {((isLeader && onAssign) || onDeleteGuest || (isLeader && onEditGuest)) && (() => {
                      const isMenuOpen = activeMenuGuestId === g.id;
                      const panelBody = (
                        <>
                          <div className={styles.mobileDragHandle} aria-hidden="true" />
                          <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}>
                              <strong>Actions rapides</strong>
                              <small>{g.firstName} {g.lastName}</small>
                            </div>
                            <button
                              type="button"
                              className={styles.panelCloseBtn}
                              onClick={() => setActiveMenuGuestId(null)}
                              title="Fermer"
                              aria-label="Fermer"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <div className={styles.panelContent}>
                            {isLeader && onEditGuest && (
                              <button
                                type="button"
                                className={styles.btnEditTool}
                                onClick={() => {
                                  setActiveMenuGuestId(null);
                                  onEditGuest(g);
                                }}
                              >
                                <Edit3 size={15} /> Modifier le formulaire
                              </button>
                            )}

                            {isLeader && onAssign && (
                              <div className={styles.assignmentField}>
                                <span>Conseiller en charge</span>
                                <CustomSelect
                                  size="sm"
                                  value={g.assigned_to || ""}
                                  onChange={(val) => handleSelectCounselor(g.id, val)}
                                  disabled={assigningId === g.id}
                                  placeholder={assigningId === g.id ? "Affectation en cours..." : "Choisir un conseiller"}
                                  options={counselorSelectOptions}
                                  searchable
                                />
                              </div>
                            )}

                            {onDeleteGuest && (
                              <button
                                type="button"
                                className={styles.btnDelete}
                                onClick={() => {
                                  setActiveMenuGuestId(null);
                                  onDeleteGuest(g.id);
                                }}
                              >
                                <Trash2 size={15} /> Supprimer définitivement
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            className={styles.mobileCloseBtn}
                            onClick={() => setActiveMenuGuestId(null)}
                          >
                            Fermer
                          </button>
                        </>
                      );

                      return (
                        <div className={`${styles.rowTools} ${isMenuOpen ? styles.rowToolsOpen : ""}`}>
                          <button
                            type="button"
                            className={`${styles.btnActionsTrigger} ${isMenuOpen ? styles.btnActionsTriggerActive : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuGuestId(isMenuOpen ? null : g.id);
                            }}
                            aria-expanded={isMenuOpen}
                            aria-haspopup="dialog"
                            aria-label={`Actions pour ${g.firstName} ${g.lastName}`}
                            title="Options et actions"
                          >
                            <MoreHorizontal size={18} />
                            <span>Actions</span>
                          </button>

                          {isMenuOpen && typeof document !== "undefined" && createPortal(
                            <div
                              className={styles.modalOverlay}
                              onClick={() => setActiveMenuGuestId(null)}
                              aria-hidden="true"
                            >
                              <div
                                className={styles.rowToolsPanel}
                                role="dialog"
                                aria-modal="true"
                                aria-label={`Actions pour ${g.firstName} ${g.lastName}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {panelBody}
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
