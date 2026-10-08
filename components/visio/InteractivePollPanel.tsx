"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Award, BarChart3, Check, CheckCircle2, ChevronLeft, Clock3, Copy, Download, Eye, EyeOff, HelpCircle, History, ListOrdered, Loader2, LockKeyhole, MessageSquare, Pencil, Play, Plus, RefreshCw, Send, Trash2, Users, X } from "lucide-react";
import { validateDraft } from "@/lib/poll-engine";
import type { PollCommand, PollDraft, PollSnapshot, PollType, PollView } from "@/types/visio-poll";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./InteractivePollPanel.module.css";

type Props = { roomName: string; isHost?: boolean; userName?: string; onClose?: () => void };
const labels: Record<PollType, string> = { poll: "Sondage", quiz: "Quiz", open: "Question libre" };
const icons = { poll: BarChart3, quiz: HelpCircle, open: MessageSquare };
function freshDraft(): PollDraft {
  return { type: "poll", question: "", options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }], explanation: "", durationSeconds: 0 };
}

export default function InteractivePollPanel(props: Props) {
  // Room changes reset requests, draft and selection as one unit.
  return <PollPanel key={`${props.roomName}:${props.isHost}`} {...props} />;
}

function PollPanel({ roomName, isHost = false, userName = "Participant", onClose }: Props) {
  const { notify, confirm } = useFeedback();
  const [data, setData] = useState<PollSnapshot | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"live" | "drafts" | "history">("live");
  const [draft, setDraft] = useState<PollDraft | null>(null);
  const [preview, setPreview] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const [receivedAt, setReceivedAt] = useState(0);
  const endpoint = `/api/visio/polls?room=${encodeURIComponent(roomName)}${isHost ? "&manage=1" : ""}`;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (busyRef.current) return;
    const id = ++requestId.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Synchronisation indisponible.");
      if (mounted.current && id === requestId.current) {
        setReceivedAt(Date.now()); setData(body); setError("");
      }
    } catch (cause) {
      if (mounted.current && id === requestId.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : "Connexion interrompue.");
    }
  }, [endpoint]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const initial = requestAnimationFrame(() => { void load(controller.signal); });
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const interval = setInterval(refresh, 5000);
    const clock = setInterval(() => setTick(Date.now()), 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; controller.abort(); cancelAnimationFrame(initial); clearInterval(interval); clearInterval(clock); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const send = useCallback(async (command: PollCommand, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); requestId.current++;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "La réponse n’a pas pu être enregistrée.");
      if (mounted.current) { setReceivedAt(Date.now()); setData(body); setError(""); notify(success); }
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Enregistrement indisponible. Réessayez.");
      return false;
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }, [endpoint, notify]);

  const drafts = data?.polls.filter(poll => poll.status === "draft") || [];
  const history = data?.polls.filter(poll => poll.status === "closed").sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)) || [];
  const live = data?.polls.find(poll => poll.status === "open") || history[0];
  const selected = tab === "history" ? history.find(poll => poll.id === historyId) : live;
  const canDesign = isHost && (!data || data.canManage);
  const serverNow = data ? data.serverTime + Math.max(0, tick - receivedAt) : 0;
  const edit = (poll?: PollView) => { setDraft(poll ? { id: poll.id, type: poll.type, question: poll.question, options: poll.options.map(option => ({ ...option })), correctOptionId: poll.correctOptionId, explanation: poll.explanation, durationSeconds: poll.durationSeconds } : freshDraft()); setPreview(false); };
  const save = async () => {
    if (!draft) return;
    try { validateDraft(draft); } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Vérifiez la question."); return; }
    setFormError("");
    if (await send({ action: "save", draft }, "Question enregistrée dans la file.")) { setDraft(null); setTab("drafts"); }
  };
  const launch = async (poll: PollView) => {
    if (data?.polls.some(item => item.status === "open") && !await confirm("Lancer cette question clôturera les votes de la question actuelle. Continuer ?")) return;
    if (await send({ action: poll.status === "draft" ? "launch" : "reopen", pollId: poll.id }, "Les participants peuvent répondre.")) { setTab("live"); setHistoryId(null); }
  };

  return <section className={styles.panel} aria-label="Sondages et quiz">
    <header className={styles.header}>
      <span className={styles.headerIcon}><BarChart3 size={20} /></span>
      <div><h3>Sondages & quiz</h3><p>{data?.canManage ? "Animez les échanges, une question à la fois." : "Votre avis compte."}</p></div>
      {onClose && <button type="button" className={styles.iconButton} aria-label="Fermer les sondages" onClick={onClose}><X size={20} /></button>}
    </header>
    <div className={styles.connection} role="status"><span className={error ? styles.offlineDot : styles.onlineDot} />{error ? "Synchronisation interrompue" : data ? "Réponses synchronisées automatiquement" : "Connexion aux sondages…"}{busy && <Loader2 size={14} className={styles.spin} />}</div>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Réessayer</button></div>}
    {canDesign && !draft && <nav className={styles.tabs} aria-label="Vues des sondages">{([
      ["live", "En direct", BarChart3, undefined], ["drafts", "À préparer", ListOrdered, drafts.length], ["history", "Historique", History, history.length],
    ] as const).map(([value, label, Icon, count]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { setTab(value); setHistoryId(null); }}><Icon size={16} /><span>{label}</span>{count !== undefined && <small>{count}</small>}</button>)}</nav>}
    <div className={styles.content}>
      {draft ? <>
        <div className={styles.sectionTitle}><button type="button" className={styles.textButton} onClick={async () => { if (!draft.question && draft.options.every(option => !option.text) || await confirm("Fermer cette question sans enregistrer les modifications ?")) setDraft(null); }}><ChevronLeft size={16} /> Retour</button><span>{draft.id ? "Modifier la question" : "Nouvelle question"}</span></div>
        <PollComposer draft={draft} onChange={value => { setDraft(value); setFormError(""); }} preview={preview} setPreview={setPreview} />
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        <div className={styles.stickyActions}><button type="button" className={styles.primary} disabled={busy || !data?.canManage} onClick={() => void save()}>{busy ? <Loader2 size={17} className={styles.spin} /> : <Check size={17} />} Enregistrer la question</button><p>Enregistrée pour plus tard. Vous choisissez quand la lancer.</p></div>
      </> : <>
        {canDesign && <div className={styles.listActions}><button type="button" className={styles.primary} onClick={() => edit()}><Plus size={17} /> Préparer une question</button>{tab === "history" && history.length > 0 && <a className={styles.secondary} href={`${endpoint}&format=csv`} download={`sondages-${roomName}.csv`}><Download size={16} /> Exporter CSV</a>}</div>}
        {tab === "drafts" && canDesign ? <>
          <p className={styles.help}>Préparez la série avant votre réunion. Lancer une nouvelle question clôture la précédente, sans effacer ses résultats.</p>
          {!drafts.length && <Empty icon="drafts" title="Votre prochaine question commence ici" text="Disponibilités, quiz biblique ou retour sur le culte : préparez vos questions à votre rythme." />}
          {drafts.map((poll, index) => <article key={poll.id} className={styles.queueCard}><small>QUESTION {index + 1} · {labels[poll.type]}{poll.durationSeconds ? ` · ${poll.durationSeconds / 60 < 1 ? "30 s" : `${poll.durationSeconds / 60} min`}` : ""}</small><h4>{poll.question}</h4><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy} onClick={() => void launch(poll)}><Play size={15} /> Lancer</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => edit(poll)}><Pencil size={15} /> Modifier</button><button type="button" className={styles.iconButton} disabled={busy} aria-label={`Dupliquer : ${poll.question}`} onClick={() => void send({ action: "duplicate", pollId: poll.id }, "Copie ajoutée à la file.")}><Copy size={17} /></button><button type="button" className={styles.iconButton} disabled={busy} aria-label={`Supprimer le brouillon : ${poll.question}`} onClick={async () => { if (await confirm("Supprimer ce brouillon ? Les questions déjà lancées restent dans l’historique.")) await send({ action: "remove", pollId: poll.id }, "Brouillon supprimé."); }}><Trash2 size={17} /></button></div></article>)}
        </> : tab === "history" && canDesign && !selected ? <>
          {!history.length && <Empty icon="history" title="Les échanges restent disponibles" text="Les questions clôturées et leurs réponses apparaîtront ici." />}
          {history.map(poll => <button key={poll.id} type="button" className={styles.historyCard} onClick={() => setHistoryId(poll.id)}><span>{labels[poll.type]} · {new Date(poll.startedAt || poll.createdAt).toLocaleDateString("fr-FR")}</span><strong>{poll.question}</strong><small><Users size={14} /> {poll.totalVotes} réponse{poll.totalVotes !== 1 ? "s" : ""} · Voir les résultats</small></button>)}
        </> : selected ? <>
          {tab === "history" && <button type="button" className={styles.textButton} onClick={() => setHistoryId(null)}><ChevronLeft size={16} /> Toutes les questions</button>}
          <PollQuestion key={selected.id} poll={selected} canManage={Boolean(data?.canManage)} now={serverNow} busy={busy} userName={userName} send={send} />
          {data?.canManage && <div className={styles.hostControls}><p className={styles.eyebrow}>COMMANDES DE L’ANIMATEUR</p><div className={styles.actions}>
            {selected.status === "open" ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "close", pollId: selected.id }, "Les votes sont clôturés.")}><LockKeyhole size={16} /> Clôturer</button> : <button type="button" className={styles.secondary} disabled={busy} onClick={() => void launch(selected)}><Play size={16} /> Rouvrir les votes</button>}
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "results", pollId: selected.id }, selected.revealResults ? "Résultats masqués." : "Résultats publiés.")}>{selected.revealResults ? <EyeOff size={16} /> : <Eye size={16} />}{selected.revealResults ? "Masquer les résultats" : "Publier les résultats"}</button>
            {selected.type === "quiz" && <button type="button" className={styles.secondary} disabled={busy || selected.status !== "closed"} title={selected.status === "open" ? "Clôturez les votes avant de révéler la réponse" : undefined} onClick={() => void send({ action: "answer", pollId: selected.id }, selected.revealAnswer ? "Correction masquée." : "Correction révélée.")}><Award size={16} />{selected.revealAnswer ? "Masquer la correction" : "Révéler la correction"}</button>}
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "duplicate", pollId: selected.id }, "Copie ajoutée à la file.")}><Copy size={16} /> Dupliquer</button>
            {drafts[0] && <button type="button" className={styles.primary} disabled={busy} onClick={() => void launch(drafts[0])}><Play size={16} /> Question suivante</button>}
          </div></div>}
        </> : <Empty icon="live" title={data ? "En attente de la prochaine question" : "Préparons les échanges"} text={canDesign ? "Préparez une question, puis lancez-la pour permettre aux participants de répondre." : "La question apparaîtra ici dès que l’animateur la lancera."} />}
        {!data?.canManage && data?.score.answered ? <div className={styles.score}><Award size={22} /><div><strong>Votre score : {data.score.correct} / {data.score.answered}</strong><p>Sur les quiz auxquels vous avez répondu et dont la correction a été révélée.</p></div></div> : null}
      </>}
    </div>
    <footer className={styles.footer}><LockKeyhole size={13} /><span>Un vote par compte connecté ou navigateur invité. Les réponses libres publiées affichent votre nom.</span></footer>
  </section>;
}

function Empty({ icon, title, text }: { icon: "drafts" | "history" | "live"; title: string; text: string }) {
  const Icon = icon === "drafts" ? ListOrdered : icon === "history" ? History : MessageSquare;
  return <div className={styles.empty}><span><Icon size={26} /></span><h4>{title}</h4><p>{text}</p></div>;
}

function PollComposer({ draft, onChange, preview, setPreview }: { draft: PollDraft; onChange: (draft: PollDraft) => void; preview: boolean; setPreview: (value: boolean) => void }) {
  return <div className={styles.composer}>
    <div className={styles.typeSelector}>{(["poll", "quiz", "open"] as const).map(type => { const Icon = icons[type]; return <button type="button" key={type} aria-pressed={draft.type === type} onClick={() => onChange({ ...draft, type })}><Icon size={18} /><span>{labels[type]}</span></button>; })}</div>
    <label className={styles.field}>Votre question<textarea maxLength={300} rows={3} value={draft.question} placeholder="Ex. Quel thème souhaitez-vous approfondir ensemble ?" onChange={event => onChange({ ...draft, question: event.target.value })} /><small>{draft.question.length} / 300</small></label>
    {draft.type !== "open" && <fieldset className={styles.optionFields}><legend>Réponses proposées {draft.type === "quiz" && "· cochez la bonne réponse"}</legend>{draft.options.map((option, index) => <div className={styles.optionRow} key={option.id}>
      {draft.type === "quiz" && <label className={styles.correctChoice} title="Bonne réponse"><input type="radio" name="correct-option" aria-label={`Bonne réponse : option ${index + 1}`} checked={draft.correctOptionId === option.id} onChange={() => onChange({ ...draft, correctOptionId: option.id })} /><Check size={16} /></label>}
      <input aria-label={`Option ${index + 1}`} maxLength={160} placeholder={`Réponse ${index + 1}`} value={option.text} onChange={event => onChange({ ...draft, options: draft.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} />
      <button type="button" className={styles.iconButton} disabled={draft.options.length <= 2} aria-label={`Supprimer l’option ${index + 1}`} onClick={() => onChange({ ...draft, options: draft.options.filter(item => item.id !== option.id), correctOptionId: draft.correctOptionId === option.id ? undefined : draft.correctOptionId })}><X size={17} /></button>
    </div>)}<button type="button" className={styles.textButton} disabled={draft.options.length >= 8} onClick={() => onChange({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "" }] })}><Plus size={16} /> Ajouter une réponse ({draft.options.length}/8)</button></fieldset>}
    {draft.type === "quiz" && <label className={styles.field}>Explication ou référence biblique <span className={styles.help}>Facultatif · visible lors de la correction</span><textarea rows={2} maxLength={1000} value={draft.explanation} placeholder="Ex. Matthieu 5:9 — Heureux ceux qui procurent la paix…" onChange={event => onChange({ ...draft, explanation: event.target.value })} /></label>}
    <label className={styles.field}>Temps pour répondre<select value={draft.durationSeconds} onChange={event => onChange({ ...draft, durationSeconds: Number(event.target.value) })}><option value={0}>Sans limite · clôture manuelle</option><option value={30}>30 secondes</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option></select></label>
    <p className={styles.tip}><EyeOff size={17} /> Les résultats restent masqués jusqu’à votre décision. La correction du quiz reste confidentielle.</p>
    <button type="button" className={styles.secondary} aria-expanded={preview} onClick={() => setPreview(!preview)}><Eye size={16} />{preview ? "Masquer l’aperçu" : "Aperçu participant"}</button>
    {preview && <div className={styles.preview}><p className={styles.eyebrow}>APERÇU · AUCUN VOTE ENVOYÉ</p><h4>{draft.question || "Votre question"}</h4>{draft.type === "open" ? <p className={styles.help}>Le participant pourra rédiger une réponse libre.</p> : draft.options.map((option, index) => <div key={option.id} className={styles.previewOption}><span>{String.fromCharCode(65 + index)}</span>{option.text || `Réponse ${index + 1}`}</div>)}</div>}
  </div>;
}

function PollQuestion({ poll, canManage, now, busy, userName, send }: { poll: PollView; canManage: boolean; now: number; busy: boolean; userName: string; send: (command: PollCommand, message: string) => Promise<boolean> }) {
  const [optionId, setOptionId] = useState<string | undefined>();
  const [answer, setAnswer] = useState("");
  const remaining = poll.closesAt ? Math.max(0, Math.ceil((poll.closesAt - now) / 1000)) : null;
  const closed = poll.status === "closed" || remaining === 0;
  const canVote = !closed && !poll.myVote;
  const TypeIcon = icons[poll.type];
  const showCorrection = poll.type === "quiz" && poll.revealAnswer && closed;
  return <div className={styles.question}>
    <div className={styles.questionMeta}><span><TypeIcon size={16} />{labels[poll.type]}</span><span className={closed ? styles.closed : styles.live}>{closed ? "Clôturé" : "À vous de répondre"}</span></div>
    <h4>{poll.question}</h4>
    <div className={styles.statistics}><span><Users size={16} />{poll.totalVotes} réponse{poll.totalVotes !== 1 ? "s" : ""}</span>{remaining !== null && !closed && <span className={remaining <= 10 ? styles.urgent : ""} role="timer" aria-label="Temps restant"><Clock3 size={16} />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}</div>
    {canManage && <p className={styles.help}>{poll.revealResults ? "Les participants voient les résultats." : "Résultats visibles uniquement par vous."}</p>}
    {poll.type !== "open" ? <div className={styles.votes} role="group" aria-label="Choisir une réponse">{poll.options.map((option, index) => {
      const count = poll.counts?.[option.id] || 0;
      const percent = poll.totalVotes ? Math.round(count * 100 / poll.totalVotes) : 0;
      const chosen = (poll.myVote?.optionId || optionId) === option.id;
      const correct = showCorrection && poll.correctOptionId === option.id;
      return <button key={option.id} type="button" className={`${styles.voteOption} ${chosen ? styles.chosen : ""} ${correct ? styles.correct : ""}`} aria-pressed={chosen} disabled={!canVote || busy} onClick={() => setOptionId(option.id)}>
        {poll.counts && <span className={styles.bar} style={{ width: `${percent}%` }} />}
        <span className={styles.optionLetter}>{correct ? <Check size={17} /> : String.fromCharCode(65 + index)}</span><span className={styles.optionText}>{option.text}{chosen && <small>{poll.myVote ? "Votre réponse" : "Sélectionnée"}</small>}{correct && <small>Bonne réponse</small>}</span>{poll.counts && <span className={styles.count}>{percent}%<small>{count} vote{count !== 1 ? "s" : ""}</small></span>}
      </button>;
    })}</div> : <>
      {canVote && <label className={styles.field}>Votre réponse<textarea rows={3} maxLength={1000} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Écrivez votre réflexion…" /><small>{answer.length} / 1000 · Votre nom accompagnera votre réponse.</small></label>}
      {poll.answers && <div className={styles.answers}>{poll.answers.length ? poll.answers.map((item, index) => <blockquote key={index}><p>{item.text}</p><cite>{item.name}</cite></blockquote>) : <p className={styles.help}>Aucune réponse pour le moment.</p>}</div>}
    </>}
    {canVote && <button type="button" className={styles.primary} disabled={busy || (poll.type === "open" ? !answer.trim() : !optionId)} onClick={() => void send({ action: "vote", pollId: poll.id, name: userName.slice(0, 80), optionId, text: answer }, "Votre réponse a bien été enregistrée.")}>{busy ? <Loader2 size={17} className={styles.spin} /> : <Send size={17} />} Valider {poll.type === "open" ? "ma réponse" : "mon vote"}</button>}
    {poll.myVote && <p className={styles.receipt} role="status"><CheckCircle2 size={18} />Réponse enregistrée{!poll.revealResults && !canManage ? " · Les résultats seront publiés par l’animateur." : "."}</p>}
    {!canManage && !poll.revealResults && !poll.myVote && <p className={styles.tip}><EyeOff size={16} />Les résultats sont masqués pour laisser chacun répondre librement.</p>}
    {showCorrection && poll.explanation && <div className={styles.explanation}><strong><Award size={18} />Pour aller plus loin</strong><p>{poll.explanation}</p></div>}
  </div>;
}
