"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Video, Users, Share2, Copy, Check, Monitor,
  House, UserCheck, MessageSquare, ArrowLeft, Play, Link as LinkIcon, BarChart2, LockKeyhole
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { getActiveUserInfo, getActiveSpaceType } from "@/lib/client-session";
import { 
  buildRoomName, 
  getPublicVisioUrl, 
  getWhatsAppShareUrl, 
  sanitizeRoomName,
  type VisioSpaceType 
} from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import VideoConference from "@/components/visio/VideoConference";
import InteractivePollPanel from "@/components/visio/InteractivePollPanel";
import VisioPreflight, { type VisioDeviceSelection } from "@/components/visio/VisioPreflight";
import styles from "./VisioDashboard.module.css";

export default function VisioPage() {
  return (
    <Suspense fallback={null}>
      <VisioContent />
    </Suspense>
  );
}

function VisioContent() {
  const [mounted, setMounted] = useState(false);
  const workspace = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useFeedback();

  useEffect(() => {
    setMounted(true);
  }, []);

  const user = getActiveUserInfo();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || workspace.name || "Responsable";
  const userEmail = user?.email || "";

  // Query params
  const paramRoom = searchParams.get("room") || "";
  const paramType = (searchParams.get("type") as VisioSpaceType) || "";
  const paramGuestName = searchParams.get("guestName") || "";
  const paramGuestId = searchParams.get("guestId") || "";
  const paramTitle = searchParams.get("title") || "";

  // Respect workspace lanes strictly ("Chacun reste dans son couloir")
  const spaceType = getActiveSpaceType();
  const isIntegration = spaceType === "integration" || (!workspace.hasFamily && (workspace.role.includes("integration") || workspace.isConseiller));
  const isFamily = (spaceType === "family" || workspace.hasFamily) && !isIntegration;
  const isAdmin = Boolean(workspace.isSuperAdmin || workspace.role === "admin");

  // Determine allowed tabs strictly according to context
  const allowedTabs: { id: VisioSpaceType; label: string; icon: typeof House }[] = useMemo(() => {
    if (isAdmin) {
      return [
        { id: "integration", label: "Équipe d'Intégration", icon: Users },
        { id: "guest", label: "Entretien de Suivi / Invité", icon: UserCheck },
        { id: "family", label: "Famille de disciples (Cellule)", icon: House },
        { id: "custom", label: "Salle Personnalisée", icon: MessageSquare },
      ];
    }

    if (isIntegration) {
      return [
        { id: "integration", label: "Équipe d'Intégration", icon: Users },
        { id: "guest", label: "Entretien de Suivi / Invité", icon: UserCheck },
        { id: "custom", label: "Salle Personnalisée", icon: MessageSquare },
      ];
    }

    // Default: Famille de disciples
    return [
      { id: "family", label: `Réunion de Famille (${workspace.familyName || "Cellule"})`, icon: House },
      { id: "guest", label: "Entretien individuel", icon: UserCheck },
      { id: "custom", label: "Salle Personnalisée", icon: MessageSquare },
    ];
  }, [isAdmin, isIntegration, workspace.familyName]);

  // Determine initial active tab
  const initialTab: VisioSpaceType = useMemo(() => {
    if (paramType && allowedTabs.some(t => t.id === paramType)) {
      return paramType;
    }
    if (paramGuestName || paramGuestId) return "guest";
    return allowedTabs[0]?.id || "custom";
  }, [paramType, allowedTabs, paramGuestName, paramGuestId]);

  const [activeTab, setActiveTab] = useState<VisioSpaceType>(initialTab);
  const [inMeeting, setInMeeting] = useState<boolean>(Boolean(paramRoom));
  const [pollsOpen, setPollsOpen] = useState(false);

  // If activeTab is not in allowedTabs (e.g. following a state change), reset it
  useEffect(() => {
    if (!allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "custom");
    }
  }, [allowedTabs, activeTab]);

  // Field states
  const [customRoomInput, setCustomRoomInput] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [customRoomLoadedForKey, setCustomRoomLoadedForKey] = useState("");
  const [confirmDeleteCustomRoom, setConfirmDeleteCustomRoom] = useState(false);
  const [customRoomBusy, setCustomRoomBusy] = useState(false);
  const [customRoomError, setCustomRoomError] = useState("");
  const [guestNameInput, setGuestNameInput] = useState(paramGuestName || "");
  const [copied, setCopied] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [mediaDevices, setMediaDevices] = useState<VisioDeviceSelection>({});
  const customRoomStorageKey = `poimen:custom-visio-room:${sanitizeRoomName(`${user?.church_id || workspace.churchName || "icc"}-${user?.id || userEmail || "account"}`)}`;

  useEffect(() => {
    if (!mounted || !workspace.ready) return;

    setCustomRoomLoadedForKey("");
    setCustomRoomId("");
    setCustomRoomInput("");
    try {
      const stored = window.localStorage.getItem(customRoomStorageKey);
      if (stored) {
        const saved = JSON.parse(stored) as { roomName?: unknown; title?: unknown };
        if (typeof saved.roomName === "string" && saved.roomName.startsWith("poimen-prive-")) {
          setCustomRoomBusy(true);
          setCustomRoomId(saved.roomName);
          setCustomRoomInput(typeof saved.title === "string" ? saved.title : "");
          void fetch("/api/visio/custom-rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "register", roomName: saved.roomName, title: saved.title }),
          }).then(async response => {
            const result = await response.json().catch(() => ({})) as { error?: string };
            if (response.ok) return;
            if (response.status === 410) {
              window.localStorage.removeItem(customRoomStorageKey);
              setCustomRoomId(current => current === saved.roomName ? "" : current);
              setCustomRoomInput(current => current === saved.title ? "" : current);
              notify("Cette salle a déjà été supprimée. Son lien est désactivé.");
              return;
            }
            setCustomRoomError(result.error || "Impossible de vérifier cette salle.");
          }).catch(() => setCustomRoomError("Impossible de joindre le service de gestion des salles.")).finally(() => setCustomRoomBusy(false));
        }
      }
    } catch {
      window.localStorage.removeItem(customRoomStorageKey);
    }
    setCustomRoomLoadedForKey(customRoomStorageKey);
  }, [mounted, workspace.ready, customRoomStorageKey, notify]);

  useEffect(() => {
    if (!mounted || !workspace.ready || customRoomLoadedForKey !== customRoomStorageKey || !customRoomId) return;
    window.localStorage.setItem(customRoomStorageKey, JSON.stringify({
      roomName: customRoomId,
      title: customRoomInput.trim() || "Salle personnalisée",
    }));
  }, [mounted, workspace.ready, customRoomLoadedForKey, customRoomStorageKey, customRoomId, customRoomInput]);

  // Sync if params change
  useEffect(() => {
    if (paramRoom) {
      setInMeeting(true);
    }
    if (paramGuestName) {
      setGuestNameInput(paramGuestName);
    }
  }, [paramRoom, paramGuestName]);

  // Compute room name and title according to active tab
  const { roomName, meetingTitle, description } = useMemo(() => {
    if (paramRoom) {
      return {
        roomName: paramRoom,
        meetingTitle: paramTitle || "Réunion Poimén",
        description: "Rejoindre la salle spécifiée",
      };
    }

    const church = workspace.churchName || "ICC";

    if (activeTab === "family") {
      const familyName = workspace.familyName || "Cellule";
      const room = buildRoomName({
        churchName: church,
        spaceType: "family",
        familyOrContextName: familyName,
      });
      return {
        roomName: room,
        meetingTitle: `Réunion de Famille — ${familyName}`,
        description: `Cellule de maison et bergerie en ligne pour les membres de ${familyName}.`,
      };
    }

    if (activeTab === "integration") {
      const room = buildRoomName({
        churchName: church,
        spaceType: "integration",
      });
      return {
        roomName: room,
        meetingTitle: `Équipe d'Intégration — ${church}`,
        description: "Point d'équipe, debriefing dominical et coordination des conseillers.",
      };
    }

    if (activeTab === "guest") {
      const targetName = guestNameInput.trim() || (isFamily ? "Membre" : "Invité");
      const room = buildRoomName({
        churchName: church,
        spaceType: "guest",
        guestId: paramGuestId || sanitizeRoomName(targetName),
      });
      return {
        roomName: room,
        meetingTitle: `Entretien individuel — ${targetName}`,
        description: `Échange personnalisé en visioconférence avec ${targetName}.`,
      };
    }

    // custom tab
    const title = customRoomInput.trim() || "Salle personnalisée";
    return {
      roomName: customRoomId,
      meetingTitle: title,
      description: "Créez une salle nommée avec un lien d’invitation privé réutilisable.",
    };
  }, [
    paramRoom, 
    paramTitle,
    activeTab, 
    workspace, 
    guestNameInput, 
    customRoomInput, 
    customRoomId,
    paramGuestId,
    isFamily
  ]);

  const publicUrl = getPublicVisioUrl(
    roomName,
    activeTab === "guest" ? guestNameInput : undefined,
    activeTab === "custom" && customRoomId ? meetingTitle : undefined,
  );
  const whatsappUrl = getWhatsAppShareUrl({
    roomName,
    title: meetingTitle,
    guestName: activeTab === "guest" ? guestNameInput : undefined,
    roomTitle: activeTab === "custom" && customRoomId ? meetingTitle : undefined,
  });

  const handleCreateCustomRoom = async () => {
    const title = customRoomInput.trim();
    if (!title) {
      notify("Donnez un nom à votre salle avant de créer son lien.");
      return;
    }
    setCustomRoomBusy(true);
    setCustomRoomError("");
    try {
      const response = await fetch("/api/visio/custom-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title }),
      });
      const result = await response.json().catch(() => ({})) as { roomName?: string; error?: string };
      if (!response.ok || !result.roomName) throw new Error(result.error || "La création de la salle a échoué.");
      window.localStorage.setItem(customRoomStorageKey, JSON.stringify({ roomName: result.roomName, title }));
      setCustomRoomId(result.roomName);
      setCustomRoomLoadedForKey(customRoomStorageKey);
      setConfirmDeleteCustomRoom(false);
      notify("Votre lien privé réutilisable est prêt.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "La création de la salle a échoué.";
      setCustomRoomError(message);
      notify(message);
    } finally {
      setCustomRoomBusy(false);
    }
  };

  const handleDeleteCustomRoom = async () => {
    if (!customRoomId) return;
    setCustomRoomBusy(true);
    setCustomRoomError("");
    try {
      const response = await fetch(`/api/visio/custom-rooms?room=${encodeURIComponent(customRoomId)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "La suppression de la salle a échoué.");
      window.localStorage.removeItem(customRoomStorageKey);
      setCustomRoomId("");
      setCustomRoomInput("");
      setConfirmDeleteCustomRoom(false);
      setPollsOpen(false);
      setCopied(false);
      notify("Salle supprimée. Les liens partagés sont maintenant désactivés.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "La suppression de la salle a échoué.";
      setCustomRoomError(message);
      notify(message);
    } finally {
      setCustomRoomBusy(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      notify("Lien d'invitation copié !");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Impossible de copier le lien.");
    }
  };

  const handleShareWhatsApp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  if (!mounted || !workspace.ready) {
    return null;
  }

  return (
    <div className={styles.container}>
      {inMeeting ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button 
              type="button" 
              className={styles.btnSecondary}
              onClick={() => {
                if (!window.confirm("Voulez-vous quitter cet appel et revenir au tableau de bord ?")) return;
                setInMeeting(false);
                router.push("/dashboard/visio");
              }}
            >
              <ArrowLeft size={16} /> Retour au tableau de bord
            </button>
          </div>

          <div className={styles.meetingLayout}>
            <VideoConference
              roomName={roomName}
              title={meetingTitle}
              userName={userName}
              userEmail={userEmail}
              participantId={user?.id}
              guestName={activeTab === "guest" ? guestNameInput : undefined}
              mediaDevices={mediaDevices}
              isHost={true}
              onTogglePolls={() => setPollsOpen(!pollsOpen)}
              pollsOpen={pollsOpen}
              onLeave={() => {
                setInMeeting(false);
                router.push("/dashboard/visio");
              }}
            />

            {pollsOpen && (
              <InteractivePollPanel
                roomName={roomName}
                isHost={true}
                userName={userName}
                onClose={() => setPollsOpen(false)}
              />
            )}
          </div>
        </div>
      ) : showPreflight ? (
        <VisioPreflight
          name={userName}
          title={meetingTitle}
          onJoin={devices => {
            setMediaDevices(devices);
            setShowPreflight(false);
            setInMeeting(true);
          }}
          onCancel={() => setShowPreflight(false)}
        />
      ) : (
        <>
          <header className={styles.header}>
            <div className={styles.headerInfo}>
              <h1>
                <Video size={26} color="#d4af37" />
                {isIntegration 
                  ? "Visioconférence · Intégration" 
                  : isFamily 
                    ? `Visioconférence · ${workspace.familyName || "Famille de disciples"}`
                    : "Visioconférence & Partage d'écran"
                }
              </h1>
              <p>
                {isIntegration
                  ? "Organisez vos points d'équipe d'intégration et vos entretiens de suivi avec partage d'écran."
                  : isFamily
                    ? `Organisez vos réunions de cellule de maison et échanges pour ${workspace.familyName || "votre famille de disciples"}.`
                    : "Organisez vos réunions d'équipe et entretiens pastoraux avec partage d'écran."
                }
              </p>
            </div>
          </header>

          <nav className={styles.tabsBar} aria-label="Mode de visioconférence">
            {allowedTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                >
                  <Icon size={16} /> {tab.label}
                </button>
              );
            })}
          </nav>

          <section className={styles.cardSetup}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleGroup}>
                <div className={styles.cardIcon}>
                  {activeTab === "family" && <House size={24} />}
                  {activeTab === "integration" && <Users size={24} />}
                  {activeTab === "guest" && <UserCheck size={24} />}
                  {activeTab === "custom" && <MessageSquare size={24} />}
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{meetingTitle}</h3>
                  <p className={styles.cardDesc}>{description}</p>
                </div>
              </div>
            </div>

            {activeTab === "guest" && (
              <div className={styles.inputsRow}>
                <div className={styles.inputField}>
                  <label htmlFor="guest-name-field">
                    {isFamily ? "Nom de la personne" : "Prénom et Nom de l'invité(e)"}
                  </label>
                  <input
                    id="guest-name-field"
                    type="text"
                    placeholder={isFamily ? "Ex: Frère Marc, Sœur Marie..." : "Ex: Frère Thomas, Sœur Grâce..."}
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                  />
                </div>
              </div>
            )}

            {activeTab === "custom" && (
              <div className={styles.inputsRow}>
                <div className={styles.inputField}>
                  <label htmlFor="custom-room-field">Nom de la salle</label>
                  <input
                    id="custom-room-field"
                    type="text"
                    placeholder="Ex. Point hebdomadaire, prière du matin…"
                    maxLength={80}
                    value={customRoomInput}
                    onChange={(e) => setCustomRoomInput(e.target.value)}
                  />
                </div>
                <div className={styles.customRoomCreation}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleCreateCustomRoom}
                    disabled={customRoomBusy || !customRoomLoadedForKey || customRoomLoadedForKey !== customRoomStorageKey || !customRoomInput.trim()}
                  >
                    <LockKeyhole size={16} />
                    {customRoomBusy ? "Enregistrement…" : customRoomId ? "Générer un autre lien privé" : "Créer mon lien privé réutilisable"}
                  </button>
                  {customRoomId && !confirmDeleteCustomRoom && (
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => setConfirmDeleteCustomRoom(true)}
                    >
                      Supprimer la salle
                    </button>
                  )}
                  <p>
                    {customRoomId
                      ? "Le code privé reste stable quand vous renommez la salle. Recopiez le lien actualisé pour afficher le nouveau nom ; l’ancienne adresse mène toujours à la salle."
                      : "Un lien aléatoire sera créé et conservé dans ce navigateur pour retrouver la salle."}
                  </p>
                  {confirmDeleteCustomRoom && customRoomId && (
                    <div className={styles.deleteRoomConfirm} role="group" aria-labelledby="delete-room-title" aria-describedby="delete-room-description">
                      <div>
                        <strong id="delete-room-title">Supprimer définitivement cette salle ?</strong>
                        <p id="delete-room-description">Le lien sera désactivé pour tous les participants et ne permettra plus de rejoindre la réunion.</p>
                      </div>
                      <div className={styles.deleteRoomActions}>
                        <button type="button" className={styles.btnDanger} onClick={handleDeleteCustomRoom} disabled={customRoomBusy}>{customRoomBusy ? "Suppression…" : "Confirmer la suppression"}</button>
                        <button type="button" className={styles.btnSecondary} onClick={() => setConfirmDeleteCustomRoom(false)} disabled={customRoomBusy}>Annuler</button>
                      </div>
                    </div>
                  )}
                  {customRoomError && <p className={styles.roomError} role="alert">{customRoomError}</p>}
                </div>
              </div>
            )}

            {activeTab === "custom" && customRoomId ? (
              <div className={styles.roomPreviewBox}>
                <span className={styles.roomLabel}>Lien privé réutilisable</span>
                <strong className={styles.roomValue}>{meetingTitle}</strong>
                <div className={styles.privateLinkRow}>
                  <input aria-label="Lien privé de la salle" readOnly value={publicUrl} onFocus={event => event.currentTarget.select()} />
                  <button type="button" className={styles.btnSecondary} onClick={handleCopyLink} title="Copier le lien privé">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? "Copié" : "Copier"}</span>
                  </button>
                </div>
                <p className={styles.privateLinkNote}>Toute personne qui possède ce lien peut rejoindre la salle. Gardez-le privé.</p>
              </div>
            ) : (
              <div className={styles.roomPreviewBox}>
                <span className={styles.roomLabel}>{activeTab === "custom" ? "Salle personnalisée" : "Identifiant de la salle"}</span>
                <span className={styles.roomValue}>{roomName || "Créez d’abord un lien privé pour cette salle"}</span>
              </div>
            )}

            <div className={styles.actionsBar}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setShowPreflight(true)}
                disabled={activeTab === "custom" && !customRoomId}
              >
                <Play size={18} /> {activeTab === "custom" && !customRoomId ? "Créez d’abord le lien de la salle" : "Vérifier le matériel et démarrer"}
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleCopyLink}
                disabled={activeTab === "custom" && !customRoomId}
                title="Copier le lien d'invitation"
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                {copied ? "Lien copié !" : "Copier le lien d'invitation"}
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleShareWhatsApp}
                disabled={activeTab === "custom" && !customRoomId}
                title="Partager l'invitation sur WhatsApp"
              >
                <Share2 size={16} color="#25d366" /> Inviter sur WhatsApp
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPollsOpen(!pollsOpen)}
                disabled={activeTab === "custom" && !customRoomId}
              >
                <BarChart2 size={16} color="#d4af37" />
                {pollsOpen ? "Masquer les interactions" : "Sondages & Quizz"}
              </button>
            </div>
          </section>

          {pollsOpen && (
            <div style={{ marginTop: 8 }}>
              <InteractivePollPanel
                roomName={roomName}
                isHost={true}
                userName={userName}
                onClose={() => setPollsOpen(false)}
              />
            </div>
          )}

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Monitor size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Partage d'écran HD</h4>
                <p>Projetez vos supports, passages bibliques et documents pendant la réunion.</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Users size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Multi-participants</h4>
                <p>Réunissez votre équipe ou votre cellule avec micro, vidéo et messagerie instantanée.</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <LinkIcon size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Accès direct sans installation</h4>
                <p>Vos participants rejoignent l'appel en un clic depuis leur navigateur web.</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <LinkIcon size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Accès par lien</h4>
                <p>Toute personne disposant du lien peut tenter de rejoindre la salle. Partagez-le uniquement avec les participants concernés.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
