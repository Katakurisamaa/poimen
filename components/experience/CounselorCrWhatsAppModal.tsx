"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, FileText, MessageCircle, Pencil, PhoneCall, PhoneMissed, Plus, RotateCcw, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { buildWhatsAppShareUrl, formatCrDate, formatFullCrMessage, guestToSoulCrItem, type CrAudience, type CrStatus, type GuestCrSource, type SoulCrItem } from "@/lib/cr-whatsapp";
import CrMessagePreview from "./CrMessagePreview";
import CrReportDatePicker, { dateKey } from "./CrReportDatePicker";
import styles from "./CounselorCrWhatsAppModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialGuest?: GuestCrSource | null;
  counselorGuests?: GuestCrSource[];
  defaultDate?: string;
}
type Step = 0 | 1 | 2;
type StatusField = "appelAbouti" | "revientEglise" | "groupeWhatsapp" | "pcnc" | "douzePiliers" | "aps" | "crEnLigne";
const EMPTY_GUESTS: GuestCrSource[] = [];
const STATUS_FIELDS: Array<[StatusField, string]> = [
  ["appelAbouti", "Appel abouti"],
  ["revientEglise", "Revient à l’église"],
  ["groupeWhatsapp", "Groupe WhatsApp"],
  ["pcnc", "PCNC"],
  ["douzePiliers", "12 piliers"],
  ["aps", "APS"],
  ["crEnLigne", "CR en ligne"]
];

export type ReportFieldKey =
  | "appelAbouti"
  | "revientEglise"
  | "groupeWhatsapp"
  | "pcnc"
  | "douzePiliers"
  | "aps"
  | "celluleMaison"
  | "crEnLigne";

export const ALL_REPORT_FIELDS: Array<{ key: ReportFieldKey; label: string; short: string }> = [
  { key: "appelAbouti", label: "Appel abouti", short: "Appel" },
  { key: "revientEglise", label: "Revient à l’église", short: "Revient" },
  { key: "groupeWhatsapp", label: "Groupe WhatsApp", short: "WhatsApp" },
  { key: "pcnc", label: "PCNC", short: "PCNC" },
  { key: "douzePiliers", label: "12 piliers", short: "12 piliers" },
  { key: "aps", label: "APS", short: "APS" },
  { key: "celluleMaison", label: "Cellule de maison", short: "Cellule" },
  { key: "crEnLigne", label: "CR en ligne", short: "CR en ligne" }
];

const STEPS = ["Personnes", "Suivi", "Partager"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
const statusLabel = (value?: CrStatus) => typeof value !== "boolean" ? "À préciser" : value ? "Oui" : "Non";
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

function validDate(value?: string): string | null {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? [match[3], match[2], match[1]].join("-") : value?.split("T")[0];
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map(Number);
    if (dateKey(new Date(year, month - 1, day)) === iso) return iso;
  }
  return null;
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const tone = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3;
  return <span className={small ? styles.avatarSmall : styles.avatar} data-tone={tone} aria-hidden="true">{initials(name)}</span>;
}
function StatusChoice({
  label,
  name,
  value,
  isExcluded = false,
  onToggleExclude,
  onChange
}: {
  label: string;
  name: string;
  value?: CrStatus;
  isExcluded?: boolean;
  onToggleExclude?: () => void;
  onChange: (value: CrStatus) => void;
}) {
  return (
    <fieldset className={styles.statusChoice} data-excluded={isExcluded}>
      <legend>
        <span className={styles.statusLabelText}>{label}</span>
        {onToggleExclude && (
          <button
            type="button"
            className={styles.fieldExcludeBtn}
            onClick={onToggleExclude}
            title={isExcluded ? `Ajouter « ${label} » au rapport` : `Ne pas ajouter « ${label} » au rapport`}
            aria-label={isExcluded ? `Ajouter « ${label} » au rapport` : `Ne pas ajouter « ${label} » au rapport`}
          >
            {isExcluded ? (
              <>
                <EyeOff size={13} aria-hidden="true" />
                <span className={styles.excludedBadge}>Non inclus</span>
              </>
            ) : (
              <Eye size={13} aria-hidden="true" />
            )}
          </button>
        )}
      </legend>
      <div className={styles.segmented} data-disabled={isExcluded}>
        {([{ value: true, label: "Oui" }, { value: false, label: "Non" }, { value: null, label: "À préciser" }] as const).map(option => (
          <label key={String(option.value)} data-checked={(value ?? null) === option.value}>
            <input
              type="radio"
              name={name}
              disabled={isExcluded}
              checked={(value ?? null) === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CrComposer({ onClose, initialGuest, counselorGuests = EMPTY_GUESTS, defaultDate }: Omit<Props, "isOpen">) {
  // Mount once per opening so parent refreshes never reset work in progress.
  const [originals] = useState(() => {
    const sources = new Map<string, GuestCrSource>();
    if (initialGuest?.id) sources.set(initialGuest.id, initialGuest);
    counselorGuests.forEach(guest => { if (guest?.id && !sources.has(guest.id)) sources.set(guest.id, guest); });
    return Array.from(sources.values()).map(guestToSoulCrItem);
  });
  const [items, setItems] = useState<Record<string, SoulCrItem>>(() => Object.fromEntries(originals.map(item => [item.id, item])));
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialGuest?.id ? [initialGuest.id] : []);
  const [activeId, setActiveId] = useState(initialGuest?.id || "");
  const [step, setStep] = useState<Step>(initialGuest?.id ? 1 : 0);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "reached" | "pending">("all");
  const [reportDate, setReportDate] = useState(() => validDate(defaultDate) || validDate(initialGuest?.arrivalDate || initialGuest?.arrival_date) || dateKey(new Date()));
  const [dateEdited, setDateEdited] = useState(Boolean(validDate(defaultDate)));
  const [audience, setAudience] = useState<CrAudience>("group");
  const [feedback, setFeedback] = useState<{ message: string; text: string; error?: boolean } | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const formPaneRef = useRef<HTMLDivElement>(null);
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);

  const selectedItems = selectedIds.map(id => items[id]).filter(Boolean);
  const activeIndex = Math.max(0, selectedIds.indexOf(activeId));
  const active = selectedItems[activeIndex];
  const activeExcluded = active?.excludedFields || [];

  function toggleFieldForActive(fieldKey: string) {
    if (!active) return;
    const current = active.excludedFields || [];
    const next = current.includes(fieldKey)
      ? current.filter(k => k !== fieldKey)
      : [...current, fieldKey];
    patchActive({ excludedFields: next });
  }

  function resetFieldsForActive() {
    if (!active) return;
    patchActive({ excludedFields: [] });
  }

  function applyActiveExclusionsToAll() {
    if (!active) return;
    const current = active.excludedFields || [];
    setItems(prev => {
      const updated = { ...prev };
      selectedIds.forEach(id => {
        if (updated[id]) {
          updated[id] = { ...updated[id], excludedFields: [...current] };
        }
      });
      return updated;
    });
  }

  function resetAllPeopleExclusions() {
    setItems(prev => {
      const updated = { ...prev };
      selectedIds.forEach(id => {
        if (updated[id]) {
          updated[id] = { ...updated[id], excludedFields: [] };
        }
      });
      return updated;
    });
  }

  const fullMessage = formatFullCrMessage(selectedItems, reportDate, audience);
  const visibleFeedback = feedback?.message === fullMessage ? feedback : null;
  const filtered = originals.filter(item => normalize(item.name).includes(normalize(query.trim())) &&
    (filter === "all" || (filter === "reached" ? item.appelAbouti === true : item.appelAbouti !== true)));
  const allVisibleSelected = filtered.length > 0 && filtered.every(item => selectedIds.includes(item.id));
  const activeOriginal = active && originals.find(item => item.id === active.id);
  const adjusted = active && JSON.stringify(active) !== JSON.stringify(activeOriginal);
  const arrivalDates = Array.from(new Set(selectedItems.map(item => validDate(item.arrivalDate)).filter((date): date is string => Boolean(date))));

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const overlay = dialogRef.current?.parentElement;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement =>
      element instanceof HTMLElement && element !== overlay && !["SCRIPT", "STYLE"].includes(element.tagName));
    const previousInert = siblings.map(element => ({ element, inert: element.inert }));
    siblings.forEach(element => { element.inert = true; });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousInert.forEach(({ element, inert }) => { element.inert = inert; });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    workspaceRef.current?.scrollTo({ top: 0 });
    formPaneRef.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (manualCopy) {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    }
  }, [manualCopy]);

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]'
    ) || []).filter(element => element.getClientRects().length && element.tabIndex >= 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  function goTo(next: Step) {
    if (next > 0 && !selectedIds.length) return;
    setStep(next); setEditing(false); setManualCopy(false);
  }
  function updateSelection(next: string[]) {
    setSelectedIds(next);
    if (!next.includes(activeId)) setActiveId(next[0] || "");
    if (!dateEdited && next.length) {
      const date = validDate(items[next[0]].arrivalDate);
      if (date) setReportDate(date);
    }
  }
  function togglePerson(id: string) {
    if (selectedIds.includes(id)) {
      updateSelection(selectedIds.filter(selected => selected !== id));
    } else {
      setItems(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          excludedFields: []
        }
      }));
      updateSelection([...selectedIds, id]);
    }
  }
  function toggleVisible() {
    const visibleIds = new Set(filtered.map(item => item.id));
    if (allVisibleSelected) {
      updateSelection(selectedIds.filter(id => !visibleIds.has(id)));
    } else {
      const next = Array.from(new Set([...selectedIds, ...visibleIds]));
      setItems(prev => {
        const updated = { ...prev };
        visibleIds.forEach(id => {
          if (!selectedIds.includes(id) && updated[id]) {
            updated[id] = { ...updated[id], excludedFields: [] };
          }
        });
        return updated;
      });
      updateSelection(next);
    }
  }
  function patchActive(patch: Partial<SoulCrItem>) {
    if (!active) return;
    setItems(previous => ({ ...previous, [active.id]: { ...previous[active.id], ...patch } }));
  }
  function switchPerson(id: string) { setActiveId(id); setEditing(false); }
  async function copyMessage() {
    if (!fullMessage || copying) return;
    const message = fullMessage;
    setCopying(true);
    let copied = false;
    try { await navigator.clipboard.writeText(message); copied = true; }
    catch {
      const input = document.createElement("textarea");
      input.value = message;
      input.setAttribute("readonly", "");
      input.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      dialogRef.current?.appendChild(input);
      const focus = document.activeElement as HTMLElement | null;
      try { input.select(); copied = document.execCommand("copy"); } catch { copied = false; }
      finally { input.remove(); focus?.focus(); }
    }
    setCopying(false);
    setFeedback({ message, text: copied ? "Message copié. Vous pouvez le coller dans WhatsApp." : "La copie automatique est indisponible. Le texte est sélectionné ci-dessous.", error: !copied });
    if (!copied) setManualCopy(true);
  }

  return (
    <div className={styles.backdrop}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cr-title" tabIndex={-1} onKeyDown={handleKeys}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandIcon}><MessageCircle size={22} strokeWidth={1.6} aria-hidden="true" /></span><div><span className={styles.eyebrow}>POIMÉN · CALL CENTER</span><h1 id="cr-title">Mon compte-rendu</h1></div></div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fermer le compte-rendu"><X size={20} /></button>
        </header>
        <nav className={styles.steps} aria-label="Étapes du compte-rendu">
          {STEPS.map((label, index) => (
            <button key={label} type="button" aria-current={step === index ? "step" : undefined} disabled={index > 0 && !selectedIds.length} data-complete={step > index} onClick={() => goTo(index as Step)}>
              <span>{step > index ? <Check size={14} aria-hidden="true" /> : "0" + (index + 1)}</span>{label}
            </button>
          ))}
          <span className={styles.prefilled}><FileText size={13} aria-hidden="true" /> Prérempli pour vous</span>
        </nav>
        <div ref={workspaceRef} className={styles.workspace} data-step={step}>
          <div ref={formPaneRef} className={styles.formPane}>
            {step === 0 && (
              <>
                <div className={styles.sectionIntro}><span className={styles.kicker}>01 · LES PERSONNES</span><h2 ref={headingRef} tabIndex={-1}>Qui souhaitez-vous inclure ?</h2><p>Un suivi individuel ou plusieurs personnes dans le même message.</p></div>
                {originals.length ? (
                  <>
                    <div className={styles.search}><Search size={18} aria-hidden="true" /><label className={styles.srOnly} htmlFor="cr-search">Rechercher une personne</label><input id="cr-search" type="text" role="searchbox" inputMode="search" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Rechercher un prénom ou un nom…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery("")}><X size={15} /></button>}</div>
                    <div className={styles.filters} role="group" aria-label="Filtrer les personnes">
                      {([["all", "Toutes"], ["reached", "Appels aboutis"], ["pending", "À joindre"]] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
                    </div>
                    <div className={styles.listHeading}><span>{filtered.length} personne{filtered.length > 1 ? "s" : ""}</span><button type="button" onClick={toggleVisible} disabled={!filtered.length}>{allVisibleSelected ? "Désélectionner les résultats" : "Sélectionner les résultats"}</button></div>
                    <div className={styles.people}>
                      {filtered.map(item => (
                        <label key={item.id} className={styles.personRow} data-selected={selectedIds.includes(item.id)}>
                          <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => togglePerson(item.id)} />
                          <Avatar name={item.name} small />
                          <span className={styles.personCopy}><strong>{item.name}</strong><small>{item.arrivalDate ? "Accueil du " + formatCrDate(item.arrivalDate) : "Date d’accueil non renseignée"}</small></span>
                          <span className={styles.callDot} data-reached={item.appelAbouti === true} aria-label={item.appelAbouti === true ? "Appel abouti" : item.appelAbouti === false ? "Appel non abouti" : "Appel à préciser"} />
                          <span className={styles.checkbox} aria-hidden="true">{selectedIds.includes(item.id) && <Check size={14} />}</span>
                        </label>
                      ))}
                      {!filtered.length && <div className={styles.empty}><Search size={26} /><strong>Aucun résultat</strong><p>Essayez un autre nom ou le filtre « Toutes ».</p></div>}
                    </div>
                    {!!selectedIds.length && <div className={styles.selectionRecap}><Users size={15} aria-hidden="true" /><span>{selectedIds.length} personne{selectedIds.length > 1 ? "s" : ""} dans votre CR</span><button type="button" onClick={() => updateSelection([])}>Effacer</button></div>}
                  </>
                ) : <div className={styles.empty}><Users size={32} strokeWidth={1.4} /><strong>Vos personnes apparaîtront ici</strong><p>Vous pouvez aussi préparer un CR directement depuis une fiche dans « Mes âmes ».</p></div>}
              </>
            )}
            {step === 1 && active && (
              <>
                <div className={styles.sectionIntro}><span className={styles.kicker}>02 · LE SUIVI</span><h2 ref={headingRef} tabIndex={-1}>L’essentiel est déjà là.</h2><p>Relisez le suivi. Ajustez seulement ce qui a changé.</p></div>

                <div className={styles.fieldsBar}>
                  <div className={styles.fieldsBarHeader}>
                    <span className={styles.fieldsBarTitle}>
                      <SlidersHorizontal size={13} aria-hidden="true" />
                      <span>Champs pour {active.name} ({ALL_REPORT_FIELDS.length - activeExcluded.length}/{ALL_REPORT_FIELDS.length})</span>
                    </span>
                    <div className={styles.fieldsBarActions}>
                      {activeExcluded.length > 0 && (
                        <button
                          type="button"
                          className={styles.resetFieldsBtn}
                          onClick={resetFieldsForActive}
                          title="Réinitialiser pour cette personne"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                          <span>Réinitialiser</span>
                        </button>
                      )}
                      {activeExcluded.length > 0 && selectedItems.length > 1 && (
                        <button
                          type="button"
                          className={styles.applyAllBtn}
                          onClick={applyActiveExclusionsToAll}
                          title="Appliquer ces choix à toutes les personnes du CR"
                        >
                          Appliquer à tous
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.fieldsChips} role="group" aria-label={`Champs du rapport pour ${active.name}`}>
                    {ALL_REPORT_FIELDS.map(f => {
                      const isIncluded = !activeExcluded.includes(f.key);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          aria-pressed={isIncluded}
                          className={styles.fieldChip}
                          onClick={() => toggleFieldForActive(f.key)}
                          title={isIncluded ? `Cliquer pour retirer « ${f.label} » pour ${active.name}` : `Cliquer pour ajouter « ${f.label} » pour ${active.name}`}
                        >
                          {isIncluded ? <Check size={11} aria-hidden="true" /> : <EyeOff size={11} aria-hidden="true" />}
                          <span>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedItems.length > 1 && (
                  <div className={styles.personTabs} role="group" aria-label="Choisir le suivi à relire">
                    {selectedItems.map(item => {
                      const excludedCount = item.excludedFields?.length || 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active.id === item.id}
                          onClick={() => switchPerson(item.id)}
                        >
                          <Avatar name={item.name} small />
                          <span>{item.name}</span>
                          {excludedCount > 0 && (
                            <span
                              className={styles.tabBadge}
                              title={`${excludedCount} champ${excludedCount > 1 ? "s" : ""} retiré${excludedCount > 1 ? "s" : ""} du CR`}
                            >
                              <EyeOff size={10} aria-hidden="true" />
                              <span>{ALL_REPORT_FIELDS.length - excludedCount}/{ALL_REPORT_FIELDS.length}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <article className={styles.personCard}>
                  <div className={styles.personCardHeader}><Avatar name={active.name} /><div><h3>{active.name}</h3><p>{adjusted ? "Ajusté pour ce compte-rendu" : "Informations de la fiche Poimén"}</p></div><button type="button" className={styles.editButton} aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? <Check size={14} /> : <Pencil size={14} />}{editing ? "Terminer" : "Ajuster"}</button></div>
                  {editing ? (
                    <div className={styles.editor}>
                      {STATUS_FIELDS.map(([key, label]) => (
                        <StatusChoice
                          key={key}
                          label={label}
                          name={active.id + "-" + key}
                          value={active[key]}
                          isExcluded={activeExcluded.includes(key)}
                          onToggleExclude={() => toggleFieldForActive(key)}
                          onChange={value =>
                            patchActive({
                              [key]: value,
                              ...(key === "revientEglise" ? { prevuRevenir: value } : {})
                            })
                          }
                        />
                      ))}
                      {active.appelAbouti === false && !activeExcluded.includes("appelAbouti") && (
                        <fieldset className={styles.quickChoices}>
                          <legend>Motif, si connu</legend>
                          {["Ne décroche pas", "Faux numéro", "Pas de numéro"].map(reason => (
                            <button
                              key={reason}
                              type="button"
                              aria-pressed={active.appelNonAboutiRaison === reason}
                              onClick={() =>
                                patchActive({
                                  appelNonAboutiRaison: active.appelNonAboutiRaison === reason ? "" : reason
                                })
                              }
                            >
                              {reason}
                            </button>
                          ))}
                        </fieldset>
                      )}
                      <div className={styles.fieldWrapper} data-excluded={activeExcluded.includes("celluleMaison")}>
                        <label className={styles.field}>
                          <span>
                            <span>Cellule de maison</span>
                            <button
                              type="button"
                              className={styles.fieldExcludeBtn}
                              onClick={() => toggleFieldForActive("celluleMaison")}
                              title={
                                activeExcluded.includes("celluleMaison")
                                  ? "Ajouter « Cellule de maison » au rapport"
                                  : "Ne pas ajouter « Cellule de maison » au rapport"
                              }
                            >
                              {activeExcluded.includes("celluleMaison") ? (
                                <>
                                  <EyeOff size={13} aria-hidden="true" />
                                  <span className={styles.excludedBadge}>Non inclus</span>
                                </>
                              ) : (
                                <Eye size={13} aria-hidden="true" />
                              )}
                            </button>
                          </span>
                          <input
                            value={active.celluleMaison}
                            disabled={activeExcluded.includes("celluleMaison")}
                            onChange={event => patchActive({ celluleMaison: event.target.value })}
                            placeholder="Nom de la cellule ou prochaine étape…"
                          />
                        </label>
                        {!activeExcluded.includes("celluleMaison") && (
                          <div className={styles.quickChoices} role="group" aria-label="Réponses rapides pour la cellule">
                            {["Intéressé(e) / à orienter", "Orientation en cours", "Intégré(e)"].map(value => (
                              <button key={value} type="button" onClick={() => patchActive({ celluleMaison: value })}>
                                {value}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <label className={styles.field}><span>Note pour l’équipe <small>facultatif</small></span><textarea rows={3} value={active.commentaire} onChange={event => patchActive({ commentaire: event.target.value })} placeholder="Un point utile ou la prochaine action…" /><small>Incluse seulement dans la version « Avec les notes ».</small></label>
                    </div>
                  ) : (
                    <>
                      <div className={styles.callSummary} data-status={activeExcluded.includes("appelAbouti") ? "excluded" : active.appelAbouti === true ? "yes" : active.appelAbouti === false ? "no" : "unknown"}>
                        {active.appelAbouti === false ? <PhoneMissed size={19} aria-hidden="true" /> : <PhoneCall size={19} aria-hidden="true" />}
                        <div>
                          <strong>{activeExcluded.includes("appelAbouti") ? "Appel : Non inclus au rapport" : active.appelAbouti === true ? "L’appel a abouti" : active.appelAbouti === false ? "Appel non abouti" : "Appel à préciser"}</strong>
                          <span>{activeExcluded.includes("appelAbouti") ? "Ce champ ne sera pas mentionné dans le message WhatsApp" : active.appelAbouti === false && active.appelNonAboutiRaison ? active.appelNonAboutiRaison : active.arrivalDate ? "Accueil du " + formatCrDate(active.arrivalDate) : "Suivi prérempli depuis la fiche"}</span>
                        </div>
                      </div>
                      <dl className={styles.facts}>
                        {STATUS_FIELDS.slice(1).map(([key, label]) => {
                          const isExcluded = activeExcluded.includes(key);
                          return (
                            <div key={key} data-excluded={isExcluded}>
                              <dt>
                                <span>{label}</span>
                                {isExcluded && <span className={styles.excludedDot}>Non inclus</span>}
                              </dt>
                              <dd data-value={isExcluded ? "excluded" : String(active[key])}>
                                {isExcluded ? (
                                  <span className={styles.mutedExcluded}>Masqué du CR</span>
                                ) : (
                                  <>
                                    {active[key] === true && <Check size={12} aria-hidden="true" />}
                                    {statusLabel(active[key])}
                                  </>
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      <div className={styles.cellSummary} data-excluded={activeExcluded.includes("celluleMaison")}>
                        <span>
                          Cellule de maison
                          {activeExcluded.includes("celluleMaison") && <small className={styles.excludedDot}>Non inclus</small>}
                        </span>
                        <strong>{activeExcluded.includes("celluleMaison") ? "Masqué du rapport" : active.celluleMaison || "À préciser"}</strong>
                      </div>
                      <div className={styles.noteSummary}><span>Note pour l’équipe</span>{active.commentaire ? <p>{active.commentaire}</p> : <button type="button" onClick={() => setEditing(true)}><Plus size={14} aria-hidden="true" /> Ajouter une note</button>}</div>
                    </>
                  )}
                </article>
                {selectedItems.length > 1 && <div className={styles.personNavigation}><span>Personne {activeIndex + 1} sur {selectedItems.length}</span><div><button type="button" className={styles.iconButton} disabled={!activeIndex} aria-label="Personne précédente" onClick={() => switchPerson(selectedIds[activeIndex - 1])}><ChevronLeft size={17} /></button><button type="button" className={styles.iconButton} disabled={activeIndex === selectedIds.length - 1} aria-label="Personne suivante" onClick={() => switchPerson(selectedIds[activeIndex + 1])}><ChevronRight size={17} /></button></div></div>}
                <p className={styles.localNote}><Pencil size={13} aria-hidden="true" /> Les ajustements modifient ce message uniquement.</p>
              </>
            )}
            {step === 2 && (
              <>
                <div className={styles.sectionIntro}><span className={styles.kicker}>03 · LE PARTAGE</span><h2 ref={headingRef} tabIndex={-1}>Votre CR est prêt.</h2><p>Choisissez la version adaptée à votre conversation.</p></div>
                <div className={styles.readyCard}><span><CheckCheck size={23} aria-hidden="true" /></span><div><strong>{selectedItems.length} personne{selectedItems.length > 1 ? "s" : ""}, un seul message</strong><p>{selectedItems.map(item => item.name).join(", ")}</p></div><button type="button" onClick={() => goTo(0)} aria-label="Modifier les personnes incluses"><Pencil size={15} /></button></div>
                <div className={styles.formatOptions} role="group" aria-label="Version du message">
                  <button type="button" aria-pressed={audience === "group"} onClick={() => setAudience("group")}><span className={styles.formatTop}><MessageCircle size={19} aria-hidden="true" /><span className={styles.radioMark}>{audience === "group" && <span />}</span></span><strong>L’essentiel</strong><span>Le suivi, sans les notes.</span><small>Pour votre groupe WhatsApp</small></button>
                  <button type="button" aria-pressed={audience === "team"} onClick={() => setAudience("team")}><span className={styles.formatTop}><FileText size={19} aria-hidden="true" /><span className={styles.radioMark}>{audience === "team" && <span />}</span></span><strong>Avec les notes</strong><span>Le suivi et les commentaires.</span><small>Pour l’équipe de suivi</small></button>
                </div>
                {(() => {
                  const peopleWithExclusions = selectedItems.filter(
                    item => item.excludedFields && item.excludedFields.length > 0
                  );
                  if (!peopleWithExclusions.length) return null;
                  return (
                    <div className={styles.excludedNotice}>
                      <div className={styles.excludedNoticeHeader}>
                        <EyeOff size={15} aria-hidden="true" />
                        <span>
                          {peopleWithExclusions.length === 1 ? (
                            <>
                              Champs retirés pour <strong>{peopleWithExclusions[0].name}</strong> (
                              {peopleWithExclusions[0].excludedFields?.map(k => ALL_REPORT_FIELDS.find(f => f.key === k)?.short || k).join(", ")}
                              )
                            </>
                          ) : (
                            <>
                              <strong>{peopleWithExclusions.length} personnes</strong> ont des champs retirés de leur rapport
                            </>
                          )}
                        </span>
                        <button type="button" onClick={resetAllPeopleExclusions}>
                          Tout inclure
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <CrReportDatePicker value={reportDate} onChange={value => { setReportDate(value); setDateEdited(true); }} />
                {arrivalDates.length > 1 && <p className={styles.dateNotice}>Ces personnes ont été accueillies à des dates différentes. Le titre du CR indiquera le {formatCrDate(reportDate)} ; ajustez cette date si nécessaire.</p>}
                <p className={styles.shareExplanation}>Dans WhatsApp, choisissez la conversation puis appuyez sur Envoyer.</p>
                {manualCopy && <label className={styles.field}><span>Copier le message manuellement</span><textarea ref={manualCopyRef} readOnly rows={6} value={fullMessage} /></label>}
              </>
            )}
          </div>
          <aside className={styles.previewPane}><CrMessagePreview message={fullMessage} count={selectedItems.length} /></aside>
        </div>
        <footer className={styles.footer}>
          <div role="status" aria-live="polite" className={styles.feedback} data-error={visibleFeedback?.error} hidden={!visibleFeedback}>{visibleFeedback?.text}</div>
          <div className={styles.footerRow}>
            {step > 0 ? <button type="button" className={styles.backButton} onClick={() => goTo((step - 1) as Step)}><ArrowLeft size={16} aria-hidden="true" /><span>Retour</span></button> : <span className={styles.footerCount}>{selectedIds.length ? selectedIds.length + " sélectionnée" + (selectedIds.length > 1 ? "s" : "") : "Choisissez au moins une personne"}</span>}
            <div className={styles.footerMain}>
              {step === 2 ? (
                <>
                  <button type="button" className={styles.copyButton} onClick={copyMessage} disabled={copying}><Copy size={17} aria-hidden="true" /><span>{copying ? "Copie…" : visibleFeedback && !visibleFeedback.error && visibleFeedback.text.startsWith("Message copié") ? "Copié !" : "Copier"}</span></button>
                  <a className={styles.whatsappButton} href={buildWhatsAppShareUrl(fullMessage)} target="_blank" rel="noopener noreferrer" onClick={() => setFeedback({ message: fullMessage, text: "Le message est préparé. Terminez l’envoi dans WhatsApp." })}><MessageCircle size={18} aria-hidden="true" /><span>Ouvrir WhatsApp</span><ArrowRight size={16} aria-hidden="true" /></a>
                </>
              ) : <button type="button" className={styles.primaryButton} disabled={!selectedIds.length} onClick={() => goTo((step + 1) as Step)}>{step === 0 ? "Relire le suivi" : "Voir le message"}<ArrowRight size={17} aria-hidden="true" /></button>}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
export default function CounselorCrWhatsAppModal({ isOpen, ...props }: Props) {
  if (!isOpen || typeof document === "undefined") return null;
  return createPortal(<CrComposer key={props.initialGuest?.id || "group"} {...props} />, document.body);
}
