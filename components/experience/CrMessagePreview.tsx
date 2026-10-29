import { Fragment, type ReactNode } from "react";
import { MessageCircle, Check } from "lucide-react";
import styles from "./CounselorCrWhatsAppModal.module.css";

function emphasis(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) return <strong key={index}>{emphasis(part.slice(1, -1))}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index}>{emphasis(part.slice(1, -1))}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Render the exact shared text, interpreting only WhatsApp emphasis. Never render user HTML. */
export default function CrMessagePreview({ message, count }: { message: string; count: number }) {
  return (
    <section className={styles.preview} aria-label="Aperçu du message WhatsApp">
      <header className={styles.previewHeader}>
        <span className={styles.chatAvatar}><MessageCircle size={22} aria-hidden="true" /></span>
        <div><strong>Votre message WhatsApp</strong><span>Aperçu avant partage</span></div>
        <span className={styles.liveBadge}><span /> En direct</span>
      </header>
      <div className={styles.chatCanvas}>
        <span className={styles.chatDate}>COMPTE-RENDU · POIMÉN</span>
        {message ? (
          <article className={styles.messageBubble} aria-label="Contenu du message">
            {message.split("\n").map((line, index) => (
              <div key={index} className={line ? styles.messageLine : styles.messageSpace}>
                {emphasis(line)}
              </div>
            ))}
          </article>
        ) : (
          <div className={styles.previewEmpty}>
            <MessageCircle size={36} strokeWidth={1.3} aria-hidden="true" />
            <h3>Un message déjà préparé.</h3>
            <p>Choisissez les personnes : leur suivi se transforme ici en compte-rendu.</p>
            <span className={styles.ghostBubble} /><span className={styles.ghostBubbleShort} />
          </div>
        )}
      </div>
      <div className={styles.previewFoot}>
        <span><Check size={13} aria-hidden="true" /> {count ? count + (count > 1 ? " personnes incluses" : " personne incluse") : "Prérempli depuis vos fiches"}</span>
        {message && <span>{message.length.toLocaleString("fr-FR")} caractères</span>}
      </div>
    </section>
  );
}
