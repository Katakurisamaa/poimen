"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Video, Users, Share2, Copy, Check, Monitor,
  House, UserCheck, MessageSquare, ArrowLeft, ArrowRight, DoorOpen, LogIn,
  Link as LinkIcon, BarChart2, LockKeyhole, Trash2, Plus, X, ChevronRight, Camera
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

const roomOptions: Record<VisioSpaceType, { label: string; hint: string; eyebrow: string }> = {
  integration: { label: "Équipe", hint: "Se retrouver ensemble", eyebrow: "Votre salle d’équipe" },
  family: { label: "Famille", hint: "Partager un moment", eyebrow: "Votre salle de famille" },
  guest: { label: "Entretien", hint: "Échanger à deux", eyebrow: "Un échange individuel" },
  custom: { label: "Mes salles", hint: "Vos liens réutilisables", eyebrow: "Votre salle personnalisée" },
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
        { id: "custom", label: "Salle Personnalisée", icon: DoorOpen },
      ];
    }

    if (isIntegration) {
      return [
        { id: "integration", label: "Équipe d'Intégration", icon: Users },
        { id: "guest", label: "Entretien de Suivi / Invité", icon: UserCheck },
        { id: "custom", label: "Salle Personnalisée", icon: DoorOpen },
      ];
    }

    // Default: Famille de disciples
    return [
      { id: "family", label: `Réunion de Famille (${workspace.familyName || "Cellule"})`, icon: House },
      { id: "guest", label: "Entretien individuel", icon: UserCheck },
      { id: "custom", label: "Salle Personnalisée", icon: DoorOpen },
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
  const [showCustomRoomForm, setShowCustomRoomForm] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState(paramGuestName || "");
  const [copied, setCopied] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [mediaDevices, setMediaDevices] = useState<VisioDeviceSelection>({});
  const pollPreparationRef = useRef<HTMLElement>(null);
  const pollShortcutRef = useRef<HTMLButtonElement>(null);
  const customRoomStorageKey = `poimen:custom-visio-room:${sanitizeRoomName(`${user?.church_id || workspace.churchName || "icc"}-${user?.id || userEmail || "account"}`)}`;
  const selectedCustomRoomStorageKey = `${customRoomStorageKey}:selected`;

  useEffect(() => {
    if (pollsOpen && !inMeeting && !showPreflight) {
      pollPreparationRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [pollsOpen, inMeeting, showPreflight]);

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
      setShowCustomRoomForm(false);
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
          <div className={styles.lobby}>
            <header className={styles.header}>
              <div className={styles.eyebrow}><Video size={16} aria-hidden="true" /> Visio <span aria-hidden="true">/</span> {isIntegration ? "Intégration" : isFamily ? workspace.familyName || "Famille" : "Votre espace"}</div>
              <h1>Un moment pour se retrouver.</h1>
              <p>Choisissez votre salle et lancez la conversation.</p>
            </header>

            <nav className={`${styles.roomTypes} ${allowedTabs.length === 4 ? styles.fourRoomTypes : ""}`} aria-label="Type de salle">
              {allowedTabs.map(tab => {
                const Icon = tab.icon;
                const option = roomOptions[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.roomType} ${activeTab === tab.id ? styles.roomTypeActive : ""}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPollsOpen(false);
                      setCopied(false);
                      setConfirmDeleteCustomRoomId("");
                    }}
                    aria-pressed={activeTab === tab.id}
                    aria-label={option.label}
                  >
                    <span className={styles.typeIcon}><Icon size={21} aria-hidden="true" /></span>
                    <span className={styles.typeText}><span>{option.label}</span><small>{option.hint}</small></span>
                    <span className={styles.typeIndicator} aria-hidden="true">{activeTab === tab.id && <Check size={12} />}</span>
                  </button>
                );
              })}
            </nav>

            {activeTab === "custom" && (
              <section className={styles.savedRooms} aria-labelledby="saved-rooms-title" aria-busy={customRoomBusy}>
                <div className={styles.sectionHeading}>
                  <div><h2 id="saved-rooms-title">Mes salles privées <span className={styles.roomCount}>{customRooms.length}</span></h2><p>Un nom, un lien à retrouver à chaque rencontre.</p></div>
                  {customRooms.length > 0 && <button type="button" className={styles.newRoomButton} onClick={() => setShowCustomRoomForm(!showCustomRoomForm)} aria-expanded={showCustomRoomForm} aria-controls={showCustomRoomForm ? "new-room-form" : undefined} disabled={customRoomBusy}>
                    {showCustomRoomForm ? <X size={17} /> : <Plus size={17} />}<span>{showCustomRoomForm ? "Fermer" : "Nouvelle salle"}</span>
                  </button>}
                </div>
                {customRoomLoadedForKey !== customRoomStorageKey ? (
                  <p className={styles.emptyRooms} role="status">Chargement de vos salles…</p>
                ) : (
                  <>
                    {customRooms.length === 0 && <div className={styles.emptyRooms}><span className={styles.emptyRoomIcon}><DoorOpen size={26} /></span><p>Votre première salle vous attend.</p><span>Pour vos temps de prière, vos réunions ou vos échanges réguliers.</span></div>}
                    {(showCustomRoomForm || customRooms.length === 0) && (
                      <form id="new-room-form" className={styles.createRoomForm} onSubmit={event => { event.preventDefault(); if (!customRoomBusy && customRoomInput.trim()) void handleCreateCustomRoom(); }}>
                        <div className={styles.field}>
                          <label htmlFor="custom-room-field">Comment s’appelle votre salle ?</label>
                          <input id="custom-room-field" type="text" placeholder="Ex. Prière du matin" maxLength={80} value={customRoomInput} onChange={event => setCustomRoomInput(event.target.value)} autoFocus={showCustomRoomForm} disabled={customRoomBusy} required />
                        </div>
                        <button type="submit" className={styles.btnPrimary} disabled={customRoomBusy || !customRoomInput.trim()}><Plus size={18} />{customRoomBusy ? "Création…" : "Créer la salle"}</button>
                        <p className={styles.formHint}><LinkIcon size={14} />Chaque salle garde son propre lien d’invitation.</p>
                      </form>
                    )}
                    {customRooms.length > 0 && <div className={styles.customRoomItems}>
                      {customRooms.map(room => {
                        const isSelected = room.roomName === customRoomId;
                        const isConfirmingDelete = room.roomName === confirmDeleteCustomRoomId;
                        return (
                          <div key={room.roomName} className={`${styles.customRoomItem} ${isSelected ? styles.customRoomItemSelected : ""}`}>
                            <div className={styles.customRoomRow}>
                              <button type="button" className={styles.customRoomSelect} onClick={() => { setCustomRoomId(room.roomName); setConfirmDeleteCustomRoomId(""); setCopied(false); setPollsOpen(false); }} aria-pressed={isSelected} disabled={customRoomBusy}>
                                <span className={styles.savedRoomIcon}><LockKeyhole size={18} /></span>
                                <span className={styles.savedRoomText}><span>{room.title}</span><small>{isSelected ? "Salle sélectionnée" : "Sélectionner cette salle"}</small></span>
                                {isSelected ? <Check size={17} className={styles.selectionCheck} /> : <ChevronRight size={17} className={styles.selectionCheck} />}
                              </button>
                              <button type="button" className={styles.deleteRoomButton} onClick={() => setConfirmDeleteCustomRoomId(isConfirmingDelete ? "" : room.roomName)} disabled={customRoomBusy} aria-label={`Supprimer la salle ${room.title}`} aria-expanded={isConfirmingDelete} title={`Supprimer ${room.title}`}><Trash2 size={17} /></button>
                            </div>
                            {isConfirmingDelete && <div className={styles.deleteConfirmation}>
                              <p>Supprimer « {room.title} » ? Son lien ne permettra plus de rejoindre la salle.</p>
                              <div><button type="button" className={styles.btnSecondary} onClick={() => setConfirmDeleteCustomRoomId("")} disabled={customRoomBusy}>Annuler</button><button type="button" className={styles.btnDanger} onClick={() => void handleDeleteCustomRoom(room.roomName)} disabled={customRoomBusy}>{customRoomBusy ? "Suppression…" : "Supprimer"}</button></div>
                            </div>}
                          </div>
                        );
                      })}
                    </div>}
                  </>
                )}
                {customRoomError && <p className={styles.roomError} role="alert">{customRoomError}</p>}
              </section>
            )}

            {(activeTab !== "custom" || customRoomId) && (
              <div className={styles.roomLayout}>
                <section className={styles.sessionCard} aria-labelledby="selected-room-title">
                  <div className={styles.roomIntro}>
                    <div className={styles.sessionTopline}>
                      <span className={styles.eyebrow}>{roomOptions[activeTab].eyebrow}</span>
                      {roomIsOccupied && <span className={styles.liveBadge} role="status"><span />En cours · {roomOccupancy.participantCount}</span>}
                    </div>
                    <div className={styles.roomEmblem} aria-hidden="true">{activeTab === "integration" ? <Users size={32} /> : activeTab === "family" ? <House size={32} /> : activeTab === "guest" ? <UserCheck size={32} /> : <Video size={32} />}</div>
                    <h2 id="selected-room-title">{activeTab === "integration" ? "Équipe d’Intégration" : activeTab === "family" ? workspace.familyName || "Famille de disciples" : activeTab === "guest" ? "Entretien individuel" : meetingTitle}</h2>
                    {activeTab !== "custom" && <span className={styles.churchName}>{workspace.churchName || "ICC"}</span>}
                    <p className={styles.roomDescription}>{activeTab === "custom" ? "Votre espace pour vous retrouver, aujourd’hui et la prochaine fois." : description}</p>
                  </div>
                  {activeTab === "guest" && <div className={`${styles.field} ${styles.guestField}`}>
                    <label htmlFor="guest-name-field">Avec qui souhaitez-vous échanger ?</label>
                    <input id="guest-name-field" type="text" placeholder="Prénom et nom" value={guestNameInput} onChange={event => { setGuestNameInput(event.target.value); setCopied(false); setPollsOpen(false); }} autoComplete="off" />
                    <p className={styles.formHint}>Le lien de l’entretien est associé à ce nom.</p>
                  </div>}
                  <div className={styles.joinArea}>
                    <button type="button" className={styles.btnPrimary} onClick={() => { setPollsOpen(false); setShowPreflight(true); }} disabled={activeTab === "custom" && customRoomBusy}>
                      {roomIsOccupied ? <LogIn size={20} /> : <DoorOpen size={20} />}<span>{roomIsOccupied ? "Rejoindre la salle" : "Ouvrir la salle"}</span><ArrowRight size={18} />
                    </button>
                    <p><Camera size={14} /><span>Réglez votre caméra et votre micro avant d’entrer.</span></p>
                  </div>
                </section>

                <aside className={styles.roomAside} aria-label="Invitations et outils de la salle">
                  <section className={styles.inviteCard} aria-labelledby="invite-title">
                    <span className={styles.asideIcon}><LinkIcon size={20} aria-hidden="true" /></span>
                    <h2 id="invite-title">Invitez à la conversation</h2>
                    <p>Un lien suffit pour vous retrouver.</p>
                    <div className={styles.linkActions}>
                      <button type="button" className={`${styles.btnSecondary} ${copied ? styles.copiedButton : ""}`} onClick={handleCopyLink}>
                        {copied ? <Check size={18} /> : <Copy size={18} />}<span>{copied ? "Lien copié !" : "Copier le lien"}</span>
                      </button>
                      <button type="button" className={`${styles.btnSecondary} ${styles.whatsappButton}`} onClick={handleShareWhatsApp} aria-label="Inviter sur WhatsApp"><Share2 size={18} /><span>WhatsApp</span></button>
                    </div>
                    <details className={styles.linkDetails} key={roomName}>
                      <summary>Voir le lien {activeTab === "custom" ? "réutilisable" : "d’invitation"}<ChevronRight size={14} /></summary>
                      <input aria-label="Lien d’invitation de la salle" readOnly value={publicUrl} onFocus={event => event.currentTarget.select()} />
                    </details>
                    <p className={styles.linkNote}><LockKeyhole size={14} /><span>Partagez ce lien uniquement avec les personnes invitées.</span></p>
                  </section>
                  <button ref={pollShortcutRef} type="button" className={`${styles.pollShortcut} ${pollsOpen ? styles.pollShortcutActive : ""}`} onClick={() => setPollsOpen(!pollsOpen)} aria-expanded={pollsOpen} aria-controls={pollsOpen ? "visio-poll-preparation" : undefined}>
                    <span className={styles.pollIcon}><BarChart2 size={22} /></span>
                    <span><span>Sondages & quiz</span><small>{pollsOpen ? "Fermer les sondages" : "Préparez un échange qui fait participer."}</small></span>
                    <ChevronRight size={18} />
                  </button>
                </aside>
              </div>
            )}

            {pollsOpen && roomName && <section ref={pollPreparationRef} id="visio-poll-preparation" className={styles.pollPreparation} aria-label="Préparation des sondages"><InteractivePollPanel roomName={roomName} isHost={true} userName={userName} onClose={() => { setPollsOpen(false); pollShortcutRef.current?.focus(); }} /></section>}

            <footer className={styles.lobbyFooter}>
              <span><Video size={15} />Vidéo</span><span><MessageSquare size={15} />Messages</span><span><Monitor size={15} />Partage d’écran</span>
              <p>Tout se passe ici, dans votre navigateur.</p>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
