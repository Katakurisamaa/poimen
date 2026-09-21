"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getActiveUserInfo, getActiveContext } from "@/lib/client-session";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./SoulContactReminder.module.css";
import {
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Flame,
  Clock,
  HeartHandshake,
  BarChart2,
  ShieldCheck,
  RotateCw
} from "lucide-react";

export interface UncontactedSoul {
  id: string;
  first_name: string;
  last_name: string;
  civility?: string;
  phone?: string;
  email?: string;
  arrival_date?: string;
  event?: string;
  assigned_to?: string;
  responsible?: string;
  appel_abouti?: boolean;
  souhaite_etre_contacte?: boolean;
  local_church?: boolean;
  commentaire_suivi?: string;
}

export default function SoulContactReminder() {
  const [souls, setSouls] = useState<UncontactedSoul[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [phoneEditId, setPhoneEditId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { notify } = useFeedback();

  // Helper to extract tentative status from commentaire_suivi
  const getTentativeInfo = useCallback((soul: UncontactedSoul) => {
    const match = soul.commentaire_suivi?.match(/\[TENTATIVE:([^\]]+)\]/);
    if (match) {
      const date = new Date(match[1]);
      const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
      const isRecent = diffHours < 72; // Moins de 3 jours (72h)
      return {
        hasTentative: true,
        isRecent,
        date,
        hoursAgo: Math.max(1, Math.round(diffHours)),
        daysAgo: Math.floor(diffHours / 24)
      };
    }
    return { hasTentative: false, isRecent: false, date: null, hoursAgo: 0, daysAgo: 0 };
  }, []);

  const fetchUncontactedSouls = useCallback(async () => {
    try {
      const user = getActiveUserInfo();
      const context = getActiveContext();
      const selectedFamily = typeof window !== "undefined" ? localStorage.getItem("selected_family") : null;
      const isFamilySpace = context?.context_type === "family" || (Boolean(selectedFamily) && context?.context_type !== "integration");

      if (!user || isFamilySpace) {
        setSouls([]);
        setLoading(false);
        return;
      }

      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

      // Query invites for current church
      let query = supabase
        .from("invites")
        .select("id, first_name, last_name, civility, phone, email, arrival_date, event, assigned_to, responsible, appel_abouti, souhaite_etre_contacte, local_church, commentaire_suivi")
        .or(`appel_abouti.is.null,appel_abouti.eq.false`)
        .neq("archived", true)
        .neq("souhaite_etre_contacte", false);

      if (user.church_id) {
        query = query.eq("church_id", user.church_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Erreur récupération rappels âmes:", error);
        return;
      }

      if (data) {
        // Filter strictly to those assigned to this user
        const assignedToMe = data.filter((item) => {
          const matchesId = user.id && item.assigned_to === user.id;
          const matchesName = userName && (
            item.responsible?.toLowerCase().trim() === userName.toLowerCase() ||
            item.responsible?.toLowerCase().includes(userName.toLowerCase())
          );
          if (!matchesId && !matchesName) return false;

          const hasPhone = Boolean(item.phone && item.phone.trim() !== "");

          // RÈGLE D'EXCLUSION AUTOMATIQUE :
          // S'applique UNIQUEMENT aux personnes SANS numéro qui ont déjà une église locale.
          if (!hasPhone && item.local_church === true) {
            return false;
          }

          return true;
        });

        setSouls(assignedToMe);

        // Count urgent souls (those without any recent tentative within 3 days)
        const urgentCount = assignedToMe.filter((s) => {
          const match = s.commentaire_suivi?.match(/\[TENTATIVE:([^\]]+)\]/);
          if (!match) return true;
          const date = new Date(match[1]);
          const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
          return diffHours >= 72;
        }).length;

        // Broadcast count so Sidebar and navigation badges show the urgent count
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("poimen:uncontacted-count", {
              detail: { count: urgentCount }
            })
          );
        }
      }
    } catch (err) {
      console.error("Erreur inattendue rappels âmes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUncontactedSouls();

    // Listen to local soul update events
    const handleSoulUpdate = () => {
      fetchUncontactedSouls();
    };

    window.addEventListener("poimen:soul-updated", handleSoulUpdate);
    window.addEventListener("poimen-session-change", fetchUncontactedSouls);

    // Supabase Realtime subscription
    const channel = supabase
      .channel("soul-contact-reminders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invites" },
        () => {
          fetchUncontactedSouls();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("poimen:soul-updated", handleSoulUpdate);
      window.removeEventListener("poimen-session-change", fetchUncontactedSouls);
      supabase.removeChannel(channel);
    };
  }, [fetchUncontactedSouls]);

  // Option A : Enregistrer une tentative d'appel (affectation prise en compte)
  const handleMarkTentativeDone = async (soul: UncontactedSoul) => {
    setUpdatingId(soul.id);
    try {
      const nowIso = new Date().toISOString();
      const dateStr = new Date().toLocaleDateString("fr-FR");
      const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const stamp = `[TENTATIVE:${nowIso}] Appel tenté le ${dateStr} à ${timeStr} (sonné / message laissé)`;
      
      // Clean previous tentative tag if exists and prepend new one
      const cleanPrev = (soul.commentaire_suivi || "").replace(/\[TENTATIVE:[^\]]+\]\s*/g, "");
      const newComment = cleanPrev ? `${stamp}\n${cleanPrev}` : stamp;

      const { error } = await supabase
        .from("invites")
        .update({ commentaire_suivi: newComment })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`Prise en compte validée pour ${soul.first_name} ! Tentative enregistrée, relance suspendue pour 3 jours.`);
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de l'enregistrement de la tentative.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Clôturer définitivement le suivi : Contact établi (Appel abouti)
  const handleMarkCallDone = async (soul: UncontactedSoul) => {
    setUpdatingId(soul.id);
    try {
      const { error } = await supabase
        .from("invites")
        .update({
          appel_abouti: true,
          commentaire_suivi: (soul.commentaire_suivi ? soul.commentaire_suivi + "\n" : "") + "Contact établi (appel abouti le " + new Date().toLocaleDateString("fr-FR") + ")"
        })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`Contact téléphonique réussi avec ${soul.first_name} ${soul.last_name} ! Gloire à Dieu.`);
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de l'enregistrement de l'appel. Réessayez.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Clôturer pour une personne SANS NUMÉRO : "Stats uniquement / Déjà une église"
  // (Strictement réservé aux personnes sans numéro selon vos consignes)
  const handleMarkVisitorStatsOnly = async (soul: UncontactedSoul) => {
    setUpdatingId(soul.id);
    try {
      const stamp = `[STATS_UNIQUEMENT] Visiteur / Conservé pour statistiques du culte (sans numéro le ${new Date().toLocaleDateString("fr-FR")})`;
      const cleanPrev = soul.commentaire_suivi || "";
      const newComment = cleanPrev ? `${stamp}\n${cleanPrev}` : stamp;

      const { error } = await supabase
        .from("invites")
        .update({
          local_church: true,
          souhaite_etre_contacte: false,
          commentaire_suivi: newComment
        })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`${soul.first_name} ${soul.last_name} conservé(e) pour les statistiques du culte (suivi pastoral clôturé).`);
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Mark soul as contacted via Email
  const handleMarkEmailDone = async (soul: UncontactedSoul) => {
    setUpdatingId(soul.id);
    try {
      const { error } = await supabase
        .from("invites")
        .update({
          appel_abouti: true,
          commentaire_suivi: (soul.commentaire_suivi ? soul.commentaire_suivi + "\n" : "") + "Contact établi par e-mail le " + new Date().toLocaleDateString("fr-FR")
        })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`Contact établi par e-mail avec ${soul.first_name} ${soul.last_name}.`);
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Mark soul as contacted in person / at church
  const handleMarkInPersonDone = async (soul: UncontactedSoul) => {
    setUpdatingId(soul.id);
    try {
      const { error } = await supabase
        .from("invites")
        .update({
          appel_abouti: true,
          rencontre_effectuee: true,
          commentaire_suivi: (soul.commentaire_suivi ? soul.commentaire_suivi + "\n" : "") + "Rencontre effectuée en personne au culte le " + new Date().toLocaleDateString("fr-FR")
        })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`Prise de contact en personne confirmée pour ${soul.first_name} ${soul.last_name} !`);
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de l'enregistrement.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Save new phone number
  const handleSavePhone = async (soul: UncontactedSoul) => {
    if (!phoneInput.trim()) return;
    setUpdatingId(soul.id);
    try {
      const { error } = await supabase
        .from("invites")
        .update({ phone: phoneInput.trim() })
        .eq("id", soul.id);

      if (error) throw error;

      notify(`Numéro ajouté pour ${soul.first_name} ! Vous pouvez maintenant l'appeler.`);
      setPhoneEditId(null);
      setPhoneInput("");
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: soul.id } }));
      fetchUncontactedSouls();
    } catch (err) {
      console.error(err);
      notify("Erreur lors de l'enregistrement du numéro.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Calculate elapsed days
  const getElapsedDays = (arrivalDate?: string) => {
    if (!arrivalDate) return null;
    const diffTime = Math.abs(new Date().getTime() - new Date(arrivalDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const urgentSouls = useMemo(() => {
    return souls.filter((s) => !getTentativeInfo(s).isRecent);
  }, [souls, getTentativeInfo]);

  const inProgressSouls = useMemo(() => {
    return souls.filter((s) => getTentativeInfo(s).isRecent);
  }, [souls, getTentativeInfo]);

  if (loading || souls.length === 0) {
    return null;
  }

  const allTentativesMade = urgentSouls.length === 0 && inProgressSouls.length > 0;

  // Persistent floating reminder when collapsed
  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.floatingPill}
        onClick={() => setCollapsed(false)}
        title="Ouvrir les rappels de contact pastoraux"
      >
        <Flame size={16} />
        <span>
          {urgentSouls.length > 0
            ? `${urgentSouls.length} âme${urgentSouls.length > 1 ? "s" : ""} à contacter !`
            : `${inProgressSouls.length} suivi${inProgressSouls.length > 1 ? "s" : ""} en cours`}
        </span>
      </button>
    );
  }

  return (
    <div className={styles.reminderContainer}>
      <div className={styles.reminderHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.alertIconBox}>
            <Flame size={22} />
          </div>
          <div className={styles.headerTitles}>
            <h3>
              {allTentativesMade
                ? "Affectations prises en compte (Tentatives effectuées)"
                : "Rappel d'Amour & Suivi Pastoral"}
              <span className={styles.urgentBadge}>
                {urgentSouls.length > 0
                  ? `${urgentSouls.length} urgente${urgentSouls.length > 1 ? "s" : ""}`
                  : "En veille douce"}
              </span>
            </h3>
            <p>
              {allTentativesMade
                ? `Toutes vos âmes ont été prises en charge (${inProgressSouls.length} en attente de réponse). Relance suspendue pour 3 jours.`
                : `${souls.length} âme${souls.length > 1 ? "s vous ont été confiées" : " vous a été confiée"}. Marquez vos tentatives d'appel ou validez la prise de contact.`}
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed(true)}
            title="Réduire l'alerte"
          >
            <ChevronUp size={16} />
            <span>Réduire</span>
          </button>
        </div>
      </div>

      <div className={styles.soulsList}>
        {souls.map((soul) => {
          const days = getElapsedDays(soul.arrival_date);
          const hasPhone = Boolean(soul.phone && soul.phone.trim() !== "");
          const hasEmail = Boolean(soul.email && soul.email.trim() !== "");
          const isSavingThis = updatingId === soul.id;
          const tentativeInfo = getTentativeInfo(soul);

          return (
            <div key={soul.id} className={styles.soulCard}>
              <div className={styles.soulCardTop}>
                <div>
                  <h4 className={styles.soulName}>
                    {soul.civility ? `${soul.civility} ` : ""}
                    {soul.first_name} {soul.last_name}
                  </h4>
                  <div className={styles.soulDate}>
                    <Clock size={12} />
                    <span>
                      Arrivé(e) le{" "}
                      {soul.arrival_date
                        ? new Date(soul.arrival_date).toLocaleDateString("fr-FR")
                        : "date non précisée"}
                    </span>
                    {days !== null && days > 0 && (
                      <span className={styles.daysTag}>
                        il y a {days}j
                      </span>
                    )}
                  </div>
                </div>

                {hasPhone ? (
                  tentativeInfo.isRecent ? (
                    <span className={styles.statusPillTentative} title="Tentative effectuée, relance en veille douce">
                      <Clock size={12} />
                      Tentative {tentativeInfo.hoursAgo < 24 ? `il y a ${tentativeInfo.hoursAgo}h` : `il y a ${tentativeInfo.daysAgo}j`}
                    </span>
                  ) : (
                    <span className={styles.statusPillWithPhone}>
                      <Phone size={12} />
                      {soul.phone}
                    </span>
                  )
                ) : (
                  <span className={styles.statusPillNoPhone}>
                    <AlertTriangle size={12} />
                    Sans numéro
                  </span>
                )}
              </div>

              {/* In case phone is missing and user clicked "Renseigner le numéro" */}
              {phoneEditId === soul.id ? (
                <div className={styles.phoneForm}>
                  <input
                    type="tel"
                    placeholder="Ex: 06 12 34 56 78"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className={styles.phoneInput}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.savePhoneBtn}
                    onClick={() => handleSavePhone(soul)}
                    disabled={isSavingThis}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setPhoneEditId(null);
                      setPhoneInput("");
                    }}
                  >
                    Annuler
                  </button>
                </div>
              ) : null}

              <div className={styles.actionsRow}>
                {hasPhone ? (
                  <>
                    <a
                      href={`tel:${soul.phone}`}
                      className={styles.callBtn}
                      title={`Appeler ${soul.first_name}`}
                    >
                      <Phone size={13} />
                      Appeler
                    </a>

                    {/* Option A : Tentative effectuée (apaise l'alerte pour 3 jours) */}
                    <button
                      type="button"
                      className={styles.tentativeBtn}
                      onClick={() => handleMarkTentativeDone(soul)}
                      disabled={isSavingThis}
                      title="Signaler que vous avez essayé d'appeler (message vocal / sonné). Suspend la relance pour 3 jours."
                    >
                      <Clock size={13} />
                      {tentativeInfo.isRecent ? "Nouvelle tentative" : "Tentative effectuée"}
                    </button>

                    {/* Contact établi définitif */}
                    <button
                      type="button"
                      className={styles.doneBtn}
                      onClick={() => handleMarkCallDone(soul)}
                      disabled={isSavingThis}
                      title="Enregistrer que le contact a réellement abouti"
                    >
                      <CheckCircle2 size={13} />
                      Contact établi
                    </button>
                  </>
                ) : (
                  <>
                    {/* CAS SANS NUMÉRO : Boutons dédiés */}
                    {hasEmail && (
                      <>
                        <a
                          href={`mailto:${soul.email}?subject=Bienvenue%20%C3%A0%20Impact%20Centre%20Chr%C3%A9tien&body=Bonjour%20${encodeURIComponent(soul.first_name)}%2C%0A%0ANous%20sommes%20ravis%20de%20vous%20avoir%20accueilli%28e%29%20parmi%20nous%20!`}
                          className={styles.secondaryBtn}
                          title={`Envoyer un email à ${soul.email}`}
                        >
                          <Mail size={12} />
                          Écrire
                        </a>
                        <button
                          type="button"
                          className={styles.doneBtn}
                          onClick={() => handleMarkEmailDone(soul)}
                          disabled={isSavingThis}
                          title="Confirmer que le contact a été établi par email"
                        >
                          <CheckCircle2 size={12} />
                          Contacté par email
                        </button>
                      </>
                    )}

                    {phoneEditId !== soul.id && (
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setPhoneEditId(soul.id);
                          setPhoneInput("");
                        }}
                        title="Ajouter un numéro de téléphone si vous l'avez obtenu"
                      >
                        <Plus size={12} />
                        Ajouter tél
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => handleMarkInPersonDone(soul)}
                      disabled={isSavingThis}
                      title="Confirmer que vous l'avez vu et accueilli en personne"
                    >
                      <HeartHandshake size={12} />
                      Vu en personne
                    </button>

                    {/* Bouton rapide STRICTEMENT pour les personnes sans numéro : Stats uniquement / Déjà une église */}
                    <button
                      type="button"
                      className={styles.statsOnlyBtn}
                      onClick={() => handleMarkVisitorStatsOnly(soul)}
                      disabled={isSavingThis}
                      title="Conserver cette personne dans les statistiques du culte sans relance de suivi pastoral (visiteur de passage / sans coordonnées)"
                    >
                      <BarChart2 size={12} />
                      Stats uniquement
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
