"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Video, Users, Share2, Copy, Check, Monitor,
  House, UserCheck, MessageSquare, ArrowLeft, DoorOpen, LogIn, Link as LinkIcon, BarChart2, LockKeyhole, Trash2
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { getActiveUserInfo, getActiveSpaceType } from "@/lib/client-session";
import { supabase } from "@/lib/supabase";
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

type CustomVisioRoom = {
  roomName: string;
  title: string;
  createdAt?: string;
};

type RoomOccupancyPresence = {
  peerId?: string;
  participantId?: string;
};

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
  const [roomOccupancy, setRoomOccupancy] = useState({ roomName: "", participantCount: 0 });
  const roomChannelCleanupRef = useRef<Promise<unknown> | null>(null);

  // If activeTab is not in allowedTabs (e.g. following a state change), reset it
  useEffect(() => {
    if (!allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "custom");
    }
  }, [allowedTabs, activeTab]);

  // Field states
  const [customRoomInput, setCustomRoomInput] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [customRooms, setCustomRooms] = useState<CustomVisioRoom[]>([]);
  const [customRoomLoadedForKey, setCustomRoomLoadedForKey] = useState("");
  const [confirmDeleteCustomRoomId, setConfirmDeleteCustomRoomId] = useState("");
  const [customRoomBusy, setCustomRoomBusy] = useState(false);
  const [customRoomError, setCustomRoomError] = useState("");
  const [guestNameInput, setGuestNameInput] = useState(paramGuestName || "");
  const [copied, setCopied] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [mediaDevices, setMediaDevices] = useState<VisioDeviceSelection>({});
  const customRoomStorageKey = `poimen:custom-visio-room:${sanitizeRoomName(`${user?.church_id || workspace.churchName || "icc"}-${user?.id || userEmail || "account"}`)}`;
  const selectedCustomRoomStorageKey = `${customRoomStorageKey}:selected`;

  useEffect(() => {
    if (!mounted || !workspace.ready) return;

    let cancelled = false;
    setCustomRoomLoadedForKey("");
    setCustomRoomId("");
    setCustomRoomInput("");
    setCustomRooms([]);
    setCustomRoomError("");
    setCustomRoomBusy(true);

    const loadCustomRooms = async () => {
      let legacyRoom: { roomName: string; title: string } | null = null;
      let registrationError = "";

      try {
        const stored = window.localStorage.getItem(customRoomStorageKey);
        if (stored) {
          const saved = JSON.parse(stored) as { roomName?: unknown; title?: unknown };
          if (typeof saved.roomName === "string" && saved.roomName.startsWith("poimen-prive-")) {
            legacyRoom = {
              roomName: saved.roomName,
              title: typeof saved.title === "string" && saved.title.trim() ? saved.title.trim() : "Salle personnalisée",
            };
          } else {
            window.localStorage.removeItem(customRoomStorageKey);
          }
        }
      } catch {
        window.localStorage.removeItem(customRoomStorageKey);
      }

      if (legacyRoom) {
        try {
          const response = await fetch("/api/visio/custom-rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "register", roomName: legacyRoom.roomName, title: legacyRoom.title }),
          });
          const result = await response.json().catch(() => ({})) as { error?: string };
          if (response.ok || response.status === 410) {
            window.localStorage.removeItem(customRoomStorageKey);
          } else {
            registrationError = result.error || "Impossible de vérifier une ancienne salle privée.";
          }
        } catch {
          registrationError = "Impossible de joindre le service de gestion des salles.";
        }
      }

      try {
        const response = await fetch("/api/visio/custom-rooms", { cache: "no-store" });
        const result = await response.json().catch(() => ({})) as { rooms?: CustomVisioRoom[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Impossible de charger vos salles privées.");
        const rooms = Array.isArray(result.rooms)
          ? result.rooms.filter(room => typeof room.roomName === "string" && typeof room.title === "string")
          : [];
        if (cancelled) return;

        setCustomRooms(rooms);
        const savedSelection = window.localStorage.getItem(selectedCustomRoomStorageKey);
        const selectedRoomName = rooms.some(room => room.roomName === savedSelection)
          ? savedSelection!
          : legacyRoom && rooms.some(room => room.roomName === legacyRoom?.roomName)
            ? legacyRoom.roomName
            : rooms[0]?.roomName || "";
        setCustomRoomId(selectedRoomName);
        setCustomRoomError(registrationError);
      } catch (error) {
        if (!cancelled) {
          setCustomRoomError(error instanceof Error ? error.message : "Impossible de charger vos salles privées.");
        }
      } finally {
        if (!cancelled) {
          setCustomRoomLoadedForKey(customRoomStorageKey);
          setCustomRoomBusy(false);
        }
      }
    };

    void loadCustomRooms();
    return () => { cancelled = true; };
  }, [mounted, workspace.ready, customRoomStorageKey, selectedCustomRoomStorageKey]);

  useEffect(() => {
    if (!mounted || !workspace.ready || customRoomLoadedForKey !== customRoomStorageKey) return;
    if (customRoomId && customRooms.some(room => room.roomName === customRoomId)) {
      window.localStorage.setItem(selectedCustomRoomStorageKey, customRoomId);
    } else {
      window.localStorage.removeItem(selectedCustomRoomStorageKey);
    }
  }, [mounted, workspace.ready, customRoomLoadedForKey, customRoomStorageKey, selectedCustomRoomStorageKey, customRoomId, customRooms]);

  // Sync if params change
  useEffect(() => {
    if (paramRoom) {
      setInMeeting(true);
    }
    if (paramGuestName) {
      setGuestNameInput(paramGuestName);
    }
  }, [paramRoom, paramGuestName]);

  const selectedCustomRoom = customRooms.find(room => room.roomName === customRoomId) || null;

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
    return {
      roomName: customRoomId,
      meetingTitle: selectedCustomRoom?.title || "Salle personnalisée",
      description: "Créez une salle nommée avec un lien d’invitation privé réutilisable.",
    };
  }, [
    paramRoom, 
    paramTitle,
    activeTab, 
    workspace, 
    guestNameInput, 
    customRoomId,
    selectedCustomRoom,
    paramGuestId,
    isFamily
  ]);

  useEffect(() => {
    if (!mounted || !roomName || inMeeting || showPreflight) {
      setRoomOccupancy({ roomName: "", participantCount: 0 });
      return;
    }

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const topic = `poimen-webrtc-${roomName}`;

    const subscribeToRoom = async () => {
      await roomChannelCleanupRef.current;
      if (!active) return;

      const existingChannel = supabase.getChannels().find(candidate => candidate.topic === `realtime:${topic}`);
      if (existingChannel) {
        const cleanup = supabase.removeChannel(existingChannel);
        roomChannelCleanupRef.current = cleanup;
        await cleanup;
        if (roomChannelCleanupRef.current === cleanup) roomChannelCleanupRef.current = null;
      }
      if (!active) return;

      channel = supabase
        .channel(topic, { config: { presence: { key: `dashboard-${user?.id || "visitor"}` } } })
        .on("presence", { event: "sync" }, () => {
          if (!active) return;
          const participantIds = new Set(
            Object.values(channel!.presenceState<RoomOccupancyPresence>())
              .flat()
              .map(presence => presence.participantId || presence.peerId)
              .filter((id): id is string => Boolean(id)),
          );
          setRoomOccupancy({ roomName, participantCount: participantIds.size });
        })
        .subscribe();
    };

    void subscribeToRoom();

    return () => {
      active = false;
      if (channel) {
        const cleanup = supabase.removeChannel(channel);
        roomChannelCleanupRef.current = cleanup;
        void cleanup.finally(() => {
          if (roomChannelCleanupRef.current === cleanup) roomChannelCleanupRef.current = null;
        });
      }
    };
  }, [mounted, roomName, inMeeting, showPreflight, user?.id]);

  const roomIsOccupied = roomOccupancy.roomName === roomName && roomOccupancy.participantCount > 0;

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
      const createdRoom = { roomName: result.roomName, title };
      setCustomRooms(current => [createdRoom, ...current.filter(room => room.roomName !== createdRoom.roomName)]);
      setCustomRoomId(result.roomName);
      setCustomRoomInput("");
      setConfirmDeleteCustomRoomId("");
      notify("Votre lien privé réutilisable est prêt.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "La création de la salle a échoué.";
      setCustomRoomError(message);
      notify(message);
    } finally {
      setCustomRoomBusy(false);
    }
  };

  const handleDeleteCustomRoom = async (roomName: string) => {
    if (!roomName) return;
    setCustomRoomBusy(true);
    setCustomRoomError("");
    try {
      const response = await fetch(`/api/visio/custom-rooms?room=${encodeURIComponent(roomName)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "La suppression de la salle a échoué.");
      const remainingRooms = customRooms.filter(room => room.roomName !== roomName);
      setCustomRooms(remainingRooms);
      if (customRoomId === roomName) {
        setCustomRoomId(remainingRooms[0]?.roomName || "");
        setPollsOpen(false);
        setCopied(false);
      }
      if (confirmDeleteCustomRoomId === roomName) setConfirmDeleteCustomRoomId("");
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
                  <label htmlFor="custom-room-field">Nom de la nouvelle salle</label>
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
                    disabled={customRoomBusy || customRoomLoadedForKey !== customRoomStorageKey || !customRoomInput.trim()}
                  >
                    <LockKeyhole size={16} />
                    {customRoomBusy ? "Enregistrement…" : "Créer une salle privée"}
                  </button>
                  <p>Créez autant de salles que nécessaire. Chacune dispose de son propre lien réutilisable.</p>
                </div>

                <div className={styles.customRoomList} aria-label="Salles personnalisées enregistrées">
                  <div className={styles.customRoomListHeader}>
                    <strong>Mes salles privées</strong>
                    <span>{customRooms.length}</span>
                  </div>
                  {customRoomBusy && customRoomLoadedForKey !== customRoomStorageKey ? (
                    <p className={styles.customRoomEmpty}>Chargement de vos salles…</p>
                  ) : customRooms.length === 0 ? (
                    <p className={styles.customRoomEmpty}>Aucune salle pour le moment. Créez-en une avec son propre lien privé.</p>
                  ) : (
                    <div className={styles.customRoomItems}>
                      {customRooms.map(room => {
                        const isSelected = room.roomName === customRoomId;
                        const isConfirmingDelete = room.roomName === confirmDeleteCustomRoomId;
                        return (
                          <div key={room.roomName} className={`${styles.customRoomItem} ${isSelected ? styles.customRoomItemSelected : ""}`}>
                            <button
                              type="button"
                              className={styles.customRoomSelect}
                              onClick={() => {
                                setCustomRoomId(room.roomName);
                                setConfirmDeleteCustomRoomId("");
                                setCopied(false);
                              }}
                              aria-pressed={isSelected}
                            >
                              <span className={styles.customRoomSelectTitle}>{room.title}</span>
                              <span className={styles.customRoomSelectState}>{isSelected ? "Sélectionnée pour l’appel" : "Utiliser cette salle"}</span>
                            </button>
                            {isConfirmingDelete ? (
                              <div className={styles.customRoomDeleteConfirm}>
                                <span>Désactiver ce lien pour tous ?</span>
                                <button type="button" className={styles.btnDanger} onClick={() => void handleDeleteCustomRoom(room.roomName)} disabled={customRoomBusy}>
                                  {customRoomBusy ? "Suppression…" : "Confirmer"}
                                </button>
                                <button type="button" className={styles.btnSecondary} onClick={() => setConfirmDeleteCustomRoomId("")} disabled={customRoomBusy}>Annuler</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.customRoomDeleteButton}
                                onClick={() => setConfirmDeleteCustomRoomId(room.roomName)}
                                disabled={customRoomBusy}
                                aria-label={`Supprimer la salle ${room.title}`}
                                title={`Supprimer ${room.title}`}
                              >
                                <Trash2 size={16} />
                                <span>Supprimer</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {customRoomError && <p className={styles.roomError} role="alert">{customRoomError}</p>}
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
                {activeTab === "custom" && !customRoomId ? <LinkIcon size={18} /> : roomIsOccupied ? <LogIn size={18} /> : <DoorOpen size={18} />}
                {activeTab === "custom" && !customRoomId ? "Créez d’abord le lien de la salle" : roomIsOccupied ? "Rejoindre la salle" : "Ouvrir la salle"}
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
