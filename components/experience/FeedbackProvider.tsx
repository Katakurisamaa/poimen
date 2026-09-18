"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import styles from "./Experience.module.css";

type Notice = { id: number; message: string };
type Feedback = { notify: (message: string) => void; confirm: (message: string) => Promise<boolean> };
const Context = createContext<Feedback | null>(null);

function Confirmation({ message, finish }: { message: string; finish: (value: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className={`${styles.dialog} ${styles.ui}`} ref={ref} aria-labelledby="confirmation-title" onCancel={event => { event.preventDefault(); finish(false); }}>
    <span className={styles.kicker}>CONFIRMATION</span>
    <h2 id="confirmation-title">Confirmer cette action</h2>
    <p>{message}</p>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} autoFocus onClick={() => finish(false)}>Annuler</button>
      <button type="button" className={styles.primary} onClick={() => finish(true)}>Confirmer</button>
    </div>
  </dialog>;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((message: string) => setNotices(previous => [...previous.slice(-2), { id: ++sequence.current, message }]), []);
  const confirm = useCallback((message: string) => new Promise<boolean>(resolve => {
    resolveRef.current?.(false);
    resolveRef.current = resolve;
    setQuestion(message);
  }), []);
  const finish = (answer: boolean) => { resolveRef.current?.(answer); resolveRef.current = null; setQuestion(null); };
  useEffect(() => () => resolveRef.current?.(false), []);
  return <Context.Provider value={{ notify, confirm }}>
    {children}
    <div className={`${styles.notices} ${styles.ui}`} aria-label="Messages de l’application">
      {notices.map(notice => <div key={notice.id} className={styles.notice} role={/erreur|impossible|échec/i.test(notice.message) ? "alert" : "status"}>
        {/succès|enregistr/i.test(notice.message) ? <CheckCircle2 size={20} /> : <Info size={20} />}
        <span>{notice.message}</span>
        <button type="button" className={styles.iconButton} aria-label="Fermer le message" onClick={() => setNotices(previous => previous.filter(item => item.id !== notice.id))}><X size={17} /></button>
      </div>)}
    </div>
    {question && <Confirmation message={question} finish={finish} />}
  </Context.Provider>;
}

export function useFeedback() {
  const feedback = useContext(Context);
  if (!feedback) throw new Error("FeedbackProvider is required.");
  return feedback;
}
