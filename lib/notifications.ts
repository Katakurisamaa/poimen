"use client";

export interface NotificationItem {
  id: string;
  type: "new_assignment" | "call_delayed";
  title: string;
  message: string;
  guestId: string;
  guestName: string;
  phone?: string;
  email?: string;
  arrivalDate?: string;
  daysElapsed: number;
  isRead: boolean;
  isUrgent: boolean;
  timestamp: string;
}

const READ_NOTIFS_KEY = "poimen_read_notifs";
const KNOWN_ASSIGNED_KEY = "poimen_known_assigned_souls";
const NOTIFIED_DELAYED_KEY = "poimen_notified_delayed_dates";

/**
 * Vérifie si les notifications du navigateur sont supportées
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Récupère le statut actuel de permission des notifications
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Demande la permission à l'utilisateur pour recevoir les notifications Push / Système
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Envoyer une confirmation test immédiate
      await showSystemNotification("🔔 Notifications Poimén activées", {
        body: "Vous serez prévenu(e) dès qu'un invité vous sera confié et en cas d'appel en retard.",
        tag: "poimen-welcome"
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[Notifications] Erreur demande permission:", err);
    return false;
  }
}

/**
 * Affiche une notification système native sur l'appareil (téléphone ou ordinateur)
 */
export async function showSystemNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    data?: any;
  }
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    body: options?.body || "",
    icon: options?.icon || "/brand/icon-192.png",
    badge: options?.badge || "/brand/icon-192.png",
    tag: options?.tag || `poimen-${Date.now()}`,
    data: { url: options?.url || "/dashboard/affectation", ...(options?.data || {}) },
  };

  // Vibration sur mobile si supportée
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      // Ignore vibration error
    }
  }

  // 1. Essai via Service Worker (idéal pour PWA & mobile)
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    } catch (err) {
      console.warn("[Notifications] Échec via ServiceWorker, bascule sur Notification standard:", err);
    }
  }

  // 2. Fallback via Notification API directe
  try {
    const n = new Notification(title, notificationOptions);
    n.onclick = () => {
      n.close();
      if (typeof window !== "undefined") {
        window.focus();
        if (options?.url) {
          window.location.href = options.url;
        }
      }
    };
    return true;
  } catch (err) {
    console.warn("[Notifications] Erreur envoi notification système:", err);
    return false;
  }
}

/**
 * Met à jour le badge numérique rouge sur l'icône de l'application sur l'écran d'accueil du smartphone
 */
export function updateAppBadge(count: number): void {
  if (typeof navigator === "undefined") return;

  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  } catch {
    // Navigateur ne supporte pas l'API App Badge
  }
}

/**
 * Récupère les identifiants de notifications marqués comme lus
 */
export function getReadNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Marque une notification comme lue
 */
export function markNotificationAsRead(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getReadNotificationIds();
    ids.add(id);
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(ids)));
    window.dispatchEvent(new CustomEvent("poimen:notifications-changed"));
  } catch (e) {
    console.error("Erreur sauvegarde lecture notification:", e);
  }
}

/**
 * Marque toutes les notifications comme lues
 */
export function markAllNotificationsAsRead(idsToMark: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getReadNotificationIds();
    idsToMark.forEach((id) => ids.add(id));
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(ids)));
    window.dispatchEvent(new CustomEvent("poimen:notifications-changed"));
  } catch (e) {
    console.error("Erreur marquage global notifications:", e);
  }
}

/**
 * Analyse les âmes confiées à un conseiller et génère les notifications :
 * - Nouvelles affectations (avec alerte push)
 * - Retards d'appels (> 72h sans tentative)
 * - Met à jour le badge sur l'écran d'accueil
 */
export function computeCounselorNotifications(
  souls: any[],
  currentUserId: string,
  currentUserName?: string
): {
  notifications: NotificationItem[];
  unreadCount: number;
  urgentCount: number;
} {
  if (!souls || souls.length === 0 || !currentUserId) {
    updateAppBadge(0);
    return { notifications: [], unreadCount: 0, urgentCount: 0 };
  }

  const readIds = getReadNotificationIds();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Charger les âmes déjà connues pour détecter les nouvelles affectations
  let knownIds = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${KNOWN_ASSIGNED_KEY}_${currentUserId}`);
      if (raw) knownIds = new Set(JSON.parse(raw));
    } catch {
      // ignore
    }
  }

  // Charger les dates des dernières notifications de retard pour ne pas spammer
  let notifiedDelayedMap: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${NOTIFIED_DELAYED_KEY}_${currentUserId}`);
      if (raw) notifiedDelayedMap = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  const generatedNotifications: NotificationItem[] = [];
  const currentAssignedSoulIds = new Set<string>();

  const isInitialLoadForCounselor = knownIds.size === 0;

  for (const soul of souls) {
    // Filtrage des exclusions : si appel abouti, conservé, sans suite, faux numéro, etc.
    const isConserved = soul.statut_affectation === "conserve" || /\[STATUT:\s*conserve\]/i.test(soul.commentaire_suivi || "");
    const isSansSuite = soul.statut_affectation === "sans_suite" || /\[STATUT:\s*sans_suite\]/i.test(soul.commentaire_suivi || "");
    const isFauxNumero = soul.faux_numero === true || /\[FAUX_NUMERO\]/i.test(soul.commentaire_suivi || "");
    const isNeDecrochePas = soul.ne_decroche_pas === true || /\[NE_DECROCHE_PAS\]/i.test(soul.commentaire_suivi || "");
    const isDone = soul.appel_abouti === true || isConserved || isSansSuite || isFauxNumero || isNeDecrochePas;

    if (isDone) continue;

    // Vérifier si cette âme est assignée à ce conseiller
    const matchesId = soul.assigned_to === currentUserId;
    const matchesName = currentUserName && soul.responsible && (
      soul.responsible.toLowerCase().trim() === currentUserName.toLowerCase().trim() ||
      soul.responsible.toLowerCase().includes(currentUserName.toLowerCase().trim())
    );

    if (!matchesId && !matchesName) continue;

    currentAssignedSoulIds.add(soul.id);

    // Calculer les jours écoulés depuis l'arrivée
    let daysElapsed = 0;
    if (soul.arrival_date) {
      const diffMs = Date.now() - new Date(soul.arrival_date).getTime();
      daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Tentative récente ?
    const tentativeMatch = soul.commentaire_suivi?.match(/\[TENTATIVE:([^\]]+)\]/);
    let hasRecentTentative = false;
    if (tentativeMatch) {
      const date = new Date(tentativeMatch[1]);
      const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
      hasRecentTentative = diffHours < 72; // Moins de 3 jours
    }

    const soulFullName = [soul.civility, soul.first_name, soul.last_name].filter(Boolean).join(" ").trim() || "Invité(e)";

    // 1. DÉTECTION NOUVELLE AFFECTATION
    const isNewAssignment = !knownIds.has(soul.id);
    const assignNotifId = `assign_${soul.id}`;

    if (isNewAssignment && !isInitialLoadForCounselor) {
      // Déclencher une notification Push Système si la permission est accordée
      void showSystemNotification("✨ Nouvel invité confié !", {
        body: `${soulFullName} vous a été confié(e). Prenez contact rapidement !`,
        tag: `new-guest-${soul.id}`,
        url: "/dashboard/affectation",
        data: { guestId: soul.id }
      });
    }

    // Ajouter la notification d'affectation
    generatedNotifications.push({
      id: assignNotifId,
      type: "new_assignment",
      title: "Nouvelle âme confiée",
      message: `${soulFullName} vous a été confié(e) pour le suivi pastoral.`,
      guestId: soul.id,
      guestName: soulFullName,
      phone: soul.phone,
      email: soul.email,
      arrivalDate: soul.arrival_date,
      daysElapsed,
      isRead: readIds.has(assignNotifId),
      isUrgent: false,
      timestamp: soul.arrival_date || new Date().toISOString()
    });

    // 2. DÉTECTION RETARD D'APPEL (si > 72h / 3 jours sans tentative récente)
    const isDelayed = !hasRecentTentative && daysElapsed >= 2;
    if (isDelayed) {
      const delayNotifId = `delay_${soul.id}`;
      const isUrgent = daysElapsed >= 3;

      // Envoyer une notification Push système (maximum 1 fois par jour pour cette âme)
      const lastNotifiedDate = notifiedDelayedMap[soul.id];
      if (lastNotifiedDate !== todayStr && Notification.permission === "granted") {
        void showSystemNotification("⏰ Rappel d'appel pastoral", {
          body: `${soulFullName} attend votre appel depuis ${daysElapsed > 0 ? `${daysElapsed} jours` : "plusieurs jours"}. Prenez un moment pour le contacter.`,
          tag: `delay-${soul.id}`,
          url: "/dashboard/affectation",
          data: { guestId: soul.id }
        });
        notifiedDelayedMap[soul.id] = todayStr;
      }

      generatedNotifications.push({
        id: delayNotifId,
        type: "call_delayed",
        title: isUrgent ? "Appel urgent en attente" : "Rappel d'appel de bienvenue",
        message: `${soulFullName} attend votre appel depuis ${daysElapsed} jour${daysElapsed > 1 ? "s" : ""}.`,
        guestId: soul.id,
        guestName: soulFullName,
        phone: soul.phone,
        email: soul.email,
        arrivalDate: soul.arrival_date,
        daysElapsed,
        isRead: readIds.has(delayNotifId),
        isUrgent: true,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Sauvegarder les âmes connues
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        `${KNOWN_ASSIGNED_KEY}_${currentUserId}`,
        JSON.stringify(Array.from(currentAssignedSoulIds))
      );
      localStorage.setItem(
        `${NOTIFIED_DELAYED_KEY}_${currentUserId}`,
        JSON.stringify(notifiedDelayedMap)
      );
    } catch {
      // ignore
    }
  }

  // Trier par urgence et par date
  generatedNotifications.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return b.daysElapsed - a.daysElapsed;
  });

  const unreadCount = generatedNotifications.filter((n) => !n.isRead).length;
  const urgentCount = generatedNotifications.filter((n) => n.isUrgent && !n.isRead).length;

  // Mise à jour de l'icône de l'application sur l'écran d'accueil du téléphone
  updateAppBadge(unreadCount > 0 ? unreadCount : 0);

  return {
    notifications: generatedNotifications,
    unreadCount,
    urgentCount
  };
}
