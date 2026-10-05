"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Phone,
  Flame,
  UserPlus,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
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

  // Synchroniser le statut des permissions de notifications
  useEffect(() => {
    setPushStatus(getNotificationPermission());
  }, []);

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
    loadNotifications();

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
      window.removeEventListener("poimen:soul-updated", handleUpdate);
      window.removeEventListener("poimen:notifications-changed", handleUpdate);
      window.removeEventListener("poimen-session-change", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  // Fermer la popover si on clique en dehors
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
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
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Centre de notifications et alertes"
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
      {isOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.popover} role="dialog" aria-modal="true" aria-label="Notifications pastorales">
            {/* Header */}
            <div className={styles.header}>
              <h3 className={styles.headerTitle}>
                <span>Notifications</span>
                {unreadCount > 0 && <span className={styles.countPill}>{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</span>}
              </h3>
              {unreadCount > 0 && (
                <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead}>
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Bannière Push Notifications si non activées */}
            {showPushPrompt && (
              <div className={styles.pushBanner}>
                <Sparkles size={18} className={styles.pushBannerIcon} />
                <div className={styles.pushBannerText}>
                  <strong>Alertes sur votre écran d'accueil</strong>
                  <p>Soyez averti(e) dès qu'un invité vous est confié ou qu'un appel tarde, même appli fermée.</p>
                  <button type="button" className={styles.activatePushBtn} onClick={handleActivatePush}>
                    <Bell size={12} />
                    Activer les alertes
                  </button>
                </div>
              </div>
            )}

            {/* Onglets de filtrage */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${filter === "all" ? styles.tabActive : ""}`}
                onClick={() => setFilter("all")}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${filter === "new" ? styles.tabActive : ""}`}
                onClick={() => setFilter("new")}
              >
                Nouvelles ({notifications.filter((n) => n.type === "new_assignment").length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${filter === "delayed" ? styles.tabActive : ""}`}
                onClick={() => setFilter("delayed")}
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
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone size={11} />
                              Appeler {item.guestName.split(" ")[0]}
                            </a>
                          )}
                          <Link
                            href={`/dashboard/affectation?filter=mine`}
                            className={styles.viewBtn}
                            onClick={() => setIsOpen(false)}
                          >
                            <span>Voir fiche</span>
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
      )}
    </div>
  );
}
