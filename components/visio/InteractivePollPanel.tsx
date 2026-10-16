"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Award, BarChart3, Check, CheckCircle2, ChevronDown, ChevronLeft, Clock3, Cloud, Copy, Crown, Download, Eye, EyeOff, HelpCircle, History, List, ListOrdered, ListPlus, Loader2, LockKeyhole, MessageSquare, Pencil, Play, Plus, RefreshCw, Send, Trash2, Users, X } from "lucide-react";
import { validateDraft } from "@/lib/poll-engine";
import type { PollCommand, PollDraft, PollSnapshot, PollType, PollView } from "@/types/visio-poll";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { animateVisioPanelExit } from "./interaction-transition";
import styles from "./InteractivePollPanel.module.css";

type Props = { roomName: string; isHost?: boolean; userName?: string; onClose?: () => void };
const labels: Record<PollType, string> = { poll: "Sondage", quiz: "Quiz", open: "Question libre" };
const icons = { poll: BarChart3, quiz: HelpCircle, open: MessageSquare };
function freshDraft(): PollDraft {
  return { type: "poll", question: "", options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }], explanation: "", durationSeconds: 0 };
}

const quickPollPresets = [
  {
    label: "👍 / 👎 D’accord",
    question: "Êtes-vous d’accord avec cette proposition ?",
    options: ["👍 D’accord", "👎 Pas d’accord"]
  },
  {
    label: "✅ / ❌ Oui / Non",
    question: "Oui ou Non ?",
    options: ["✅ Oui", "❌ Non", "🤔 Indécis"]
  },
  {
    label: "⭐ 1 à 5 Étoiles",
    question: "Comment évaluez-vous ce moment partagé ?",
    options: ["⭐⭐⭐⭐⭐ Excellent", "⭐⭐⭐⭐ Très bien", "⭐⭐⭐ Bien", "⭐⭐ Moyen", "⭐ À améliorer"]
  },
  {
    label: "🅰️ 🅱️ 🅲 🅳 Choix",
    question: "Quel est votre choix parmi ces options ?",
    options: ["Option A", "Option B", "Option C", "Option D"]
  }
];

const FRENCH_STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "l",
  "et", "ou", "mais", "donc", "or", "ni", "car", "que", "qui", "quoi", "dont", "où",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "me", "te", "se",
  "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses", "notre", "votre", "leur", "nos", "vos", "leurs",
  "ce", "cet", "cette", "ces", "dans", "en", "sur", "sous", "par", "pour", "avec", "sans", "vers", "chez",
  "est", "sont", "été", "être", "avoir", "ai", "as", "a", "avons", "avez", "ont", "fait", "faire",
  "très", "bien", "plus", "moins", "tout", "tous", "toute", "toutes", "aussi", "autre", "autres",
  "c'est", "j'ai", "qu'il", "qu'elle", "comme", "quand", "si", "alors", "encore", "toujours", "déjà",
  "merci", "beaucoup", "trop", "rien", "même"
]);

function extractKeywords(answers: { name: string; text: string }[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of answers) {
    const rawTokens = item.text.toLowerCase().split(/[^a-zà-ÿ0-9'-]+/);
    const seenInAnswer = new Set<string>();
    for (let token of rawTokens) {
      token = token.replace(/^['-]+|['-]+$/g, "");
      if (token.length >= 3 && !FRENCH_STOPWORDS.has(token) && !/^\d+$/.test(token)) {
        if (!seenInAnswer.has(token)) {
          seenInAnswer.add(token);
          counts.set(token, (counts.get(token) || 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

export default function InteractivePollPanel(props: Props) {
  // Room changes reset requests, draft and selection as one unit.
  const [fullscreenTarget, setFullscreenTarget] = useState<HTMLElement | null>(null);
  const [pollInputActive, setPollInputActive] = useState(false);

  useEffect(() => {
    const syncFullscreenTarget = () => {
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      const nativeTarget = document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : null;
      const immersiveTarget = document.querySelector<HTMLElement>('[data-visio-fullscreen-mode="true"]');
      const interactionDock = document.querySelector<HTMLElement>('[data-visio-interaction-dock="true"]');

      if (isMobile) {
        // Sur mobile : portail direct dans le conteneur immersif de la visio afin d'occuper tout l'écran,
        // garantissant un espace généreux qui n'est pas masqué par le clavier tactile lors de la saisie.
        setFullscreenTarget(nativeTarget ?? immersiveTarget ?? document.body);
      } else {
        // Sur desktop : portail dans le dock latéral dédié
        setFullscreenTarget(interactionDock ?? nativeTarget ?? immersiveTarget ?? document.body);
      }
    };
    syncFullscreenTarget();
    const observer = new MutationObserver(syncFullscreenTarget);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["data-visio-fullscreen-mode"] });
    document.addEventListener("fullscreenchange", syncFullscreenTarget);
    window.addEventListener("resize", syncFullscreenTarget);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", syncFullscreenTarget);
      window.removeEventListener("resize", syncFullscreenTarget);
    };
  }, []);

  const panel = <PollPanel key={`${props.roomName}:${props.isHost}`} {...props} />;
  return fullscreenTarget
    ? createPortal(<div className={styles.fullscreenPortal} data-visio-poll-panel="true" data-poll-input-active={pollInputActive ? "true" : undefined} onFocusCapture={(event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        setPollInputActive(true);
        const target = event.target;
        setTimeout(() => {
          try {
            target.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch {
            // Ignore if scroll is not supported
          }
        }, 180);
      }
    }}>{panel}</div>, fullscreenTarget)
    : panel;
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
  const closingRef = useRef(false);
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

  const closePanel = async () => {
    if (!onClose || closingRef.current) return;
    closingRef.current = true;
    try {
      const shouldClose = await animateVisioPanelExit(document.querySelector<HTMLElement>('[data-visio-poll-panel="true"]'));
      if (shouldClose) onClose();
    } finally {
      closingRef.current = false;
    }
  };

  const drafts = data?.polls.filter(poll => poll.status === "draft") || [];
  const history = data?.polls.filter(poll => poll.status === "closed").sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)) || [];
  const live = data?.polls.find(poll => poll.status === "open") || history[0];
  const selected = tab === "history" ? history.find(poll => poll.id === historyId) : live;
  const canDesign = isHost && (!data || data.canManage);
  const serverNow = data ? data.serverTime + Math.max(0, tick - receivedAt) : 0;
  const edit = (poll?: PollView) => { setDraft(poll ? { id: poll.id, type: poll.type, question: poll.question, options: poll.options.map(option => ({ ...option })), correctOptionId: poll.correctOptionId, explanation: poll.explanation, durationSeconds: poll.durationSeconds } : freshDraft()); setPreview(false); setFormError(""); };
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
  const removePoll = async (poll: PollView) => {
    const noun = poll.totalVotes === 1 ? "réponse" : "réponses";
    const message = `Supprimer définitivement « ${poll.question} » et ses ${poll.totalVotes} ${noun} pour tous les participants ? Cette action est irréversible.`;
    if (await confirm(message, { title: "Supprimer le sondage ?", confirmLabel: "Supprimer définitivement", tone: "danger" })) {
      await send({ action: "remove", pollId: poll.id }, "Question et réponses supprimées.");
    }
  };

  return <section className={styles.panel} aria-label="Sondages et quiz">
    <header className={styles.header}>
      <span className={styles.headerIcon}><BarChart3 size={20} /></span>
      <div><h3>Sondages & quiz</h3><p>{data?.canManage ? "Animez les échanges, une question à la fois." : "Votre avis compte."}</p></div>
      {onClose && <button type="button" className={styles.iconButton} aria-label="Fermer les sondages" onClick={() => void closePanel()}><X size={20} /></button>}
    </header>
    <div className={styles.connection} role="status"><span className={error ? styles.offlineDot : styles.onlineDot} />{error ? "Synchronisation interrompue" : data ? "Les réponses se mettent à jour automatiquement" : "Connexion aux sondages…"}{busy && <Loader2 size={14} className={styles.spin} />}</div>
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
        {canDesign && <div className={styles.listActions}><button type="button" className={selected && tab !== "drafts" ? styles.secondary : styles.primary} onClick={() => edit()}><Plus size={17} /> Préparer une question</button>{tab === "history" && history.length > 0 && <a className={styles.secondary} href={`${endpoint}&format=csv`} download={`sondages-${roomName}.csv`}><Download size={16} /> Exporter CSV</a>}</div>}
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
          {data?.canManage && <div className={styles.hostControls}>
            <div className={styles.hostHeading}><span className={styles.eyebrow}>ANIMATION</span><span>{selected.status === "open" ? "Les participants peuvent répondre" : "Les votes sont terminés"}</span></div>
            <div className={styles.hostMainActions}>
              {selected.status === "open" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "close", pollId: selected.id }, "Les votes sont clôturés.")}><LockKeyhole size={16} /> Clôturer les votes</button>}
              <button type="button" className={selected.revealResults ? styles.secondary : styles.primary} disabled={busy} onClick={() => void send({ action: "results", pollId: selected.id }, selected.revealResults ? "Résultats masqués." : "Résultats publiés.")}>{selected.revealResults ? <EyeOff size={16} /> : <Eye size={16} />}{selected.revealResults ? "Masquer les résultats" : "Publier les résultats"}</button>
              {selected.type === "quiz" && selected.status === "closed" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "answer", pollId: selected.id }, selected.revealAnswer ? "Correction masquée." : "Correction révélée.")}><Award size={16} />{selected.revealAnswer ? "Masquer la correction" : "Révéler la correction"}</button>}
            </div>
            {selected.type === "quiz" && selected.status === "open" && <p className={styles.help}>Clôturez les votes pour révéler la bonne réponse.</p>}
            <details key={selected.id} className={styles.moreActions}>
              <summary><span>Plus d’options</span><ChevronDown size={16} /></summary>
              <div className={styles.actions}>
                {selected.status === "closed" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void launch(selected)}><Play size={16} /> Rouvrir les votes</button>}
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: "duplicate", pollId: selected.id }, "Copie ajoutée à la file.")}><Copy size={16} /> Dupliquer</button>
                <button type="button" className={`${styles.secondary} ${styles.dangerAction}`} disabled={busy} onClick={() => void removePoll(selected)}><Trash2 size={16} /> Supprimer cette question</button>
              </div>
            </details>
            {drafts[0] && <button type="button" className={styles.nextQuestion} disabled={busy} onClick={() => void launch(drafts[0])}><span><small>QUESTION SUIVANTE</small><span>{drafts[0].question}</span></span><Play size={18} /></button>}
          </div>}
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
    {/* Formats rapides 1-Clic */}
    <div className={styles.quickPresetsSection}>
      <div className={styles.quickPresetsHeader}>
        <ListPlus size={14} />
        <span>Formats rapides (1-clic)</span>
      </div>
      <div className={styles.quickPresetsGrid}>
        {quickPollPresets.map(preset => (
          <button
            key={preset.label}
            type="button"
            className={styles.quickPresetChip}
            onClick={() => {
              onChange({
                type: "poll",
                question: preset.question,
                options: preset.options.map(text => ({ id: crypto.randomUUID(), text })),
                explanation: "",
                durationSeconds: 0
              });
              setPreview(false);
            }}
          >
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
    <div className={styles.typeSelector}>{(["poll", "quiz", "open"] as const).map(type => { const Icon = icons[type]; return <button type="button" key={type} aria-pressed={draft.type === type} onClick={() => onChange({ ...draft, type })}><Icon size={18} /><span>{labels[type]}</span></button>; })}</div>
    <label className={styles.field}>Votre question<textarea maxLength={300} rows={3} value={draft.question} placeholder="Ex. Quel thème souhaitez-vous approfondir ensemble ?" onChange={event => onChange({ ...draft, question: event.target.value })} /><small>{draft.question.length} / 300</small></label>
    {draft.type !== "open" && <fieldset className={styles.optionFields}><legend>Réponses proposées {draft.type === "quiz" && "· cochez la bonne réponse"}</legend>{draft.options.map((option, index) => <div className={styles.optionRow} key={option.id}>
      {draft.type === "quiz" && <label className={styles.correctChoice} title="Bonne réponse"><input type="radio" name="correct-option" aria-label={`Bonne réponse : option ${index + 1}`} checked={draft.correctOptionId === option.id} onChange={() => onChange({ ...draft, correctOptionId: option.id })} /><Check size={16} /></label>}
      <input aria-label={`Option ${index + 1}`} maxLength={160} placeholder={`Réponse ${index + 1}`} value={option.text} onChange={event => onChange({ ...draft, options: draft.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} />
      <button type="button" className={styles.iconButton} disabled={draft.options.length <= 2} aria-label={`Supprimer l’option ${index + 1}`} onClick={() => onChange({ ...draft, options: draft.options.filter(item => item.id !== option.id), correctOptionId: draft.correctOptionId === option.id ? undefined : draft.correctOptionId })}><X size={17} /></button>
    </div>)}<button type="button" className={styles.textButton} disabled={draft.options.length >= 8} onClick={() => onChange({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "" }] })}><Plus size={16} /> Ajouter une réponse ({draft.options.length}/8)</button></fieldset>}
    {draft.type === "quiz" && <label className={styles.field}>Explication ou référence biblique <span className={styles.help}>Facultatif · visible lors de la correction</span><textarea rows={2} maxLength={1000} value={draft.explanation} placeholder="Ex. Matthieu 5:9 — Heureux ceux qui procurent la paix…" onChange={event => onChange({ ...draft, explanation: event.target.value })} /></label>}
    <div className={styles.field}><span>Temps pour répondre</span><DurationPicker value={draft.durationSeconds} onChange={durationSeconds => onChange({ ...draft, durationSeconds })} /></div>
    <p className={styles.tip}><EyeOff size={17} /> Les résultats restent masqués jusqu’à votre décision. La correction du quiz reste confidentielle.</p>
    <button type="button" className={styles.secondary} aria-expanded={preview} onClick={() => setPreview(!preview)}><Eye size={16} />{preview ? "Masquer l’aperçu" : "Aperçu participant"}</button>
    {preview && <div className={styles.preview}><p className={styles.eyebrow}>APERÇU · AUCUN VOTE ENVOYÉ</p><h4>{draft.question || "Votre question"}</h4>{draft.type === "open" ? <p className={styles.help}>Le participant pourra rédiger une réponse libre.</p> : draft.options.map((option, index) => <div key={option.id} className={styles.previewOption}><span>{String.fromCharCode(65 + index)}</span>{option.text || `Réponse ${index + 1}`}</div>)}</div>}
  </div>;
}

const pollDurations = [
  { value: 0, label: "Sans limite · clôture manuelle" },
  { value: 30, label: "30 secondes" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
];

function DurationPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = pollDurations.find(option => option.value === value) ?? pollDurations[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={styles.durationPicker} ref={rootRef}>
    <button ref={triggerRef} type="button" className={styles.durationTrigger} aria-haspopup="listbox" aria-expanded={open} aria-controls="poll-duration-options" onClick={() => setOpen(current => !current)}>
      <span>{selected.label}</span><ChevronDown size={17} aria-hidden="true" />
    </button>
    {open && <div className={styles.durationOptions} id="poll-duration-options" role="listbox" aria-label="Temps pour répondre">
      {pollDurations.map(option => <button type="button" role="option" aria-selected={option.value === value} className={styles.durationOption} key={option.value} onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}>
        <span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}

function PollQuestion({ poll, canManage, now, busy, userName, send }: { poll: PollView; canManage: boolean; now: number; busy: boolean; userName: string; send: (command: PollCommand, message: string) => Promise<boolean> }) {
  const [optionId, setOptionId] = useState<string | undefined>();
  const [answer, setAnswer] = useState("");
  const [openViewTab, setOpenViewTab] = useState<"cloud" | "list">("cloud");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const remaining = poll.closesAt ? Math.max(0, Math.ceil((poll.closesAt - now) / 1000)) : null;
  const closed = poll.status === "closed" || remaining === 0;
  const canVote = !closed && !poll.myVote;
  const TypeIcon = icons[poll.type];
  const showCorrection = poll.type === "quiz" && poll.revealAnswer && closed;
  const voteWasCorrect = Boolean(poll.myVote?.optionId && poll.myVote.optionId === poll.correctOptionId);
  const hasVisibleResults = poll.type === "open" ? Boolean(poll.answers) : Boolean(poll.counts);
  const remainingPercent = remaining !== null && poll.durationSeconds > 0 ? Math.min(100, remaining * 100 / poll.durationSeconds) : 0;

  // Calcul de la réponse en tête pour la couronne dorée 👑
  const maxCount = poll.totalVotes > 0 && poll.counts
    ? Math.max(...poll.options.map(option => poll.counts?.[option.id] || 0))
    : 0;

  // Nuage de mots pour les réponses libres
  const keywords = useMemo(() => {
    if (poll.type !== "open" || !poll.answers?.length) return [];
    return extractKeywords(poll.answers);
  }, [poll.type, poll.answers]);

  const filteredAnswers = useMemo(() => {
    if (!poll.answers) return [];
    if (!selectedKeyword) return poll.answers;
    const kw = selectedKeyword.toLowerCase();
    return poll.answers.filter(a => a.text.toLowerCase().includes(kw));
  }, [poll.answers, selectedKeyword]);

  return <div className={styles.question}>
    <div className={styles.questionMeta}><span><TypeIcon size={16} />{labels[poll.type]}</span><span className={closed ? styles.closed : poll.myVote ? styles.answered : styles.live}>{closed ? "Votes clôturés" : poll.myVote ? "Réponse envoyée" : "À vous de répondre"}</span></div>
    <h4>{poll.question}</h4>
    <div className={styles.statistics}><span><Users size={16} />{poll.totalVotes} réponse{poll.totalVotes !== 1 ? "s" : ""}</span>{remaining !== null && !closed && <span className={remaining <= 10 ? styles.urgent : ""} role="timer" aria-label="Temps restant"><Clock3 size={16} />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}</div>
    {remaining !== null && !closed && <div className={`${styles.timeTrack} ${remaining <= 10 ? styles.timeUrgent : ""}`} aria-hidden="true"><span style={{ width: `${remainingPercent}%` }} /></div>}
    
    {/* RÉSULTAT QUIZ & CONFETTIS FESTIFS */}
    {showCorrection && poll.myVote?.optionId && (
      <>
        {voteWasCorrect && (
          <div className={styles.confettiWrapper} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className={styles.confettiDot}
                style={{
                  left: `${(i * 13) % 96 + 2}%`,
                  animationDelay: `${i * 45}ms`,
                  backgroundColor: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#eab308"][i % 6],
                  width: `${i % 3 === 0 ? 8 : 6}px`,
                  height: `${i % 2 === 0 ? 12 : 6}px`,
                }}
              />
            ))}
          </div>
        )}
        <div className={`${styles.quizResult} ${voteWasCorrect ? styles.quizSuccess : styles.quizMiss}`} role="status" aria-live="polite">
          <span className={styles.quizResultIcon} aria-hidden="true">{voteWasCorrect ? <CheckCircle2 size={22} /> : <X size={22} />}</span>
          <div>
            <strong>{voteWasCorrect ? "🎉 Bravo, bonne réponse !" : "Pas cette fois"}</strong>
            <p>{voteWasCorrect ? "Vous avez trouvé la réponse exacte !" : "Regardez la correction et retenez la bonne réponse."}</p>
          </div>
        </div>
      </>
    )}

    <div className={styles.answerHeading}><span>{hasVisibleResults ? "Les réponses" : poll.type === "open" ? "À vous la parole" : "Choisissez votre réponse"}</span><small>{hasVisibleResults ? <>{poll.revealResults ? <Eye size={13} /> : <EyeOff size={13} />}{poll.revealResults ? "Partagées avec tous" : "Visibles par vous"}</> : poll.type !== "open" ? "1 choix possible" : ""}</small></div>
    
    {poll.type !== "open" ? <div className={styles.votes} role="group" aria-label={canVote ? "Choisir une réponse" : "Réponses à la question"}>{poll.options.map((option, index) => {
      const count = poll.counts?.[option.id] || 0;
      const percent = poll.totalVotes ? Math.round(count * 100 / poll.totalVotes) : 0;
      const chosen = (poll.myVote?.optionId || optionId) === option.id;
      const correct = showCorrection && poll.correctOptionId === option.id;
      const incorrect = showCorrection && poll.myVote?.optionId === option.id && !correct;
      const isWinner = hasVisibleResults && maxCount > 0 && count === maxCount && poll.totalVotes >= 2;

      return <button key={option.id} type="button" className={`${styles.voteOption} ${chosen ? styles.chosen : ""} ${correct ? styles.correct : ""} ${incorrect ? styles.incorrect : ""} ${isWinner ? styles.winnerOption : ""}`} aria-pressed={chosen} disabled={!canVote || busy} onClick={() => setOptionId(option.id)}>
        {poll.counts && <span className={styles.bar} style={{ width: `${percent}%` }} />}
        <span className={styles.optionLetter}>
          {isWinner ? <Crown size={15} className={styles.crownIcon} /> : (correct || chosen ? <Check size={17} /> : String.fromCharCode(65 + index))}
        </span>
        <span className={styles.optionText}>
          {option.text}
          {chosen && <small>{poll.myVote ? "Votre réponse" : "Sélectionnée"}</small>}
          {correct && <small>Bonne réponse</small>}
          {isWinner && <small className={styles.winnerText}>👑 En tête ({percent}%)</small>}
        </span>
        {poll.counts && <span className={styles.count}>{percent}%<small>{count} vote{count !== 1 ? "s" : ""}</small></span>}
      </button>;
    })}</div> : <>
      {canVote && <label className={styles.field}>Votre réponse<textarea rows={3} maxLength={1000} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Écrivez votre réflexion…" /><small>{answer.length} / 1000 · Votre nom accompagnera votre réponse.</small></label>}
      {poll.myVote?.text && <div className={styles.myWrittenAnswer}><small>Votre réponse</small><p>{poll.myVote.text}</p></div>}
      
      {/* VUE EN NUAGE DE MOTS-CLÉS OU LISTE POUR QUESTIONS LIBRES */}
      {poll.answers && poll.answers.length > 0 && (
        <>
          <div className={styles.openViewToggle}>
            <button
              type="button"
              className={`${styles.openViewBtn} ${openViewTab === "cloud" ? styles.openViewBtnActive : ""}`}
              onClick={() => setOpenViewTab("cloud")}
            >
              <Cloud size={14} />
              <span>Nuage de mots {keywords.length > 0 ? `(${keywords.length})` : ""}</span>
            </button>
            <button
              type="button"
              className={`${styles.openViewBtn} ${openViewTab === "list" ? styles.openViewBtnActive : ""}`}
              onClick={() => {
                setOpenViewTab("list");
                setSelectedKeyword(null);
              }}
            >
              <List size={14} />
              <span>Toutes les réponses ({poll.answers.length})</span>
            </button>
          </div>

          {openViewTab === "cloud" && keywords.length > 0 && (
            <div className={styles.wordCloudContainer}>
              <div className={styles.wordCloud}>
                {keywords.map(kw => {
                  const topCount = keywords[0]?.count || 1;
                  const ratio = kw.count / topCount;
                  const fontSize = 12 + Math.round(ratio * 12);
                  const isSelected = selectedKeyword === kw.word;
                  return (
                    <button
                      key={kw.word}
                      type="button"
                      className={`${styles.wordChip} ${isSelected ? styles.wordChipActive : ""}`}
                      style={{ fontSize: `${fontSize}px` }}
                      onClick={() => setSelectedKeyword(curr => curr === kw.word ? null : kw.word)}
                      title={`${kw.count} mention${kw.count > 1 ? "s" : ""} - Cliquer pour filtrer`}
                    >
                      <span>{kw.word}</span>
                      <small>{kw.count}</small>
                    </button>
                  );
                })}
              </div>
              {selectedKeyword && (
                <div className={styles.cloudFilterNotice}>
                  <span>Filtré par <strong>« {selectedKeyword} »</strong> ({filteredAnswers.length})</span>
                  <button type="button" onClick={() => setSelectedKeyword(null)}>Effacer le filtre</button>
                </div>
              )}
            </div>
          )}

          <div className={styles.answers}>
            {filteredAnswers.length ? filteredAnswers.map((item, index) => (
              <blockquote key={index}>
                <p>{item.text}</p>
                <cite>{item.name}</cite>
              </blockquote>
            )) : (
              <p className={styles.help}>Aucune réponse ne contient ce mot-clé.</p>
            )}
          </div>
        </>
      )}

      {poll.answers && poll.answers.length === 0 && (
        <div className={styles.answers}><p className={styles.help}>Aucune réponse pour le moment.</p></div>
      )}
    </>}

    {canVote && <div className={styles.voteAction}><button type="button" className={styles.primary} disabled={busy || (poll.type === "open" ? !answer.trim() : !optionId)} onClick={() => void send({ action: "vote", pollId: poll.id, name: userName.slice(0, 80), optionId, text: answer }, "Votre réponse a bien été enregistrée.")}>{busy ? <Loader2 size={17} className={styles.spin} /> : <Send size={17} />} Valider {poll.type === "open" ? "ma réponse" : "mon vote"}</button><small>Votre choix sera définitif après validation.</small></div>}
    {poll.myVote && <p className={styles.receipt} role="status"><CheckCircle2 size={18} />Réponse enregistrée{!poll.revealResults && !canManage ? " · Les résultats seront publiés par l’animateur." : "."}</p>}
    {!canManage && !poll.revealResults && !poll.myVote && <p className={styles.tip}><EyeOff size={16} />Les résultats sont masqués pour laisser chacun répondre librement.</p>}
    {showCorrection && poll.explanation && <div className={styles.explanation}><strong><Award size={18} />Pour aller plus loin</strong><p>{poll.explanation}</p></div>}
  </div>;
}
