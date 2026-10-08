"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  Phone,
  Flame,
  UserPlus,
  CheckCircle2,
  ChevronRight,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveUserInfo, getActiveContext } from "@/lib/client-session";
import {
  NotificationItem,
  computeCounselorNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  isNotificationSupported
} from "@/lib/notifications";
import styles from "./NotificationCenter.module.css";

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "delayed">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">("default");
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 90, right: 20 });

  const toggleNotifications = () => {
    if (!isOpen) {
      setPushStatus(getNotificationPermission());
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setPopoverPosition({
          top: Math.round(rect.bottom + 10),
          right: Math.max(12, Math.round(window.innerWidth - rect.right))
        });
      }
    }
    setIsOpen((open) => !open);
  };

  const loadNotifications = useCallback(async () => {
    try {
      const user = getActiveUserInfo();
      const context = getActiveContext();
      const selectedFamily = typeof window !== "undefined" ? localStorage.getItem("selected_family") : null;
      const isFamilySpace = context?.context_type === "family" || (Boolean(selectedFamily) && context?.context_type !== "integration");

      if (!user || isFamilySpace) {
        setNotifications([]);
        setUnreadCount(0);
        setUrgentCount(0);
        return;
      }

      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

      // Récupérer les âmes attribuées pour l'église courante
      let query = supabase
        .from("invites")
        .select("*")
        .or("appel_abouti.is.null,appel_abouti.eq.false")
        .neq("archived", true)
        .neq("souhaite_etre_contacte", false);

      if (user.church_id) {
        query = query.eq("church_id", user.church_id);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("[NotificationCenter] Erreur récupération âmes:", error.message);
        return;
      }

      if (data) {
        const computed = computeCounselorNotifications(data, user.id, userName);
        setNotifications(computed.notifications);
        setUnreadCount(computed.unreadCount);
        setUrgentCount(computed.urgentCount);
      }
    } catch (err) {
      console.warn("[NotificationCenter] Erreur calcul notifications:", err);
    }
  }, []);

  useEffect(() => {
    // Keep the first page paint independent of the notification refresh.
    const initialRefresh = requestAnimationFrame(() => { void loadNotifications(); });

    // Événements locaux
    const handleUpdate = () => loadNotifications();
    window.addEventListener("poimen:soul-updated", handleUpdate);
    window.addEventListener("poimen:notifications-changed", handleUpdate);
    window.addEventListener("poimen-session-change", handleUpdate);

    // Écoute Supabase Realtime
    const channel = supabase
      .channel("counselor-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invites" },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      cancelAnimationFrame(initialRefresh);
      window.removeEventListener("poimen:soul-updated", handleUpdate);
      window.removeEventListener("poimen:notifications-changed", handleUpdate);
      window.removeEventListener("poimen-session-change", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  // Fermer la popover si on clique en dehors
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target) ||
        backdropRef.current?.contains(target)
      ) {
        return;
      }
      if (containerRef.current) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (e.key === "Tab" && popoverRef.current) {
        const focusable = Array.from(
          popoverRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
          )
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const handleActivatePush = async () => {
    const success = await requestNotificationPermission();
    setPushStatus(getNotificationPermission());
    if (success) {
      // Re-synchroniser
      loadNotifications();
    }
  };

  const handleMarkAllRead = () => {
    const ids = notifications.map((n) => n.id);
    markAllNotificationsAsRead(ids);
    loadNotifications();
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markNotificationAsRead(item.id);
      loadNotifications();
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "new") return notifications.filter((n) => n.type === "new_assignment");
    if (filter === "delayed") return notifications.filter((n) => n.type === "call_delayed");
    return notifications;
  }, [notifications, filter]);

  const showPushPrompt = isNotificationSupported() && pushStatus === "default";

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Bouton cloche */}
      <button
        type="button"
        className={`${styles.bellButton} ${urgentCount > 0 ? styles.hasUrgent : ""}`}
        onClick={toggleNotifications}
        aria-label="Centre de notifications et alertes"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="notification-center-dialog"
        title={unreadCount > 0 ? `${unreadCount} notification(s) en attente` : "Notifications"}
      >
        <Bell size={18} className={styles.bellIcon} />
        {unreadCount > 0 && (
          <span className={`${styles.badge} ${urgentCount > 0 ? styles.badgeUrgent : ""}`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && typeof document !== "undefined" && createPortal((
        <>
          <div ref={backdropRef} className={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div
            id="notification-center-dialog"
            ref={popoverRef}
            className={styles.popover}
            style={{ top: `${popoverPosition.top}px`, right: `${popoverPosition.right}px` }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-center-title"
          >
            {/* Header */}
            <div className={styles.header}>
              <h3 id="notification-center-title" className={styles.headerTitle}>
                <span>Notifications</span>
                {unreadCount > 0 && <span className={styles.countPill}>{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</span>}
              </h3>
              <div className={styles.headerActions}>
                {unreadCount > 0 && (
                  <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead} aria-label="Tout marquer comme lu">
                    <span className={styles.markAllFull}>Tout marquer comme lu</span>
                    <span className={styles.markAllCompact}>Tout lire</span>
                  </button>
                )}
                <button
                  type="button"
                  ref={closeButtonRef}
                  className={styles.closeBtn}
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer les notifications"
                  title="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Bannière Push Notifications si non activées */}
            {showPushPrompt && (
              <div className={styles.pushBanner}>
                <Bell size={18} className={styles.pushBannerIcon} />
                <div className={styles.pushBannerText}>
                  <strong>Ne manquez aucune alerte</strong>
                  <p>Invité confié ou appel à relancer, même appli fermée.</p>
                </div>
                <button type="button" className={styles.activatePushBtn} onClick={handleActivatePush}>
                  <Bell size={12} />
                  Activer
                </button>
              </div>
            )}

            {/* Onglets de filtrage */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${filter === "all" ? styles.tabActive : ""}`}
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${filter === "new" ? styles.tabActive : ""}`}
                onClick={() => setFilter("new")}
                aria-pressed={filter === "new"}
              >
                Nouvelles ({notifications.filter((n) => n.type === "new_assignment").length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${filter === "delayed" ? styles.tabActive : ""}`}
                onClick={() => setFilter("delayed")}
                aria-pressed={filter === "delayed"}
              >
                Relances ({notifications.filter((n) => n.type === "call_delayed").length})
              </button>
            </div>

            {/* Liste des notifications */}
            <div className={styles.list}>
              {filteredNotifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <CheckCircle2 size={32} className={styles.emptyIcon} />
                  <h4>Aucune alerte en attente</h4>
                  <p>Vous êtes à jour dans vos prises de contact pastorales. Que Dieu vous bénisse !</p>
                </div>
              ) : (
                filteredNotifications.map((item) => {
                  const isNew = item.type === "new_assignment";
                  return (
                    <div
                      key={item.id}
                      className={`${styles.item} ${!item.isRead ? styles.itemUnread : ""} ${
                        item.isUrgent ? styles.itemUrgent : ""
                      }`}
                      onClick={() => handleItemClick(item)}
                    >
                      <div
                        className={`${styles.itemIconBox} ${
                          item.isUrgent ? styles.itemIconBoxUrgent : ""
                        }`}
                      >
                        {isNew ? <UserPlus size={16} /> : <Flame size={16} />}
                      </div>

                      <div className={styles.itemContent}>
                        <div className={styles.itemTop}>
                          <h4 className={styles.itemTitle}>{item.title}</h4>
                          <span className={styles.itemTime}>
                            {item.daysElapsed > 0 ? `il y a ${item.daysElapsed}j` : "Aujourd'hui"}
                          </span>
                        </div>

                        <p className={styles.itemDesc}>{item.message}</p>

                        <div className={styles.itemActions}>
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              className={`${styles.callBtn} ${
                                item.isUrgent ? styles.callBtnUrgent : ""
                              }`}
                              aria-label={`Appeler ${item.guestName}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone size={11} />
                              Appeler
                            </a>
                          )}
                          <Link
                            href={`/dashboard/affectation?filter=mine`}
                            className={styles.viewBtn}
                            onClick={() => setIsOpen(false)}
                          >
                            <span>Voir la fiche</span>
                            <ChevronRight size={12} />
                          </Link>
                        </div>
                      </div>

                      {!item.isRead && (
                        <span
                          className={`${styles.unreadDot} ${
                            item.isUrgent ? styles.unreadDotUrgent : ""
                          }`}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <small>
                {pushStatus === "granted"
                  ? "✓ Notifications actives sur cet appareil"
                  : "Notifications locales"}
              </small>
              <Link
                href="/dashboard/affectation?filter=mine"
                className={styles.viewAllLink}
                onClick={() => setIsOpen(false)}
              >
                Toutes mes âmes →
              </Link>
            </div>
          </div>
        </>
      ), document.body)}
    </div>
  );
}
