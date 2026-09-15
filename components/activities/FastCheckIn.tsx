"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronRight, Circle, ClipboardCheck, CloudCheck, LoaderCircle, Search, ShieldCheck, Undo2, UserRoundX, Users, X, Zap } from "lucide-react";
import { AttendanceMap, getAttendanceStatus, QuickAttendanceStatus } from "@/lib/attendance";
import styles from "./FastCheckIn.module.css";

export interface FastCheckInMember {
  id: string;
  firstName: string;
  lastName: string;
  civility: string;
  attendance: AttendanceMap;
}

interface FastCheckInProps {
  activity: { id: string; name: string };
  date: string;
  members: FastCheckInMember[];
  onClose: () => void;
  onChange: (memberId: string, status: QuickAttendanceStatus, reason?: string, service?: string) => Promise<void>;
}

type Filter = "unpointed" | "present" | "absent" | "all";
type Entry = { member: FastCheckInMember; status: QuickAttendanceStatus; reason: string; service?: string };
type Change = { memberId: string; status: QuickAttendanceStatus; reason?: string; service?: string };
type Receipt = { name: string; status: QuickAttendanceStatus; previous: Change };

const REASONS = ["Maladie", "Travail", "Voyage", "Famille"];
const SERVICES = [{ id: "culte_1", label: "Culte 1" }, { id: "culte_2", label: "Culte 2" }, { id: "culte_en_ligne", label: "En ligne" }];
const STATUS_LABELS = { unpointed: "À pointer", present: "Présent", justified: "Absence justifiée", unjustified: "Absence non justifiée" };
const FILTERS: { id: Filter; label: string }[] = [{ id: "unpointed", label: "À pointer" }, { id: "present", label: "Présents" }, { id: "absent", label: "Absents" }, { id: "all", label: "Tous" }];
const label = (member: FastCheckInMember) => `${member.firstName} ${member.lastName}`.trim();
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();

function ServicePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <div className={styles.services} role="group" aria-label="Choisir le culte">
    {SERVICES.map(item => <button type="button" key={item.id} aria-pressed={value === item.id} onClick={() => onChange(item.id)} disabled={disabled}>{item.label}</button>)}
  </div>;
}

/** A native modal provides focus containment, Escape handling and focus restoration. */
function MemberEditor({ entry, initialStatus, isCulte, defaultService, saving, error, onSave, onClose }: {
  entry: Entry; initialStatus: QuickAttendanceStatus; isCulte: boolean; defaultService: string;
  saving: boolean; error: string; onSave: (change: Change) => Promise<boolean>; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(entry.reason);
  const [service, setService] = useState(entry.service || defaultService);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("h2")?.focus();
    return () => dialog?.close();
  }, []);
  const valid = status !== "justified" || Boolean(reason.trim());

  return <dialog ref={dialogRef} className={`${styles.editor} ${styles.surface}`} aria-labelledby="checkin-editor-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!saving) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (valid && !saving) void onSave({ memberId: entry.member.id, status, reason: status === "justified" ? reason.trim() : "", service: status === "present" && isCulte ? service : undefined }); }}>
      <div className={styles.editorHeader}>
        <span className={styles.eyebrow}>Fiche de pointage</span>
        <button type="button" className={styles.iconButton} aria-label="Fermer la fiche" onClick={onClose} disabled={saving} autoFocus><X size={20} /></button>
      </div>
      <h2 id="checkin-editor-title" tabIndex={-1}>{label(entry.member)}</h2>
      <p className={styles.editorSubtitle}>Choisissez le statut à enregistrer.</p>
      <div className={styles.statusChoices} role="group" aria-label="Statut du membre">
        {(["present", "justified", "unjustified"] as const).map(value => <button type="button" key={value} aria-pressed={status === value} disabled={saving} onClick={() => setStatus(value)}>
          {value === "present" ? <CheckCircle2 size={19} /> : value === "justified" ? <ShieldCheck size={19} /> : <UserRoundX size={19} />}
          <span>{STATUS_LABELS[value]}</span>{status === value && <Check size={17} />}
        </button>)}
      </div>
      {status === "present" && isCulte && <div className={styles.editorField}><span>Culte de présence</span><ServicePicker value={service} onChange={setService} disabled={saving} /></div>}
      {status === "justified" && <div className={styles.editorField}>
        <label htmlFor="checkin-reason">Motif de l’absence <span className={styles.muted}>(requis)</span></label>
        <div className={styles.reasons}>{REASONS.map(item => <button key={item} type="button" aria-pressed={reason === item} onClick={() => setReason(item)} disabled={saving}>{item}</button>)}</div>
        <input id="checkin-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Ou précisez un autre motif…" maxLength={300} required disabled={saving} />
      </div>}
      {status === "unjustified" && <p className={styles.editorNote}>Aucun motif ne sera associé à cette absence.</p>}
      {status === "unpointed" && <p className={styles.editorNote}>Ce membre reviendra dans la liste « À pointer ».</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.editorActions}>
        <button className={styles.primaryButton} disabled={!valid || saving} type="submit">{saving ? <LoaderCircle className={styles.spin} size={18} /> : <Check size={18} />}{saving ? "Enregistrement…" : "Enregistrer le statut"}</button>
        {entry.status !== "unpointed" && <button type="button" className={styles.textButton} disabled={saving} onClick={() => setStatus("unpointed")}><Undo2 size={15} />Remettre à « À pointer »</button>}
        <button type="button" className={styles.textButton} disabled={saving} onClick={onClose}>Annuler</button>
      </div>
    </form>
  </dialog>;
}

export default function FastCheckIn({ activity, date, members, onClose, onChange }: FastCheckInProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("unpointed");
  const [summary, setSummary] = useState(false);
  const [service, setService] = useState("culte_1");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ entry: Entry; status: QuickAttendanceStatus } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<{ change: Change; undo: boolean; message: string } | null>(null);
  const isCulte = activity.id === "culte" || activity.name.toLocaleLowerCase("fr").includes("culte");
  const saving = savingId !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("h1")?.focus();
    const beforeUnload = (event: BeforeUnloadEvent) => { if (busyRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  const rows = useMemo<Entry[]>(() => members.map(member => {
    const value = member.attendance?.[activity.id]?.[date];
    return { member, status: getAttendanceStatus(member.attendance, activity.id, date), reason: member.attendance?._comments?.[activity.id]?.[date] || "", service: isCulte ? (typeof value === "string" ? value : value === true ? "culte_1" : undefined) : undefined };
  }).sort((a, b) => label(a.member).localeCompare(label(b.member), "fr", { sensitivity: "base" })), [members, activity.id, date, isCulte]);
  const counts = useMemo(() => rows.reduce((result, row) => { result[row.status]++; return result; }, { unpointed: 0, present: 0, justified: 0, unjustified: 0 }), [rows]);
  const pointed = members.length - counts.unpointed;
  const percent = members.length ? Math.round(pointed / members.length * 100) : 0;
  const complete = members.length > 0 && counts.unpointed === 0;
  const filterCounts = { unpointed: counts.unpointed, present: counts.present, absent: counts.justified + counts.unjustified, all: members.length };
  const visibleRows = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    return rows.filter(row => words.every(word => normalize(label(row.member)).includes(word)) && (filter === "all" || (filter === "absent" ? row.status === "justified" || row.status === "unjustified" : row.status === filter)));
  }, [rows, search, filter]);

  const changeFilter = (next: Filter) => { setFilter(next); setSummary(false); setSearch(""); scrollRef.current?.scrollTo({ top: 0 }); };
  const openEditor = (entry: Entry, status: QuickAttendanceStatus) => { setFailure(null); setEditor({ entry, status }); };

  const save = async (change: Change, undo = false): Promise<boolean> => {
    if (busyRef.current) return false;
    const previous = rows.find(row => row.member.id === change.memberId);
    if (!previous) return false;
    busyRef.current = true;
    setSavingId(change.memberId);
    setFailure(null);
    setNotice("");
    const focused = document.activeElement;
    try {
      await onChange(change.memberId, change.status, change.reason, change.service);
      setEditor(null);
      if (undo) { setReceipt(null); setNotice(`Dernière action annulée pour ${label(previous.member)}.`); }
      else setReceipt({ name: label(previous.member), status: change.status, previous: { memberId: previous.member.id, status: previous.status, reason: previous.reason, service: previous.service } });
      // When a filtered row disappears, keep keyboard users inside the working area.
      requestAnimationFrame(() => { if (focused instanceof HTMLElement && !focused.isConnected) searchRef.current?.focus({ preventScroll: true }); });
      return true;
    } catch {
      setFailure({ change, undo, message: "Le statut n’a pas été enregistré. Vérifiez votre connexion, puis réessayez." });
      return false;
    } finally { busyRef.current = false; setSavingId(null); }
  };

  return <dialog ref={dialogRef} className={`${styles.dialog} ${styles.surface}`} aria-labelledby="fast-checkin-title" onCancel={event => { event.preventDefault(); if (!busyRef.current) onClose(); }}>
    <header className={styles.header}>
      <div className={styles.brand}><span className={styles.brandIcon}><Zap size={19} /></span><div><span className={styles.eyebrow}>POIMÉN · PRÉSENCES</span><h1 id="fast-checkin-title" tabIndex={-1}>Pointage rapide</h1></div></div>
      <button type="button" className={styles.closeButton} aria-label="Fermer" onClick={onClose} disabled={saving} autoFocus><span>Fermer</span><X size={19} /></button>
    </header>

    <div className={styles.workspace}>
      <aside className={styles.context} aria-label="Séance et progression">
        <div className={styles.session}>
          <span className={styles.eyebrow}>VOTRE SÉANCE</span>
          <h2>{activity.name}</h2>
          <p className={styles.date}><CalendarDays size={15} /><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</time></p>
        </div>
        {isCulte && !summary && <div className={styles.serviceField}><span>Pointer les présences pour</span><ServicePicker value={service} onChange={setService} disabled={saving} /></div>}
        <div className={styles.progressBlock}>
          <div className={styles.progressHeading}><span>{complete ? <><CheckCheck size={16} /> Pointage complet</> : "Progression du pointage"}</span><strong>{percent}<small>%</small></strong></div>
          <div className={styles.progressTrack} role="progressbar" aria-label="Membres pointés" aria-valuenow={pointed} aria-valuemin={0} aria-valuemax={members.length || 1}><span style={{ width: `${percent}%` }} /></div>
          <p>{pointed} sur {members.length} {members.length > 1 ? "membres pointés" : "membre pointé"}<span>{counts.unpointed} à pointer</span></p>
        </div>
        <div className={styles.overview}>
          <span className={styles.eyebrow}>EN UN COUP D’ŒIL</span>
          <button type="button" onClick={() => changeFilter("present")}><span className={styles.green}><CheckCircle2 size={18} /></span><span>Présents</span><strong>{counts.present}</strong><ChevronRight size={15} /></button>
          <button type="button" onClick={() => changeFilter("absent")}><span className={styles.amber}><ShieldCheck size={18} /></span><span>Absences justifiées</span><strong>{counts.justified}</strong><ChevronRight size={15} /></button>
          <button type="button" onClick={() => changeFilter("absent")}><span className={styles.muted}><UserRoundX size={18} /></span><span>Non justifiées</span><strong>{counts.unjustified}</strong><ChevronRight size={15} /></button>
        </div>
      </aside>

      <section className={styles.workArea} aria-label={summary ? "Bilan du pointage" : "Liste des membres"}>
        {summary ? <div className={styles.summary}>
          <button type="button" className={styles.textButton} onClick={() => setSummary(false)}><ArrowLeft size={17} />Retour à la liste</button>
          <div className={styles.summaryHero}><span className={styles.summaryIcon}>{complete ? <CheckCheck size={32} /> : <ClipboardCheck size={32} />}</span><span className={styles.eyebrow}>BILAN DE LA SÉANCE</span><h2>{complete ? "Tout le monde est pointé." : members.length ? "Un dernier coup d’œil." : "Aucun membre à pointer."}</h2><p>{complete ? "Les présences et les absences sont enregistrées. Vous pouvez quitter sereinement." : members.length ? `${counts.unpointed} ${counts.unpointed > 1 ? "membres restent" : "membre reste"} à pointer. Vous pouvez continuer maintenant ou reprendre plus tard.` : "Les membres de votre groupe apparaîtront ici."}</p></div>
          <div className={styles.summaryGrid}>
            {[{ value: counts.present, text: "Présents", filter: "present", icon: <CheckCircle2 />, color: styles.green }, { value: counts.justified, text: "Absences justifiées", filter: "absent", icon: <ShieldCheck />, color: styles.amber }, { value: counts.unjustified, text: "Non justifiées", filter: "absent", icon: <UserRoundX />, color: styles.muted }, { value: counts.unpointed, text: "À pointer", filter: "unpointed", icon: <Circle />, color: styles.muted }].map(item => <button key={item.text} type="button" onClick={() => changeFilter(item.filter as Filter)}><span className={item.color}>{item.icon}</span><strong>{item.value}</strong><span>{item.text}</span><ChevronRight size={16} /></button>)}
          </div>
          {counts.unpointed > 0 && <button className={styles.textButton} type="button" onClick={onClose} disabled={saving}>Fermer et reprendre plus tard</button>}
        </div> : <>
          <div className={styles.listTools}>
            <div className={styles.listHeading}><div><h2>Qui est présent ?</h2><p>Un clic pour une présence. Un motif pour une absence.</p></div><span className={styles.total}><Users size={15} />{members.length}</span></div>
            <div className={styles.search}><Search size={20} /><input ref={searchRef} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un membre…" aria-label="Rechercher un membre" autoComplete="off" />{search && <button type="button" className={styles.iconButton} aria-label="Effacer la recherche" onClick={() => { setSearch(""); searchRef.current?.focus(); }}><X size={17} /></button>}</div>
            <div className={styles.filters} role="group" aria-label="Filtrer les membres">{FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); scrollRef.current?.scrollTo({ top: 0 }); }}>{item.label}<span>{filterCounts[item.id]}</span></button>)}</div>
          </div>
          <div ref={scrollRef} className={styles.memberList}>
            <div className={styles.listCaption}><span>{search.trim() ? "RÉSULTATS DE RECHERCHE" : filter === "unpointed" ? "EN ATTENTE DE POINTAGE" : FILTERS.find(item => item.id === filter)?.label.toLocaleUpperCase("fr")}</span><span aria-live="polite">{visibleRows.length} {visibleRows.length > 1 ? "membres" : "membre"}</span></div>
            {visibleRows.map(entry => <article key={entry.member.id} className={styles.member} aria-label={label(entry.member)} aria-busy={savingId === entry.member.id}>
              <span className={styles.avatar} aria-hidden="true">{entry.member.firstName[0]}{entry.member.lastName[0]}</span>
              <div className={styles.memberInfo}><h3>{label(entry.member)}</h3><p className={entry.status === "present" ? styles.green : entry.status === "justified" ? styles.amber : styles.muted}>{entry.status === "present" && <Check size={13} />}{STATUS_LABELS[entry.status]}{entry.status === "present" && entry.service ? ` · ${SERVICES.find(item => item.id === entry.service)?.label || entry.service}` : entry.status === "justified" && entry.reason ? ` · ${entry.reason}` : ""}</p></div>
              <div className={styles.memberActions}>{entry.status === "unpointed" ? <>
                <button type="button" className={styles.presentButton} disabled={saving} aria-label={`Marquer ${label(entry.member)} présent`} onClick={() => void save({ memberId: entry.member.id, status: "present", service: isCulte ? service : undefined })}>{savingId === entry.member.id ? <LoaderCircle className={styles.spin} size={17} /> : <Check size={17} />}<span>Présent</span></button>
                <button type="button" className={styles.absentButton} disabled={saving} aria-label={`Signaler une absence pour ${label(entry.member)}`} onClick={() => openEditor(entry, "unjustified")}>Absence</button>
              </> : <button type="button" className={styles.editButton} disabled={saving} aria-label={`Modifier le statut de ${label(entry.member)}`} onClick={() => openEditor(entry, entry.status)}>{savingId === entry.member.id ? <LoaderCircle className={styles.spin} size={16} /> : "Modifier"}<ChevronRight size={15} /></button>}</div>
            </article>)}
            {visibleRows.length === 0 && <div className={styles.empty}><span>{search.trim() ? <Search size={29} /> : filter === "unpointed" && complete ? <CheckCheck size={29} /> : <Users size={29} />}</span><h3>{search.trim() ? "Aucun membre trouvé" : !members.length ? "Votre liste est encore vide" : filter === "unpointed" ? "Tout le monde est pointé" : "Aucun membre dans cette liste"}</h3><p>{search.trim() ? "Essayez un autre prénom ou nom, ou cherchez dans tous les membres." : !members.length ? "Les membres de votre groupe apparaîtront ici." : filter === "unpointed" ? "Vous pouvez consulter le bilan ou corriger un statut." : "Les statuts enregistrés apparaîtront ici."}</p>{search.trim() ? <button type="button" className={styles.textButton} onClick={() => { setFilter("all"); setSearch(""); searchRef.current?.focus(); }}>Afficher tous les membres<ArrowRight size={16} /></button> : complete && <button type="button" className={styles.textButton} onClick={() => setSummary(true)}>Voir le bilan<ArrowRight size={16} /></button>}</div>}
          </div>
        </>}
      </section>
    </div>

    <footer className={styles.footer}>
      {failure && !editor ? <div className={styles.footerError} role="alert"><span>{failure.message}</span><button type="button" disabled={saving} onClick={() => void save(failure.change, failure.undo)}>Réessayer</button></div> : <div className={styles.saveState}>
        <span className={styles.saveIcon}>{saving ? <LoaderCircle className={styles.spin} size={19} /> : <CloudCheck size={19} />}</span>
        <div role="status" aria-live="polite"><strong>{saving ? "Enregistrement en cours…" : receipt ? `${receipt.name} · ${STATUS_LABELS[receipt.status]}` : notice || "Enregistrement automatique"}</strong><span>{saving ? "Un instant, votre statut est en cours de sauvegarde." : receipt ? "Le statut a bien été enregistré." : "Vous pouvez fermer et reprendre à tout moment."}</span></div>
        {receipt && !saving && <button type="button" className={styles.undoButton} onClick={() => void save(receipt.previous, true)}><Undo2 size={16} />Annuler<span className={styles.srOnly}> la dernière action</span></button>}
      </div>}
      <button type="button" className={styles.primaryButton} disabled={saving} onClick={() => summary ? counts.unpointed > 0 ? changeFilter("unpointed") : onClose() : setSummary(true)}>{summary ? counts.unpointed > 0 ? "Continuer le pointage" : complete ? "Terminer le pointage" : "Fermer" : "Voir le bilan"}{summary && complete ? <Check size={17} /> : <ArrowRight size={17} />}</button>
    </footer>
    {editor && <MemberEditor entry={editor.entry} initialStatus={editor.status} isCulte={isCulte} defaultService={service} saving={saving} error={failure?.message || ""} onSave={save} onClose={() => { if (!busyRef.current) { setEditor(null); setFailure(null); } }} />}
  </dialog>;
}
