"use client";

import { useEffect, useState } from "react";
import { Bell, Sparkles, Check, X, ShieldCheck, PhoneCall } from "lucide-react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission
} from "@/lib/notifications";
import { getActiveUserInfo } from "@/lib/client-session";
import styles from "./NotificationPromptModal.module.css";

const POSTPONE_KEY = "poimen_notif_prompt_postponed_until";

export default function NotificationPromptModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ne s'exécute que côté client
    if (typeof window === "undefined") return;

    const timer = setTimeout(() => {
      const user = getActiveUserInfo();
      if (!user) return;

      if (!isNotificationSupported()) return;

      const permission = getNotificationPermission();
      if (permission !== "default") return;

      // Vérifier si le conseiller a cliqué "Plus tard" récemment
      try {
        const postponedUntil = localStorage.getItem(POSTPONE_KEY);
        if (postponedUntil && new Date(postponedUntil).getTime() > Date.now()) {
          return;
        }
      } catch {
        // ignore
      }

      setIsVisible(true);
    }, 1200); // Déclenchement doux après 1.2 seconde

    return () => clearTimeout(timer);
  }, []);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      setIsVisible(false);
      if (!granted) {
        // En cas de refus ou fermeture navigateur, reporter de 3 jours
        postpone(3);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLater = () => {
    postpone(5); // Reporter de 5 jours
    setIsVisible(false);
  };

  const postpone = (days: number) => {
    try {
      const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(POSTPONE_KEY, date);
    } catch {
      // ignore
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="notif-prompt-title">
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleLater}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div className={styles.headerRow}>
          <div className={styles.iconBox}>
            <Bell size={24} />
          </div>
          <div>
            <h3 id="notif-prompt-title" className={styles.title}>
              Activez les alertes pastorales
            </h3>
            <p className={styles.subtitle}>Ne manquez aucun invité qui vous est confié</p>
          </div>
        </div>

        <p className={styles.description}>
          Recevez directement une notification sur votre écran d&apos;accueil dès qu&apos;une personne vous est attribuée ou en cas de rappel de contact.
        </p>

        <div className={styles.benefitsList}>
          <div className={styles.benefitItem}>
            <Sparkles size={14} />
            <span>Alerte instantanée lors d&apos;une nouvelle affectation</span>
          </div>
          <div className={styles.benefitItem}>
            <PhoneCall size={14} />
            <span>Rappels d&apos;appels bienveillants si un invité attend</span>
          </div>
          <div className={styles.benefitItem}>
            <ShieldCheck size={14} />
            <span>100% gratuit, discret et désactivable à tout moment</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleActivate}
            disabled={loading}
          >
            <Bell size={16} />
            <span>{loading ? "Activation…" : "Activer maintenant"}</span>
          </button>
          <button
            type="button"
            className={styles.laterBtn}
            onClick={handleLater}
            disabled={loading}
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
