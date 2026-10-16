"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  Mic, MicOff, Video, VideoOff, Monitor, BarChart2,
  Users, AlertCircle, Wifi, MessageSquare, Send, Hand, ShieldCheck, UserX, Smile, Clock,
  RotateCcw, AlertTriangle, Lock, Camera, X, Pin, PinOff, SwitchCamera, ChevronDown, ChevronUp,
  MoreHorizontal, PictureInPicture, Crown, Presentation, LayoutGrid, Columns, User,
  ChevronLeft, ChevronRight, Sun, Moon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPublicVisioUrl, getWhatsAppShareUrl, matchesLobbyAdmission, wasLobbyAdmissionDelivered } from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { animateVisioPanelExit } from "./interaction-transition";
import styles from "./VideoConference.module.css";
import type { VisioDeviceSelection } from "./VisioPreflight";
import type { PollView } from "@/types/visio-poll";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

interface RemotePeer {
  id: string;
  participantId: string;
  name: string;
  stream: MediaStream;
  isMuted?: boolean;
  isVideoOff?: boolean;
  connection?: "connected" | "reconnecting" | "failed";
  quality?: "good" | "fair" | "poor";
  handRaised?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
}

interface ChatMessage { id: string; peerId: string; name: string; text: string; createdAt: number; }
interface WaitingParticipant { peerId: string; participantId: string; name: string; }

const dedupeWaitingList = (list: WaitingParticipant[]): WaitingParticipant[] => {
  const seenPeer = new Set<string>();
  const seenParticipant = new Set<string>();
  return list.filter((p) => {
    if (!p.peerId) return false;
    if (seenPeer.has(p.peerId)) return false;
    if (p.participantId && seenParticipant.has(p.participantId)) return false;
    seenPeer.add(p.peerId);
    if (p.participantId) seenParticipant.add(p.participantId);
    return true;
  });
};
interface RoomPresence {
  peerId: string;
  participantId: string;
  peerName: string;
  isHost: boolean;
  isAdmitted: boolean;
  connectedAt: number;
  meetingStartedAt: number | null;
}
interface FloatingReaction { id: string; peerId: string; name: string; reaction: string; left: number; duration: number; }
const quickReactions: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: "👍", label: "J’aime" },
  { emoji: "👏", label: "Applaudissements" },
  { emoji: "❤️", label: "Cœur" },
  { emoji: "🙌", label: "Amen" },
  { emoji: "🙏", label: "Prière" },
  { emoji: "😂", label: "Rire" },
  { emoji: "😭", label: "Pleurs" },
  { emoji: "😮", label: "Étonné" },
];

function formatMeetingDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

const animatedEmojiCodes: Record<string, string> = {
  "👍": "1f44d",
  "👏": "1f44f",
  "❤️": "2764_fe0f",
  "🙌": "1f64c",
  "🙏": "1f64f",
  "😂": "1f602",
  "😭": "1f62d",
  "😮": "1f62e",
};

function AnimatedReactionEmoji({ emoji, className, animated = false }: { emoji: string; className: string; animated?: boolean }) {
  const [assetFailed, setAssetFailed] = useState(false);
  const baseClass = `${className} ${styles.animatedReaction}`;
  const code = animatedEmojiCodes[emoji];

  if (!animated || !code || assetFailed) {
    return <span className={baseClass} aria-hidden="true">{emoji}</span>;
  }

  const assetBase = `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}`;
  return <span className={baseClass} aria-hidden="true">
    <picture className={styles.animatedSticker}>
      <source srcSet={`${assetBase}/512.webp`} type="image/webp" />
      <img src={`${assetBase}/512.gif`} alt="" referrerPolicy="no-referrer" onError={() => setAssetFailed(true)} />
    </picture>
    <span className={styles.animatedEmojiFallback}>{emoji}</span>
  </span>;
}

interface VideoConferenceProps {
  roomName: string;
  title: string;
  userName?: string;
  userEmail?: string;
  participantId?: string;
  guestName?: string;
  onLeave?: () => void;
  onRoomUnavailable?: (message: string) => void;
  onTogglePolls?: () => void;
  onClosePolls?: () => void;
  pollsOpen?: boolean;
  isHost?: boolean;
  mediaDevices?: VisioDeviceSelection;
}

function getGuestParticipantId(roomName: string) {
  if (typeof window === "undefined") return `guest_${roomName}`;
  const storageKey = `poimen-visio-participant:${roomName}`;
  try {
    const existingId = window.sessionStorage.getItem(storageKey);
    if (existingId) return existingId;
    const newId = `guest_${crypto.randomUUID()}`;
    window.sessionStorage.setItem(storageKey, newId);
    return newId;
  } catch {
    const fallback = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    try {
      window.sessionStorage.setItem(storageKey, fallback);
    } catch {}
    return fallback;
  }
}

async function getIceServers(): Promise<{ servers: RTCIceServer[]; hasTurn: boolean }> {
  const endpoint = process.env.NEXT_PUBLIC_TURN_CREDENTIALS_URL || "/api/visio/turn-credentials";
  try {
    const response = await fetch(endpoint, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error(`TURN credentials unavailable (${response.status})`);
    const body = await response.json();
    const servers: RTCIceServer[] = Array.isArray(body.iceServers) ? body.iceServers :
      body.urls && body.username && body.credential ? [{ urls: body.urls, username: body.username, credential: body.credential }] : [];
    const valid = servers.filter(server => server.urls && (String(server.urls).includes("turn:") || String(server.urls).includes("turns:")));
    return { servers: [...STUN_SERVERS, ...valid], hasTurn: valid.length > 0 };
  } catch (error) {
    console.warn("Relais TURN indisponible, la salle utilisera une connexion directe:", error);
    return { servers: STUN_SERVERS, hasTurn: false };
  }
}

function mediaErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return "La caméra et le micro nécessitent une connexion HTTPS (ou localhost sur cet appareil). Ouvrez la version sécurisée du site.";
  }
  const name = typeof error === "object" && error && "name" in error
    ? String((error as { name?: string }).name || "")
    : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "L'accès au micro et à la caméra est refusé pour ce site. Autorisez-les dans les réglages du navigateur, puis réessayez.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Aucun micro ou aucune caméra n'a été détecté sur cet appareil.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Le micro ou la caméra ne démarre pas. Fermez les autres appels ou applications qui l'utilisent, puis réessayez.";
  }
  return "Impossible d'accéder au micro et à la caméra. Vérifiez les périphériques et les permissions du navigateur.";
}

function screenShareErrorMessage(error: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Le partage d’écran nécessite une connexion HTTPS sécurisée. Ouvrez la réunion depuis son adresse HTTPS.";
  }

  const name = typeof error === "object" && error && "name" in error
    ? String((error as { name?: string }).name || "")
    : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Le navigateur ou l’appareil a refusé le partage. Autorisez la capture d’écran ou ouvrez la réunion dans Safari ou Chrome plutôt que dans un navigateur intégré.";
  }
  if (name === "InvalidStateError") {
    return "Le navigateur n’a pas ouvert le sélecteur d’écran. Revenez à l’onglet de la réunion et réessayez depuis le bouton de partage.";
  }
  if (name === "NotFoundError") {
    return "Aucun écran à partager n’a été proposé par le navigateur.";
  }
  if (name === "NotReadableError") {
    return "Le système n’a pas pu capturer l’écran. Arrêtez un autre partage en cours, puis réessayez.";
  }
  if (name === "AbortError") {
    return "Le partage d’écran a été annulé.";
  }
  return "Le navigateur n’a pas pu démarrer le partage d’écran. Certains navigateurs mobiles ne proposent pas cette fonction; essayez dans le navigateur principal ou sur ordinateur.";
}

export default function VideoConference({
  roomName,
  title,
  userName = "Participant",
  guestName,
  participantId: participantIdProp,
  onLeave,
  onRoomUnavailable,
  onTogglePolls,
  onClosePolls,
  pollsOpen,
  isHost = false,
  mediaDevices,
}: VideoConferenceProps) {
  const { notify } = useFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const reactionTriggerRef = useRef<HTMLButtonElement>(null);
  const closingChatRef = useRef(false);
  const closingPollsRef = useRef(false);
  const chatOpenRef = useRef(false);
  const lastChatNotificationAtRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const followChatRef = useRef(true);
  const callNoticeTimerRef = useRef<number | null>(null);

  // Unique client peer ID
  const [localPeerId] = useState(
    () => `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );
  const [fallbackParticipantId] = useState(() => getGuestParticipantId(roomName));
  const participantId = participantIdProp || fallbackParticipantId;

  useEffect(() => {
    if (participantIdProp) return;
    try {
      const storageKey = `poimen-visio-participant:${roomName}`;
      if (!window.sessionStorage.getItem(storageKey)) window.sessionStorage.setItem(storageKey, fallbackParticipantId);
    } catch {}
  }, [participantIdProp, roomName, fallbackParticipantId]);

  // Theme state synchronized with Poimen global theme system
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const readCurrentTheme = (): "light" | "dark" => {
      if (typeof document !== "undefined") {
        const docTheme = document.documentElement.dataset.theme;
        if (docTheme === "light" || docTheme === "dark") return docTheme;
        if (document.documentElement.classList.contains("dark")) return "dark";
      }
      try {
        const saved = localStorage.getItem("poimen_theme");
        if (saved === "light" || saved === "dark") return saved;
      } catch {}
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
      return "light";
    };

    setCurrentTheme(readCurrentTheme());

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<"light" | "dark">;
      if (customEvent.detail) {
        setCurrentTheme(customEvent.detail);
      } else {
        setCurrentTheme(readCurrentTheme());
      }
    };

    window.addEventListener("poimen-theme-change", handleThemeChange);

    const observer = new MutationObserver(() => {
      const docTheme = document.documentElement.dataset.theme;
      if (docTheme === "light" || docTheme === "dark") {
        setCurrentTheme(docTheme);
      }
    });
    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    }

    return () => {
      window.removeEventListener("poimen-theme-change", handleThemeChange);
      observer.disconnect();
    };
  }, []);

  const toggleThemeMode = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextTheme: "light" | "dark" = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(nextTheme);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      document.body.dataset.theme = nextTheme;
      document.body.style.colorScheme = nextTheme;
      document.body.classList.toggle("dark", nextTheme === "dark");
    }

    try {
      localStorage.setItem("poimen_theme", nextTheme);
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poimen-theme-change", { detail: nextTheme }));
    }
  }, [currentTheme]);

  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const totalParticipants = 1 + remotePeers.length;
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [mediaMode, setMediaMode] = useState<"loading" | "ready" | "audio-only" | "video-only" | "blocked">("loading");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkState, setNetworkState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | null>(null);
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = useState(0);
  const [hasTurnRelay, setHasTurnRelay] = useState(false);
  const [roomLocked, setRoomLocked] = useState(true);
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);
  const [isWaitingRoom, setIsWaitingRoom] = useState(false);
  const [joinRejected, setJoinRejected] = useState(false);
  const [privateRoomUnavailable, setPrivateRoomUnavailable] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [hasNewChatMessages, setHasNewChatMessages] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadPollCount, setUnreadPollCount] = useState(0);
  const [callNotice, setCallNotice] = useState("");
  const [callNoticeTarget, setCallNoticeTarget] = useState<"chat" | "poll" | null>(null);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reactionPickerBottom, setReactionPickerBottom] = useState(96);
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [reactionAnnouncement, setReactionAnnouncement] = useState("");

  // UI states
  const [copied, setCopied] = useState(false);
  // The meeting opens in an immersive layout; this state tracks only native fullscreen.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const allowPageExitRef = useRef(false);

  // New Video Conference UX states (Responsive, Push-to-Talk, Spotlight, Devices)
  const [controlsVisible, setControlsVisible] = useState(true);
  const activityTimerRef = useRef<number | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const pushToTalkActiveRef = useRef(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState<"audio" | "video" | null>(null);
  const [availableAudioDevices, setAvailableAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<string>(mediaDevices?.audioDeviceId || "");
  const [activeVideoDeviceId, setActiveVideoDeviceId] = useState<string>(mediaDevices?.videoDeviceId || "");
  const [currentFacingMode, setCurrentFacingMode] = useState<"user" | "environment">("user");
  const [swapPip, setSwapPip] = useState(false);
  const [activePoll, setActivePoll] = useState<PollView | null>(null);
  const [dismissedPollId, setDismissedPollId] = useState<string | null>(null);

  // Dispositions d'affichage type Zoom (Galerie, Intervenant, Côte à côte)
  type VisioViewMode = "gallery" | "speaker" | "side-by-side";
  const [viewMode, setViewMode] = useState<VisioViewMode>("gallery");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Carrousel Mobile (quand chat ou sondages sont ouverts)
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselGridRef = useRef<HTMLDivElement>(null);

  // Modales personnalisées Visio
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showReloadModal, setShowReloadModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingNavigationUrlRef = useRef<string | null>(null);

  // Refs for WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, { pc: RTCPeerConnection; name: string; participantId: string }>>(new Map());
  const localSpeakingPeersRef = useRef<Set<string>>(new Set());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRequestRef = useRef(0);
  const channelRef = useRef<any>(null);
  const privateRoomRevokedRef = useRef(false);
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS);
  const roomLockedRef = useRef(roomLocked);
  const meetingStartedAtRef = useRef<number | null>(null);
  const onLeaveRef = useRef(onLeave);
  const approvedPeerIdsRef = useRef<Set<string>>(new Set());
  const announcedAdmissionsRef = useRef<Set<string>>(new Set());
  const revokedParticipantsRef = useRef<Set<string>>(new Set());
  const rejectedParticipantsRef = useRef<Set<string>>(new Set());
  const isAdmittedRef = useRef(isHost);
  const isWaitingRoomRef = useRef(false);
  const notifiedLobbyPeersRef = useRef<Set<string>>(new Set());
  const respondingLobbyPeersRef = useRef<Set<string>>(new Set());
  const reactionTimersRef = useRef<Set<number>>(new Set());
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);
  useEffect(() => { isWaitingRoomRef.current = isWaitingRoom; }, [isWaitingRoom]);

  const stopForUnavailablePrivateRoom = useCallback((message: string) => {
    if (privateRoomRevokedRef.current) return;
    privateRoomRevokedRef.current = true;
    setPrivateRoomUnavailable(message);
    setIsLoading(false);
    setMeetingStartedAt(null);
    meetingStartedAtRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    peerConnectionsRef.current.forEach(({ pc }) => pc.close());
    peerConnectionsRef.current.clear();
    setRemotePeers([]);
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) void channel.unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomName.startsWith("poimen-prive-")) return;
    let active = true;
    let requestInFlight = false;
    const checkRoom = async () => {
      if (requestInFlight || privateRoomRevokedRef.current) return;
      requestInFlight = true;
      try {
        const response = await fetch(`/api/visio/custom-rooms?room=${encodeURIComponent(roomName)}`, { cache: "no-store" });
        const result = await response.json().catch(() => ({})) as { active?: boolean; error?: string };
        if (!active) return;
        if (response.ok && result.active === false) {
          stopForUnavailablePrivateRoom("L’animateur a supprimé cette salle. Ce lien est désactivé.");
        } else if (response.status < 500 && !response.ok && !privateRoomUnavailable) {
          stopForUnavailablePrivateRoom(result.error || "Impossible de vérifier que cette salle est toujours disponible.");
        }
      } catch {
        // A temporary status-check failure is handled by the signaling startup check.
      } finally { requestInFlight = false; }
    };
    const interval = window.setInterval(() => { void checkRoom(); }, 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [roomName, privateRoomUnavailable, stopForUnavailablePrivateRoom]);

  const showCallNotice = useCallback((message: string, target: "chat" | "poll" | null = null) => {
    setCallNotice(message);
    setCallNoticeTarget(target);
    if (callNoticeTimerRef.current !== null) window.clearTimeout(callNoticeTimerRef.current);
    callNoticeTimerRef.current = window.setTimeout(() => {
      callNoticeTimerRef.current = null;
      setCallNotice("");
      setCallNoticeTarget(null);
    }, 4200);
  }, []);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [viewMenuOpen]);

  const speakingCandidateId = remotePeers.find(peer => peer.id === activeSpeakerId && peer.isSpeaking && !peer.isMuted)?.id
    ?? remotePeers.find(peer => peer.isSpeaking && !peer.isMuted)?.id;
  useEffect(() => {
    if (!speakingCandidateId || speakingCandidateId === activeSpeakerId) return;
    // Brief noises should not move the main video away from the current speaker.
    const timer = window.setTimeout(() => setActiveSpeakerId(speakingCandidateId), 650);
    return () => window.clearTimeout(timer);
  }, [speakingCandidateId, activeSpeakerId]);

  useEffect(() => {
    const hasScreenShare = isScreenSharing || remotePeers.some(p => p.isScreenSharing);
    if (hasScreenShare && viewMode === "gallery") {
      setViewMode(isMobileScreen ? "speaker" : "side-by-side");
    }
  }, [isScreenSharing, remotePeers, isMobileScreen, viewMode]);



  useEffect(() => () => {
    if (callNoticeTimerRef.current !== null) window.clearTimeout(callNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    // Enregistrer la session active dans sessionStorage pour détecter les déconnexions suite à actualisation
    try {
      sessionStorage.setItem("visio_active_session", JSON.stringify({
        room: roomName,
        userName,
        title,
        timestamp: Date.now()
      }));
    } catch { /* ignore */ }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowPageExitRef.current) return;
      event.preventDefault();
      event.returnValue = "Attention : si vous actualisez la page, vous serez déconnecté(e) de l'appel.";
      return event.returnValue;
    };

    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === window.location.origin
        && destination.pathname === window.location.pathname
        && destination.search === window.location.search) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      pendingNavigationUrlRef.current = anchor.href;
      setShowLeaveModal(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Interception absolue de toutes les combinaisons d'actualisation (F5, Ctrl+R, Cmd+R, Ctrl+F5, Ctrl+Shift+R, Cmd+Shift+R)
      const isReloadShortcut =
        event.key === "F5" ||
        event.code === "F5" ||
        ((event.ctrlKey || event.metaKey) && (
          event.key === "r" ||
          event.key === "R" ||
          event.code === "KeyR"
        ));

      if (isReloadShortcut) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setShowReloadModal(true);
        return;
      }

      // Fermeture des modales avec la touche Échap
      if (event.key === "Escape") {
        setShowPermissionModal(false);
        setShowReloadModal(false);
        setShowLeaveModal(false);
      }
    };

    const handlePopState = () => {
      if (allowPageExitRef.current) return;
      try {
        window.history.pushState({ inVisioCall: true }, "", window.location.href);
      } catch { /* ignore */ }
      setShowLeaveModal(true);
    };

    try {
      window.history.pushState({ inVisioCall: true }, "", window.location.href);
    } catch { /* ignore */ }

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [roomName, userName, title]);

  useEffect(() => {
    if (meetingStartedAt === null) {
      setMeetingElapsedSeconds(0);
      return;
    }
    const updateElapsedTime = () => setMeetingElapsedSeconds(Math.floor((Date.now() - meetingStartedAt) / 1000));
    updateElapsedTime();
    const timer = window.setInterval(updateElapsedTime, 1000);
    return () => window.clearInterval(timer);
  }, [meetingStartedAt]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewport = window.visualViewport;
    const syncViewportHeight = () => {
      container.style.setProperty("--visio-viewport-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
    };
    syncViewportHeight();
    viewport?.addEventListener("resize", syncViewportHeight);
    window.addEventListener("resize", syncViewportHeight);
    return () => {
      viewport?.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("resize", syncViewportHeight);
      container.style.removeProperty("--visio-viewport-height");
    };
  }, []);

  useEffect(() => {
    const dock = containerRef.current?.querySelector<HTMLElement>('[data-visio-interaction-dock="true"]');
    if (!dock || (!chatOpen && !pollsOpen)) return;
    dock.removeAttribute("data-visio-input-active");
    const keepDockExpanded = (event: FocusEvent) => {
      if ((event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) && event.target.closest('[aria-label="Chat de la réunion"]')) {
        dock.setAttribute("data-visio-input-active", "true");
      }
    };
    dock.addEventListener("focusin", keepDockExpanded);
    return () => {
      dock.removeEventListener("focusin", keepDockExpanded);
      dock.removeAttribute("data-visio-input-active");
    };
  }, [chatOpen, pollsOpen]);

  useEffect(() => {
    if (meetingStartedAt === null || isWaitingRoom || joinRejected) return;
    const controller = new AbortController();
    let requestInFlight = false;
    let hasInitialSnapshot = false;
    let previousOpenPoll = "";

    const refreshPollStatus = async () => {
      if (requestInFlight || document.visibilityState !== "visible") return;
      requestInFlight = true;
      try {
        const response = await fetch(`/api/visio/polls?room=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const snapshot: { polls?: PollView[] } = await response.json();
        const openPoll = snapshot.polls?.find(poll => poll.status === "open");
        const latestPoll = openPoll || snapshot.polls?.find(poll => poll.status !== "draft");
        setActivePoll(openPoll || latestPoll || null);
        const signature = openPoll ? `${openPoll.id || ""}:${openPoll.startedAt || openPoll.createdAt || 0}` : "";
        if (hasInitialSnapshot && signature && signature !== previousOpenPoll && !pollsOpen) {
          setUnreadPollCount(count => Math.min(99, count + 1));
          showCallNotice(`Nouveau sondage : ${(openPoll?.question || "une nouvelle question").slice(0, 110)}`, "poll");
        }
        previousOpenPoll = signature;
        hasInitialSnapshot = true;
      } catch {
        // Une perte temporaire du service de sondage ne doit pas interrompre l'appel.
      } finally {
        requestInFlight = false;
      }
    };

    const interval = window.setInterval(() => { void refreshPollStatus(); }, 4000);
    const refreshWhenVisible = () => { void refreshPollStatus(); };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    void refreshPollStatus();
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [meetingStartedAt, roomName, isWaitingRoom, joinRejected, pollsOpen, showCallNotice]);

  useEffect(() => {
    if (!chatOpen) return;
    if (!followChatRef.current) {
      setHasNewChatMessages(true);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const list = chatScrollRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    const input = chatInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
    if (followChatRef.current && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatDraft, chatOpen]);

  const showReaction = useCallback((peerId: string, name: string, reaction: string) => {
    const option = quickReactions.find(item => item.emoji === reaction);
    if (!option) return;
    const duration = 3600;
    const id = `${peerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = name.slice(0, 48) || "Un participant";
    setFloatingReactions(previous => [...previous.slice(-11), {
      id,
      peerId,
      name: safeName,
      reaction,
      left: 13 + Math.random() * 74,
      duration,
    }]);
    setReactionAnnouncement(`${safeName} : ${option.label}`);
    const timeout = window.setTimeout(() => {
      setFloatingReactions(previous => previous.filter(item => item.id !== id));
      reactionTimersRef.current.delete(timeout);
    }, duration);
    reactionTimersRef.current.add(timeout);
  }, []);

  useEffect(() => () => {
    reactionTimersRef.current.forEach(timeout => window.clearTimeout(timeout));
    reactionTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!reactionsOpen) return;
    const syncPickerPosition = () => {
      const footer = reactionPickerRef.current?.closest("footer");
      if (!footer) return;
      const viewport = window.visualViewport;
      const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      setReactionPickerBottom(Math.max(8, viewportBottom - footer.getBoundingClientRect().top + 8));
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!reactionPickerRef.current?.contains(event.target as Node)) setReactionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setReactionsOpen(false);
      reactionTriggerRef.current?.focus();
    };
    syncPickerPosition();
    window.addEventListener("resize", syncPickerPosition);
    window.visualViewport?.addEventListener("resize", syncPickerPosition);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", syncPickerPosition);
      window.visualViewport?.removeEventListener("resize", syncPickerPosition);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [reactionsOpen]);

  const publicUrl = getPublicVisioUrl(roomName, guestName);
  const whatsappUrl = getWhatsAppShareUrl({ roomName, title, guestName });

  // Flush queued candidates once remote description is set
  const flushPendingIceCandidates = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(peerId);
    if (queue && queue.length > 0) {
      queue.forEach((cand) => {
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      });
      pendingIceCandidatesRef.current.delete(peerId);
    }
  }, []);

  // 1. Initialiser le flux média local (Caméra & Micro) avec fallback gracieux
  const initLocalMedia = useCallback(async () => {
    const requestId = ++mediaRequestRef.current;
    setIsLoading(true);
    setPermissionError(null);
    setMediaMode("loading");

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = window.isSecureContext
        ? "Votre navigateur ne permet pas l'accès aux périphériques audio et vidéo dans ce contexte."
        : "Ouvrez le site en HTTPS : la caméra et le micro ne sont pas accessibles via une adresse HTTP distante.";
      setPermissionError(message);
      setMediaMode("blocked");
      const fallbackStream = new MediaStream();
      localStreamRef.current = fallbackStream;
      setLocalStream(fallbackStream);
      setIsMicMuted(true);
      setIsVideoOff(true);
      setIsLoading(false);
      return fallbackStream;
    }

    let stream: MediaStream | null = null;

    try {
      const audioConstraint: MediaTrackConstraints = mediaDevices?.audioDeviceId
        ? { deviceId: { exact: mediaDevices.audioDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };
      const videoConstraint: MediaTrackConstraints = mediaDevices?.videoDeviceId
        ? { deviceId: { exact: mediaDevices.videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      // Essai avec les périphériques choisis à l'écran de préparation.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: audioConstraint });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      setIsVideoOff(false);
      setIsMicMuted(false);
      setMediaMode("ready");
    } catch (err: any) {
      console.warn("Échec vidéo + audio, tentative audio seul:", err);
      try {
        // 2. Fallback Audio seul
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        setIsVideoOff(true);
        setIsMicMuted(false);
        setMediaMode("audio-only");
        notify("Caméra non disponible : appel démarré en audio seul.");
      } catch (audioErr: any) {
        console.warn("Échec audio seul, tentative vidéo seule:", audioErr);
        try {
          // 3. Fallback Vidéo seule (si micro absent)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setIsVideoOff(false);
          setIsMicMuted(true);
          setMediaMode("video-only");
          notify("Micro non disponible : appel démarré en vidéo seule.");
        } catch (totalErr: any) {
          console.warn("Accès média bloqué (NotAllowedError):", totalErr);
          // 4. Fallback Mode Écoute Seule (Spectateur) : flux vide pour ne jamais bloquer la réunion
          stream = new MediaStream();
          setIsVideoOff(true);
          setIsMicMuted(true);
          setPermissionError(mediaErrorMessage(totalErr || err));
          setMediaMode("blocked");
          setShowPermissionModal(true);
        }
      }
    }

    if (requestId !== mediaRequestRef.current) {
      stream?.getTracks().forEach(track => track.stop());
      return null;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsLoading(false);
    return stream;
  }, [mediaDevices, notify]);

  // Synchroniser le flux local avec la balise vidéo dès le montage
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Fonction pour réactiver micro/caméra une fois l'autorisation accordée
  const retryPermissions = async () => {
    if (isLoading) return;
    const previousMode = mediaMode;
    const requestId = ++mediaRequestRef.current;
    try {
      setIsLoading(true);
      setMediaMode("loading");
      let newStream: MediaStream | null = null;
      let nextMode: "ready" | "audio-only" | "video-only" = "ready";
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          nextMode = "audio-only";
        } catch {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          nextMode = "video-only";
        }
      }

      if (requestId !== mediaRequestRef.current) {
        newStream.getTracks().forEach(track => track.stop());
        return;
      }
      const oldStream = localStreamRef.current;
      setLocalStream(newStream);
      localStreamRef.current = newStream;
      setPermissionError(null);
      setMediaMode(nextMode);
      setIsVideoOff(!newStream.getVideoTracks().length);
      setIsMicMuted(!newStream.getAudioTracks().length);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        localVideoRef.current.play().catch(() => {});
      }

      // Remplacer ou ajouter les pistes dans toutes les connexions actives
      const newAudio = newStream.getAudioTracks()[0];
      const newVideo = newStream.getVideoTracks()[0];

      // Re-negotiate with existing peers, including receive-only connections.
      // Their offers will now use the current stream rather than stopped tracks.
      oldStream?.getTracks().forEach(track => track.stop());

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast", event: "PEER_JOIN",
          payload: { peerId: localPeerId, participantId, peerName: userName, isHost, isAdmitted: isAdmittedRef.current },
        });
        channelRef.current.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: !newAudio, isVideoOff: !newVideo },
        });
      }

      notify(nextMode === "ready" ? "Micro et caméra connectés avec succès !" : nextMode === "audio-only" ? "Caméra indisponible : appel audio activé." : "Micro indisponible : appel vidéo activé.");
    } catch (err) {
      console.warn("Échec nouvelle tentative média:", err);
      setPermissionError(mediaErrorMessage(err));
      if (!localStreamRef.current?.getTracks().some(track => track.readyState === "live")) {
        setMediaMode("blocked");
      } else {
        setMediaMode(previousMode);
      }
      notify(mediaErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Créer une connexion RTCPeerConnection avec un pair
  const createPeerConnection = useCallback((peerId: string, peerName: string, streamToShare: MediaStream, peerParticipantId = peerId) => {
    // Un participant ne garde qu'une seule connexion, même s'il revient avec un nouvel ID WebRTC.
    peerConnectionsRef.current.forEach((entry, existingPeerId) => {
      if (existingPeerId === peerId || entry.participantId === peerParticipantId) {
        entry.pc.close();
        peerConnectionsRef.current.delete(existingPeerId);
        pendingIceCandidatesRef.current.delete(existingPeerId);
      }
    });
    // Enregistrer immédiatement le pair dans remotePeers pour affichage instantané sans participant fantôme
    setRemotePeers(previous => {
      const filtered = previous.filter(peer => peer.participantId !== peerParticipantId && peer.id !== peerId);
      return [...filtered, { id: peerId, participantId: peerParticipantId, name: peerName, stream: new MediaStream() }];
    });

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    // Un nouveau participant doit recevoir l’écran partagé, même si le partage a commencé avant son arrivée.
    const activeScreenTrack = screenTrackRef.current?.readyState === "live" ? screenTrackRef.current : null;
    const outgoingStream = activeScreenTrack
      ? new MediaStream([...streamToShare.getAudioTracks(), activeScreenTrack])
      : streamToShare;
    outgoingStream.getTracks().forEach((track) => {
      pc.addTrack(track, outgoingStream);
    });

    // En mode écoute seule (sans pistes locales), ajouter des récepteurs pour recevoir les flux distants
    const hasVideo = outgoingStream.getVideoTracks().length > 0;
    const hasAudio = outgoingStream.getAudioTracks().length > 0;
    if (!hasVideo) {
      try { pc.addTransceiver("video", { direction: "recvonly" }); } catch {}
    }
    if (!hasAudio) {
      try { pc.addTransceiver("audio", { direction: "recvonly" }); } catch {}
    }

    // Envoi des candidats ICE au pair distant
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "WEBRTC_ICE",
          payload: {
            toPeerId: peerId,
            fromPeerId: localPeerId,
            candidate: event.candidate,
          },
        });
      }
    };

    // Réception du flux distant
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] ?? new MediaStream([event.track]);
      setRemotePeers((prev) => {
        const existing = prev.find((p) => p.participantId === peerParticipantId || p.id === peerId);
        if (existing) {
          return prev.map((p) => (p.participantId === peerParticipantId || p.id === peerId ? { ...p, id: peerId, stream: incomingStream, name: peerName } : p));
        }
        return [...prev, { id: peerId, participantId: peerParticipantId, name: peerName, stream: incomingStream }];
      });
    };

    // Allow a brief network interruption, then release departed peers.
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    let statsRequestInFlight = false;
    let lastRemoteVoiceAt = 0;
    let lastLocalVoiceAt = 0;
    const audioEnergySnapshots = new Map<string, { energy: number; duration: number }>();
    const updatePeerStatus = (connection: RemotePeer["connection"], quality?: RemotePeer["quality"], isSpeaking?: boolean) => {
      setRemotePeers(prev => {
        let changed = false;
        const next = prev.map(peer => {
          if (peer.id !== peerId) return peer;
          const nextQuality = quality ?? peer.quality;
          const nextSpeaking = isSpeaking ?? peer.isSpeaking;
          if (peer.connection === connection && peer.quality === nextQuality && peer.isSpeaking === nextSpeaking) return peer;
          changed = true;
          return { ...peer, connection, quality: nextQuality, isSpeaking: nextSpeaking };
        });
        return changed ? next : prev;
      });
    };
    const audioLevelFromStat = (stat: RTCStats & { audioLevel?: number; totalAudioEnergy?: number; totalSamplesDuration?: number }) => {
      if (typeof stat.audioLevel === "number") return stat.audioLevel;
      if (typeof stat.totalAudioEnergy !== "number" || typeof stat.totalSamplesDuration !== "number") return 0;
      const previous = audioEnergySnapshots.get(stat.id);
      audioEnergySnapshots.set(stat.id, { energy: stat.totalAudioEnergy, duration: stat.totalSamplesDuration });
      if (!previous || stat.totalSamplesDuration <= previous.duration) return 0;
      return Math.sqrt(Math.max(0, stat.totalAudioEnergy - previous.energy) / (stat.totalSamplesDuration - previous.duration));
    };
    const updateLocalSpeaking = (speaking: boolean) => {
      if (speaking) localSpeakingPeersRef.current.add(peerId);
      else localSpeakingPeersRef.current.delete(peerId);
      setIsLocalSpeaking(localSpeakingPeersRef.current.size > 0);
    };
    const restartIce = async () => {
      if (localPeerId < peerId || !channelRef.current || pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        channelRef.current.send({ type: "broadcast", event: "WEBRTC_OFFER", payload: {
          toPeerId: peerId, fromPeerId: localPeerId, fromParticipantId: participantId, fromPeerName: userName, sdp: offer,
        } });
      } catch (error) { console.warn("La reconnexion automatique WebRTC a échoué:", error); }
    };
    pc.oniceconnectionstatechange = () => {
      clearTimeout(disconnectTimer);
      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        updatePeerStatus("connected", "good");
        setNetworkState("connected");
        if (!statsTimer) statsTimer = setInterval(() => {
          if (statsRequestInFlight) return;
          statsRequestInFlight = true;
          void pc.getStats().then(report => {
            let received = 0; let lost = 0; let jitter = 0;
            let remoteAudioLevel = 0; let localAudioLevel = 0;
            report.forEach(stat => {
              const mediaStat = stat as RTCStats & { kind?: string; mediaType?: string; audioLevel?: number; totalAudioEnergy?: number; totalSamplesDuration?: number; packetsReceived?: number; packetsLost?: number; jitter?: number };
              const mediaKind = mediaStat.kind || mediaStat.mediaType;
              if (stat.type === "inbound-rtp" && !stat.isRemote && (mediaKind === "audio" || mediaKind === "video")) {
                received += Number(mediaStat.packetsReceived || 0);
                lost += Number(mediaStat.packetsLost || 0);
                jitter = Math.max(jitter, Number(mediaStat.jitter || 0));
                if (mediaKind === "audio") remoteAudioLevel = Math.max(remoteAudioLevel, audioLevelFromStat(mediaStat));
              }
              if (stat.type === "outbound-rtp" && mediaKind === "audio") {
                localAudioLevel = Math.max(localAudioLevel, audioLevelFromStat(mediaStat));
              }
              if (stat.type === "media-source" && mediaKind === "audio") {
                localAudioLevel = Math.max(localAudioLevel, audioLevelFromStat(mediaStat));
              }
            });
            if (!(pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed")) return;
            const lossRate = received + lost ? lost / (received + lost) : 0;
            const quality = lossRate > 0.08 || jitter > 0.05 ? "poor" : lossRate > 0.025 || jitter > 0.03 ? "fair" : "good";
            const now = Date.now();
            if (remoteAudioLevel >= 0.035) lastRemoteVoiceAt = now;
            if (localAudioLevel >= 0.035) lastLocalVoiceAt = now;
            updatePeerStatus("connected", quality, now - lastRemoteVoiceAt < 950);
            updateLocalSpeaking(now - lastLocalVoiceAt < 950);
          }).catch(() => {}).finally(() => { statsRequestInFlight = false; });
        }, 700);
      } else if (pc.iceConnectionState === "disconnected") {
        clearInterval(statsTimer);
        statsTimer = undefined;
        updatePeerStatus("reconnecting", "fair", false);
        updateLocalSpeaking(false);
        setNetworkState("reconnecting");
        void restartIce();
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") void restartIce();
        }, 4000);
      } else if (pc.iceConnectionState === "failed") {
        clearInterval(statsTimer);
        statsTimer = undefined;
        updatePeerStatus("reconnecting", "poor", false);
        updateLocalSpeaking(false);
        setNetworkState("reconnecting");
        void restartIce();
      }
    };
    pc.onconnectionstatechange = () => {
      clearTimeout(disconnectTimer);
      if (pc.connectionState === "disconnected") {
        disconnectTimer = setTimeout(() => {
          if (pc.connectionState === "disconnected") void restartIce();
        }, 10000);
      }
      if (["failed", "closed"].includes(pc.connectionState) && peerConnectionsRef.current.get(peerId)?.pc === pc) {
        clearInterval(statsTimer);
        updateLocalSpeaking(false);
        setRemotePeers((prev) => prev.filter((p) => p.id !== peerId));
        peerConnectionsRef.current.delete(peerId);
        pendingIceCandidatesRef.current.delete(peerId);
      }
    };

    pc.addEventListener("signalingstatechange", () => {
      if (pc.signalingState === "closed") { clearInterval(statsTimer); clearTimeout(disconnectTimer); updateLocalSpeaking(false); }
    });

    peerConnectionsRef.current.set(peerId, { pc, name: peerName, participantId: peerParticipantId });
    return pc;
  }, [localPeerId, participantId, userName]);

  // 3. Cycle de vie WebRTC et Signaling Supabase
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isSubscribed = true;
    const peerConnections = peerConnectionsRef.current;

    const startSignaling = async () => {
      // Let an immediately cancelled mount finish before opening physical devices.
      await Promise.resolve();
      if (!isSubscribed) return;
      if (roomName.startsWith("poimen-prive-")) {
        try {
          const response = await fetch(`/api/visio/custom-rooms?room=${encodeURIComponent(roomName)}`, { cache: "no-store" });
          const result = await response.json().catch(() => ({})) as { active?: boolean; error?: string };
          if (!isSubscribed) return;
          if (!response.ok) {
            stopForUnavailablePrivateRoom(result.error || "Impossible de vérifier que cette salle est toujours disponible.");
            return;
          }
          if (result.active === false) {
            stopForUnavailablePrivateRoom("L’animateur a supprimé cette salle. Ce lien est désactivé.");
            return;
          }
        } catch {
          if (isSubscribed) stopForUnavailablePrivateRoom("Impossible de vérifier que cette salle est toujours disponible. Réessayez plus tard.");
          return;
        }
      }
      if (!isSubscribed || privateRoomRevokedRef.current) return;
      setMeetingStartedAt(null);
      meetingStartedAtRef.current = null;
      setMeetingElapsedSeconds(0);
      roomLockedRef.current = true;
      setRoomLocked(true);
      approvedPeerIdsRef.current.clear();
      announcedAdmissionsRef.current.clear();
      revokedParticipantsRef.current.clear();
      rejectedParticipantsRef.current.clear();
      isAdmittedRef.current = isHost;
      setWaitingParticipants([]);
      setChatMessages([]);
      const iceConfig = await getIceServers();
      if (!isSubscribed) return;
      iceServersRef.current = iceConfig.servers;
      setHasTurnRelay(iceConfig.hasTurn);
      const stream = await initLocalMedia();
      if (!stream || !isSubscribed || privateRoomRevokedRef.current) {
        stream?.getTracks().forEach(track => track.stop());
        return;
      }
      activeStream = stream;

      const channelName = `poimen-webrtc-${roomName}`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false }, presence: { key: localPeerId } },
      });
      const connectedAt = Date.now();
      let resolvePresenceReady: () => void = () => {};
      const presenceReady = new Promise<void>(resolve => { resolvePresenceReady = resolve; });
      const trackPresence = async (isAdmitted: boolean, startedAt = meetingStartedAtRef.current) => {
        isAdmittedRef.current = isAdmitted;
        try {
          await channel.track({
          peerId: localPeerId,
          participantId,
          peerName: userName,
          isHost,
          isAdmitted,
          connectedAt,
          meetingStartedAt: startedAt,
          } satisfies RoomPresence);
        } catch (error) {
          console.warn("Impossible de publier la présence dans la réunion:", error);
        }
      };
      const connectToPeer = async (peerId: string, peerName: string, peerParticipantId: string) => {
        if (!localStreamRef.current || !channelRef.current) return;
        const currentPeer = peerConnectionsRef.current.get(peerId);
        if (currentPeer && currentPeer.pc.signalingState !== "closed" && currentPeer.pc.connectionState !== "failed") {
          return;
        }
        const pc = createPeerConnection(peerId, peerName, localStreamRef.current, peerParticipantId);
        try {
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") return;
          await pc.setLocalDescription(offer);
          channelRef.current.send({
            type: "broadcast",
            event: "WEBRTC_OFFER",
            payload: {
              toPeerId: peerId,
              fromPeerId: localPeerId,
              fromParticipantId: participantId,
              fromPeerName: userName,
              sdp: offer,
            },
          });
        } catch (err) {
          console.error("Erreur création d'offre WebRTC vers", peerName, err);
        }
      };

      let localAdmissionHandled = false;
      const admitLocalParticipant = async (proposedStart?: unknown) => {
        if (isHost || localAdmissionHandled) return;
        localAdmissionHandled = true;
        isAdmittedRef.current = true;
        const candidateStart = Number(proposedStart);
        const startedAt = Number.isFinite(candidateStart) && candidateStart > 0
          ? candidateStart
          : meetingStartedAtRef.current || Date.now();
        isWaitingRoomRef.current = false;
        setIsWaitingRoom(false);
        setJoinRejected(false);
        setMeetingStartedAt(startedAt);
        meetingStartedAtRef.current = startedAt;
        approvedPeerIdsRef.current.add(participantId);
        approvedPeerIdsRef.current.add(localPeerId);
        setNetworkState("connecting");
        await trackPresence(true, startedAt);
        channel.send({
          type: "broadcast",
          event: "PEER_JOIN",
          payload: { peerId: localPeerId, participantId, peerName: userName, isHost: false, isAdmitted: true, meetingStartedAt: startedAt },
        });

        // Connexion aux autres pairs déjà admis dans la salle
        const presences = Object.values(channel.presenceState<RoomPresence>()).flat();
        presences.forEach(presence => {
          if (presence.peerId && presence.peerId !== localPeerId && (presence.isHost || presence.isAdmitted)) {
            approvedPeerIdsRef.current.add(presence.participantId);
            approvedPeerIdsRef.current.add(presence.peerId);
            if (localPeerId < presence.peerId) {
              void connectToPeer(presence.peerId, presence.peerName || "Participant", presence.participantId);
            }
          }
        });
      };
      const announceAdmission = (admittedParticipantId: string, admittedPeerId?: string) => {
        if (revokedParticipantsRef.current.has(admittedParticipantId) || rejectedParticipantsRef.current.has(admittedParticipantId)) return;
        approvedPeerIdsRef.current.add(admittedParticipantId);
        if (admittedPeerId) approvedPeerIdsRef.current.add(admittedPeerId);
        if (!announcedAdmissionsRef.current.has(admittedParticipantId)) {
          announcedAdmissionsRef.current.add(admittedParticipantId);
          if (admittedPeerId) announcedAdmissionsRef.current.add(admittedPeerId);
          channel.send({
            type: "broadcast",
            event: "ROOM_PEER_ADMITTED",
            payload: { participantId: admittedParticipantId, peerId: admittedPeerId, meetingStartedAt: meetingStartedAtRef.current },
          });
        }
      };

      // Annonce de présence et négociation
      channel
        .on("presence", { event: "sync" }, () => {
          resolvePresenceReady();
          const state = channel.presenceState<RoomPresence>();
          const activePeerIds = new Set<string>();
          const startTimes: number[] = [];
          const waitingNow: WaitingParticipant[] = [];
          const admittedPeerEntries: { peerId: string; participantId: string; peerName: string; isHost: boolean }[] = [];

          for (const presences of Object.values(state)) {
            for (const presence of presences) {
              if (!presence.peerId || !presence.participantId) continue;
              activePeerIds.add(presence.peerId);
              if (presence.isHost || presence.isAdmitted) {
                approvedPeerIdsRef.current.add(presence.participantId);
                approvedPeerIdsRef.current.add(presence.peerId);
                if (presence.peerId !== localPeerId) {
                  admittedPeerEntries.push({
                    peerId: presence.peerId,
                    participantId: presence.participantId,
                    peerName: presence.peerName || "Participant",
                    isHost: Boolean(presence.isHost),
                  });
                }
              }
              if ((presence.isHost || presence.isAdmitted) && Number.isFinite(presence.meetingStartedAt) && presence.meetingStartedAt) {
                startTimes.push(presence.meetingStartedAt);
              }
              if (isHost && !presence.isHost) {
                if (revokedParticipantsRef.current.has(presence.participantId) || rejectedParticipantsRef.current.has(presence.participantId)) continue;
                const isApproved = presence.isAdmitted || approvedPeerIdsRef.current.has(presence.participantId) || approvedPeerIdsRef.current.has(presence.peerId);
                if (isApproved) {
                  announceAdmission(presence.participantId, presence.peerId);
                } else if (roomLockedRef.current) {
                  waitingNow.push({
                    peerId: presence.peerId,
                    participantId: presence.participantId,
                    name: presence.peerName || "Invité",
                  });
                }
              }
            }
          }

          if (startTimes.length) {
            const recoveredStart = Math.min(...startTimes);
            if (meetingStartedAtRef.current === null || recoveredStart < meetingStartedAtRef.current) {
              meetingStartedAtRef.current = recoveredStart;
              setMeetingStartedAt(recoveredStart);
              if (isHost) channel.send({ type: "broadcast", event: "ROOM_LOCK", payload: { locked: roomLockedRef.current, meetingStartedAt: recoveredStart } });
            }
          }

          if (isHost) {
            setWaitingParticipants(previous => {
              const combined = dedupeWaitingList([...previous, ...waitingNow]);
              return combined.filter(person =>
                activePeerIds.has(person.peerId) &&
                !approvedPeerIdsRef.current.has(person.participantId) &&
                !approvedPeerIdsRef.current.has(person.peerId) &&
                !revokedParticipantsRef.current.has(person.participantId) &&
                !rejectedParticipantsRef.current.has(person.participantId)
              );
            });

            if (waitingNow.length) {
              waitingNow.forEach(person => {
                if (
                  !approvedPeerIdsRef.current.has(person.participantId) &&
                  !approvedPeerIdsRef.current.has(person.peerId) &&
                  !notifiedLobbyPeersRef.current.has(person.peerId)
                ) {
                  notifiedLobbyPeersRef.current.add(person.peerId);
                  channel.send({
                    type: "broadcast",
                    event: "LOBBY_WAITING",
                    payload: { toPeerId: person.peerId, toParticipantId: person.participantId },
                  });
                }
              });
            }
          }

          // Réconciliation Full-Mesh : tous les participants admis connectent leurs flux
          if (isAdmittedRef.current || isHost) {
            admittedPeerEntries.forEach(peer => {
              const existing = peerConnectionsRef.current.get(peer.peerId);
              const isConnected = existing && existing.pc.signalingState !== "closed" && existing.pc.connectionState !== "failed";
              if (!isConnected && localStreamRef.current) {
                // Règle déterministe pour éviter les conflits d'offres simultanées (glare)
                if (localPeerId < peer.peerId) {
                  void connectToPeer(peer.peerId, peer.peerName, peer.participantId);
                }
              }
            });
          }

          const stalePeerIds: string[] = [];
          peerConnectionsRef.current.forEach(({ pc }, peerId) => {
            if (!activePeerIds.has(peerId)) {
              pc.close();
              peerConnectionsRef.current.delete(peerId);
              pendingIceCandidatesRef.current.delete(peerId);
              stalePeerIds.push(peerId);
            }
          });
          if (stalePeerIds.length) setRemotePeers(previous => previous.filter(peer => !stalePeerIds.includes(peer.id)));
        })
        .on("broadcast", { event: "PEER_JOIN" }, async ({ payload }) => {
          if (!payload?.peerId || payload.peerId === localPeerId) return;
          const { peerId, peerName } = payload;
          const peerParticipantId = String(payload.participantId || peerId);
          rejectedParticipantsRef.current.delete(peerParticipantId);
          rejectedParticipantsRef.current.delete(peerId);

          if (payload.isAdmitted || payload.isHost) {
            approvedPeerIdsRef.current.add(peerParticipantId);
            approvedPeerIdsRef.current.add(peerId);
          }

          const isAlreadyAdmitted = approvedPeerIdsRef.current.has(peerParticipantId) || approvedPeerIdsRef.current.has(peerId) || Object.values(channel.presenceState<RoomPresence>()).flat().some(
            presence => (presence.peerId === peerId || presence.participantId === peerParticipantId) && (presence.isAdmitted || approvedPeerIdsRef.current.has(presence.participantId))
          );
          if (isHost && isAlreadyAdmitted) announceAdmission(peerParticipantId, peerId);
          if (isHost && !roomLockedRef.current && !payload.isHost) announceAdmission(peerParticipantId, peerId);

          if (isHost && !payload.isHost && roomLockedRef.current && !approvedPeerIdsRef.current.has(peerParticipantId) && !approvedPeerIdsRef.current.has(peerId)) {
            setWaitingParticipants(previous => dedupeWaitingList([
              { peerId, participantId: peerParticipantId, name: peerName || "Invité" },
              ...previous
            ]).filter(p => !approvedPeerIdsRef.current.has(p.participantId) && !approvedPeerIdsRef.current.has(p.peerId)));
            if (!notifiedLobbyPeersRef.current.has(peerId)) {
              notifiedLobbyPeersRef.current.add(peerId);
              channel.send({ type: "broadcast", event: "LOBBY_WAITING", payload: { toPeerId: peerId, toParticipantId: peerParticipantId } });
            }
            return;
          }
          if (!isHost && roomLockedRef.current && !payload.isHost && !payload.isAdmitted && !approvedPeerIdsRef.current.has(peerParticipantId) && !approvedPeerIdsRef.current.has(peerId)) return;
          if (!isHost && !isAdmittedRef.current) return;

          if (peerConnectionsRef.current.get(peerId)?.pc.signalingState !== undefined
            && peerConnectionsRef.current.get(peerId)?.pc.signalingState !== "closed") return;

          // Règle déterministe pour éviter les offres simultanées (glare)
          if (localPeerId < peerId) {
            void connectToPeer(peerId, peerName, peerParticipantId);
          }
        })
        .on("broadcast", { event: "WEBRTC_OFFER" }, async ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          const { fromPeerId, fromPeerName, sdp } = payload;

          const isPolite = localPeerId > fromPeerId;
          const currentPeer = peerConnectionsRef.current.get(fromPeerId);
          let pc = currentPeer?.pc;

          if (!pc || pc.signalingState === "closed") {
            pc = createPeerConnection(fromPeerId, fromPeerName, localStreamRef.current!, String(payload.fromParticipantId || fromPeerId));
          }

          // Gestion du Glare WebRTC (W3C Perfect Negotiation)
          if (pc.signalingState !== "stable") {
            if (!isPolite) {
              return; // Le pair impoli ignore l'offre concurrente
            }
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch (err) {
              console.warn("Rollback WebRTC non applicable:", err);
            }
          }

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            flushPendingIceCandidates(fromPeerId, pc);

            // Vérifier que l'état attend bien une réponse locale
            if (pc.signalingState !== "have-remote-offer") return;

            const answer = await pc.createAnswer();
            if (pc.signalingState !== "have-remote-offer") return;

            await pc.setLocalDescription(answer);

            channel.send({
              type: "broadcast",
              event: "WEBRTC_ANSWER",
              payload: {
                toPeerId: fromPeerId,
                fromPeerId: localPeerId,
                sdp: answer,
              },
            });
          } catch (err) {
            console.error("Erreur traitement de l'offre WebRTC:", err);
          }
        })
        .on("broadcast", { event: "WEBRTC_ANSWER" }, async ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          const { fromPeerId, sdp } = payload;

          const peerObj = peerConnectionsRef.current.get(fromPeerId);
          if (peerObj && peerObj.pc.signalingState === "have-local-offer") {
            try {
              await peerObj.pc.setRemoteDescription(new RTCSessionDescription(sdp));
              flushPendingIceCandidates(fromPeerId, peerObj.pc);
            } catch (err) {
              console.error("Erreur assignation réponse WebRTC:", err);
            }
          }
        })
        .on("broadcast", { event: "WEBRTC_ICE" }, async ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          const { fromPeerId, candidate } = payload;

          const peerObj = peerConnectionsRef.current.get(fromPeerId);
          if (candidate) {
            try {
              if (peerObj?.pc.remoteDescription) {
                await peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                const q = pendingIceCandidatesRef.current.get(fromPeerId) || [];
                q.push(candidate);
                pendingIceCandidatesRef.current.set(fromPeerId, q);
              }
            } catch (err) {
              console.warn("Erreur ajout candidat ICE:", err);
            }
          }
        })
        .on("broadcast", { event: "TRACK_STATUS" }, ({ payload }) => {
          if (!payload?.peerId) return;
          const isSharing = typeof payload.isScreenSharing === "boolean" ? payload.isScreenSharing : undefined;
          setRemotePeers((prev) =>
            prev.map((p) =>
              p.id === payload.peerId
                ? {
                    ...p,
                    ...(typeof payload.isMuted === "boolean" ? { isMuted: payload.isMuted } : {}),
                    ...(typeof payload.isVideoOff === "boolean" ? { isVideoOff: payload.isVideoOff } : {}),
                    ...(isSharing !== undefined ? { isScreenSharing: isSharing, isVideoOff: isSharing ? false : p.isVideoOff } : {}),
                  }
                : p
            )
          );
          if (isSharing !== undefined) {
            if (isSharing) setPinnedPeerId(payload.peerId);
            else setPinnedPeerId(current => current === payload.peerId ? null : current);
          }
        })
        .on("broadcast", { event: "SCREEN_SHARE_STATUS" }, ({ payload }) => {
          if (!payload?.peerId) return;
          const isSharing = Boolean(payload.isScreenSharing);
          setRemotePeers((prev) =>
            prev.map((p) =>
              p.id === payload.peerId
                ? { ...p, isScreenSharing: isSharing, isVideoOff: isSharing ? false : p.isVideoOff }
                : p
            )
          );
          if (isSharing) {
            setPinnedPeerId(payload.peerId);
          } else {
            setPinnedPeerId((current) => current === payload.peerId ? null : current);
          }
        })
        .on("broadcast", { event: "ROOM_LOCK" }, async ({ payload }) => {
          const locked = Boolean(payload?.locked);
          setRoomLocked(locked);
          roomLockedRef.current = locked;
          if (Number.isFinite(payload?.meetingStartedAt) && payload.meetingStartedAt) {
            meetingStartedAtRef.current = payload.meetingStartedAt;
            setMeetingStartedAt(payload.meetingStartedAt);
          }
          if (!isHost && !locked) {
            approvedPeerIdsRef.current.add(participantId);
            await trackPresence(true, meetingStartedAtRef.current);
            channel.send({ type: "broadcast", event: "PEER_JOIN", payload: { peerId: localPeerId, participantId, peerName: userName, isHost: false, isAdmitted: true } });
          }
        })
        .on("broadcast", { event: "LOBBY_WAITING" }, async ({ payload }) => {
          if (
            matchesLobbyAdmission(payload, localPeerId, participantId) &&
            !approvedPeerIdsRef.current.has(participantId) &&
            !approvedPeerIdsRef.current.has(localPeerId)
          ) {
            if (!isWaitingRoomRef.current) {
              isWaitingRoomRef.current = true;
              setMeetingStartedAt(null);
              meetingStartedAtRef.current = null;
              await trackPresence(false, null);
              setNetworkState("connecting");
              setIsWaitingRoom(true);
            }
          }
        })
        .on("broadcast", { event: "LOBBY_APPROVED" }, async ({ payload }) => {
          if (!matchesLobbyAdmission(payload, localPeerId, participantId)) return;
          await admitLocalParticipant(payload.meetingStartedAt);
        })
        .on("broadcast", { event: "LOBBY_REJECTED" }, async ({ payload }) => {
          if (!matchesLobbyAdmission(payload, localPeerId, participantId)) return;
          setMeetingStartedAt(null);
          meetingStartedAtRef.current = null;
          await trackPresence(false, null);
          setIsWaitingRoom(false);
          setJoinRejected(true);
          notify("Votre demande d'accès à la salle a été refusée.");
        })
        .on("broadcast", { event: "ROOM_PEER_ADMITTED" }, ({ payload }) => {
          if (payload?.participantId || payload?.peerId) {
            const admittedParticipantId = String(payload.participantId || "");
            const admittedPeerId = String(payload.peerId || "");
            if (admittedParticipantId) approvedPeerIdsRef.current.add(admittedParticipantId);
            if (admittedPeerId) approvedPeerIdsRef.current.add(admittedPeerId);
            if (admittedParticipantId) announcedAdmissionsRef.current.add(admittedParticipantId);
            if (admittedPeerId) announcedAdmissionsRef.current.add(admittedPeerId);
            if (isHost) {
              setWaitingParticipants(prev => prev.filter(p => p.participantId !== admittedParticipantId && p.peerId !== admittedPeerId));
            }
            if (admittedParticipantId === participantId || admittedPeerId === localPeerId) {
              void admitLocalParticipant(payload.meetingStartedAt);
            } else if ((isAdmittedRef.current || isHost) && admittedPeerId && admittedPeerId !== localPeerId) {
              if (localPeerId < admittedPeerId) {
                const presence = Object.values(channel.presenceState<RoomPresence>()).flat().find(p => p.peerId === admittedPeerId);
                void connectToPeer(admittedPeerId, presence?.peerName || "Participant", admittedParticipantId);
              }
            }
          }
        })
        .on("broadcast", { event: "ROOM_PEER_REVOKED" }, ({ payload }) => {
          const revokedParticipantId = String(payload?.participantId || "");
          if (!revokedParticipantId) return;
          revokedParticipantsRef.current.add(revokedParticipantId);
          approvedPeerIdsRef.current.delete(revokedParticipantId);
          announcedAdmissionsRef.current.delete(revokedParticipantId);
          const revokedPeerIds: string[] = [];
          peerConnectionsRef.current.forEach(({ pc, participantId: peerParticipantId }, peerId) => {
            if (peerParticipantId === revokedParticipantId) {
              pc.close();
              peerConnectionsRef.current.delete(peerId);
              pendingIceCandidatesRef.current.delete(peerId);
              revokedPeerIds.push(peerId);
            }
          });
          if (revokedPeerIds.length) setRemotePeers(previous => previous.filter(peer => !revokedPeerIds.includes(peer.id)));
        })
        .on("broadcast", { event: "CHAT_MESSAGE" }, ({ payload }) => {
          if (!payload?.messageId || !payload?.text || !payload?.peerId) return;
          if (payload.peerId === localPeerId) return;
          setChatMessages(previous => [...previous.slice(-99), {
            id: payload.messageId, peerId: payload.peerId, name: payload.name || "Participant",
            text: String(payload.text).slice(0, 500), createdAt: Number(payload.createdAt) || Date.now(),
          }]);
          if (!chatOpenRef.current) {
            setUnreadChatCount(count => Math.min(99, count + 1));
            const now = Date.now();
            if (now - lastChatNotificationAtRef.current > 4000) {
              lastChatNotificationAtRef.current = now;
              showCallNotice(`Nouveau message de ${String(payload.name || "un participant").slice(0, 48)}.`, "chat");
            }
          }
        })
        .on("broadcast", { event: "REACTION" }, ({ payload }) => {
          if (!payload?.reaction || !payload?.peerId) return;
          showReaction(String(payload.peerId), String(payload.name || "Un participant"), String(payload.reaction));
        })
        .on("broadcast", { event: "HAND_STATUS" }, ({ payload }) => {
          if (!payload?.peerId) return;
          setRemotePeers(previous => previous.map(peer => peer.id === payload.peerId ? { ...peer, handRaised: Boolean(payload.raised) } : peer));
        })
        .on("broadcast", { event: "MODERATION" }, ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          if (payload.action === "mute") {
            localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = false; });
            setIsMicMuted(true);
            setIsLocalSpeaking(false);
            localSpeakingPeersRef.current.clear();
            channelRef.current?.send({ type: "broadcast", event: "TRACK_STATUS", payload: { peerId: localPeerId, isMuted: true, isVideoOff } });
            notify("Votre micro a été coupé par l’animateur.");
          } else if (payload.action === "remove") {
            notify("Vous avez été retiré de la réunion.");
            onLeaveRef.current?.();
          }
        })
        .on("broadcast", { event: "PEER_LEAVE" }, ({ payload }) => {
          if (!payload?.peerId) return;
          const peerObj = peerConnectionsRef.current.get(payload.peerId);
          if (peerObj) {
            peerObj.pc.close();
            peerConnectionsRef.current.delete(payload.peerId);
          }
          setRemotePeers((prev) => prev.filter((p) => p.id !== payload.peerId));
          notifiedLobbyPeersRef.current.delete(payload.peerId);
          if (isHost) setWaitingParticipants(previous => previous.filter(person => person.peerId !== payload.peerId && person.participantId !== payload.participantId));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            if (isHost) {
              await Promise.race([presenceReady, new Promise<void>(resolve => window.setTimeout(resolve, 350))]);
              if (!isSubscribed) return;
            }
            const existingPresence = Object.values(channel.presenceState<RoomPresence>()).flat();
            const previousStart = existingPresence
              .filter(presence => presence.isHost || presence.isAdmitted)
              .map(presence => presence.meetingStartedAt)
              .filter((value): value is number => Number.isFinite(value) && Boolean(value));
            const startedAt = previousStart.length ? Math.min(...previousStart) : isHost ? Date.now() : null;
            meetingStartedAtRef.current = startedAt;
            setMeetingStartedAt(startedAt);
            try {
              await channel.track({
              peerId: localPeerId, participantId, peerName: userName, isHost,
              isAdmitted: isHost, connectedAt, meetingStartedAt: startedAt,
              } satisfies RoomPresence);
            } catch (error) {
              console.warn("Impossible de publier la présence dans la réunion:", error);
            }
            if (!isSubscribed) return;
            if (isHost) channel.send({ type: "broadcast", event: "ROOM_LOCK", payload: { locked: roomLockedRef.current, meetingStartedAt: startedAt } });
            // Annoncer notre arrivée dans la salle
            channel.send({
              type: "broadcast",
              event: "PEER_JOIN",
              payload: { peerId: localPeerId, participantId, peerName: userName, isHost, isAdmitted: isHost, meetingStartedAt: startedAt },
            });
          }
        });

      channelRef.current = channel;
    };

    startSignaling();

    return () => {
      isSubscribed = false;
      mediaRequestRef.current += 1;
      // Nettoyage complet
      if (channelRef.current) {
        const leavingChannel = channelRef.current;
        channelRef.current = null;
        void (async () => {
          try {
            await Promise.race([
              leavingChannel.send({
                type: "broadcast",
                event: "PEER_LEAVE",
                payload: { peerId: localPeerId, participantId },
              }),
              new Promise<void>(resolve => window.setTimeout(resolve, 500)),
            ]);
          } catch {
            // La présence Supabase sera aussi supprimée à la fermeture du canal.
          } finally {
            await leavingChannel.unsubscribe();
          }
        })();
      }

      peerConnections.forEach(({ pc }) => pc.close());
      peerConnections.clear();

      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (localStreamRef.current && localStreamRef.current !== activeStream) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
    };
  }, [roomName, localPeerId, participantId, userName, isHost, initLocalMedia, createPeerConnection, flushPendingIceCandidates, notify, showReaction, showCallNotice, stopForUnavailablePrivateRoom]);

  // Basculer le micro (Mute / Unmute)
  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !audioTrack.enabled;
      setIsMicMuted(nextMuted);
      if (nextMuted) {
        localSpeakingPeersRef.current.clear();
        setIsLocalSpeaking(false);
      }

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: nextMuted, isVideoOff },
        });
      }
    } else {
      setShowPermissionModal(true);
      void retryPermissions();
    }
  };

  // Basculer la caméra (On / Off)
  const toggleCam = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const nextVideoOff = !videoTrack.enabled;
      setIsVideoOff(nextVideoOff);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: isMicMuted, isVideoOff: nextVideoOff },
        });
      }
    } else {
      setShowPermissionModal(true);
      void retryPermissions();
    }
  };

  // Partage d'écran
  const stopScreenShare = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    const cameraTrack = !isVideoOff ? (localStreamRef.current?.getVideoTracks()[0] ?? null) : null;
    peerConnectionsRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        || pc.getTransceivers().find(t => t.receiver.track?.kind === "video" || t.sender.track?.kind === "video")?.sender;
      if (sender) void sender.replaceTrack(cameraTrack).catch(() => {});
    });

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsScreenSharing(false);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "SCREEN_SHARE_STATUS",
        payload: { peerId: localPeerId, isScreenSharing: false },
      });
      channelRef.current.send({
        type: "broadcast",
        event: "TRACK_STATUS",
        payload: { peerId: localPeerId, isMuted: isMicMuted, isVideoOff, isScreenSharing: false },
      });
    }
    notify("Partage d'écran arrêté.");
  };

  const toggleScreenShare = async () => {
    if (screenTrackRef.current) {
      stopScreenShare();
    } else {
      if (!window.isSecureContext) {
        notify("Le partage d’écran nécessite une connexion HTTPS sécurisée. Ouvrez la réunion depuis son adresse HTTPS.");
        return;
      }
      if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
        notify("Ce navigateur ne permet pas le partage d’écran. Ouvrez la réunion dans Safari ou Chrome, ou rejoignez-la depuis un ordinateur.");
        return;
      }

      let screenStream: MediaStream | null = null;
      let transmissionFailed = false;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error("Aucune piste vidéo d’écran n’a été fournie.");
        screenTrackRef.current = screenTrack;

        const videoSenders = Array.from(peerConnectionsRef.current.values())
          .map(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track?.kind === "video");
            if (sender) return sender;
            const transceiver = pc.getTransceivers().find(t => t.receiver.track?.kind === "video" || t.sender.track?.kind === "video");
            if (transceiver) {
              if (transceiver.direction === "recvonly") {
                transceiver.direction = "sendrecv";
              }
              return transceiver.sender;
            }
            return null;
          })
          .filter((sender): sender is RTCRtpSender => Boolean(sender));

        try {
          await Promise.all(videoSenders.map(sender => sender.replaceTrack(screenTrack)));
        } catch (error) {
          transmissionFailed = true;
          const cameraTrack = !isVideoOff ? (localStreamRef.current?.getVideoTracks()[0] ?? null) : null;
          await Promise.allSettled(videoSenders.map(sender => sender.replaceTrack(cameraTrack)));
          throw error;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = stopScreenShare;

        setIsScreenSharing(true);
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "SCREEN_SHARE_STATUS",
            payload: { peerId: localPeerId, isScreenSharing: true },
          });
          channelRef.current.send({
            type: "broadcast",
            event: "TRACK_STATUS",
            payload: { peerId: localPeerId, isMuted: isMicMuted, isVideoOff: false, isScreenSharing: true },
          });
        }
        notify("Partage d'écran actif.");
      } catch (err) {
        screenTrackRef.current = null;
        screenStream?.getTracks().forEach(track => {
          track.onended = null;
          track.stop();
        });
        console.warn("Partage d'écran annulé ou refusé:", err);
        notify(transmissionFailed
          ? "L’écran a été sélectionné, mais la réunion n’a pas pu transmettre le partage. Vérifiez la connexion et réessayez."
          : screenShareErrorMessage(err));
      }
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

  const toggleWaitingRoom = () => {
    const nextLocked = !roomLocked;
    setRoomLocked(nextLocked);
    roomLockedRef.current = nextLocked;
    if (!nextLocked) setWaitingParticipants([]);
    channelRef.current?.send({ type: "broadcast", event: "ROOM_LOCK", payload: { locked: nextLocked, meetingStartedAt: meetingStartedAtRef.current } });
    notify(nextLocked ? "La salle d'attente est activée pour les invités." : "La salle est ouverte aux invités.");
  };

  const respondToWaitingParticipant = async (person: WaitingParticipant, approved: boolean) => {
    const channel = channelRef.current;
    if (!channel) return;
    if (respondingLobbyPeersRef.current.has(person.participantId) || respondingLobbyPeersRef.current.has(person.peerId)) {
      return;
    }
    respondingLobbyPeersRef.current.add(person.participantId);
    respondingLobbyPeersRef.current.add(person.peerId);

    try {
      if (!approved) {
        rejectedParticipantsRef.current.add(person.participantId);
        rejectedParticipantsRef.current.add(person.peerId);
        notifiedLobbyPeersRef.current.delete(person.peerId);
        const status = await channel.send({ type: "broadcast", event: "LOBBY_REJECTED", payload: { toPeerId: person.peerId, toParticipantId: person.participantId } });
        if (status !== "ok") {
          rejectedParticipantsRef.current.delete(person.participantId);
          rejectedParticipantsRef.current.delete(person.peerId);
          notify("Le refus n’a pas pu être transmis. Réessayez.");
          return;
        }
        setWaitingParticipants(previous => previous.filter(item => item.participantId !== person.participantId && item.peerId !== person.peerId));
        return;
      }
      rejectedParticipantsRef.current.delete(person.participantId);
      rejectedParticipantsRef.current.delete(person.peerId);
      revokedParticipantsRef.current.delete(person.participantId);
      revokedParticipantsRef.current.delete(person.peerId);
      approvedPeerIdsRef.current.add(person.participantId);
      approvedPeerIdsRef.current.add(person.peerId);
      announcedAdmissionsRef.current.add(person.participantId);
      announcedAdmissionsRef.current.add(person.peerId);
      notifiedLobbyPeersRef.current.delete(person.peerId);

      // Immédiatement retirer de l'interface pour éviter tout doublon visuel
      setWaitingParticipants(previous => previous.filter(item => item.participantId !== person.participantId && item.peerId !== person.peerId));

      const admissionPayload = { participantId: person.participantId, peerId: person.peerId, meetingStartedAt: meetingStartedAtRef.current };
      const [roomStatus, directStatus] = await Promise.all([
        channel.send({ type: "broadcast", event: "ROOM_PEER_ADMITTED", payload: admissionPayload }),
        channel.send({
          type: "broadcast",
          event: "LOBBY_APPROVED",
          payload: { toPeerId: person.peerId, toParticipantId: person.participantId, ...admissionPayload },
        }),
      ]);
      if (!wasLobbyAdmissionDelivered(roomStatus, directStatus)) {
        approvedPeerIdsRef.current.delete(person.participantId);
        approvedPeerIdsRef.current.delete(person.peerId);
        announcedAdmissionsRef.current.delete(person.participantId);
        announcedAdmissionsRef.current.delete(person.peerId);
        notify("L’admission n’a pas pu être transmise. La personne reste en attente, réessayez.");
        setWaitingParticipants(previous => dedupeWaitingList([...previous, person]));
        return;
      }
    } finally {
      respondingLobbyPeersRef.current.delete(person.participantId);
      respondingLobbyPeersRef.current.delete(person.peerId);
    }
  };

  const sendChatMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatDraft.trim().slice(0, 500);
    if (!text || !channelRef.current) return;
    followChatRef.current = true;
    setHasNewChatMessages(false);
    const message: ChatMessage = { id: `${localPeerId}-${Date.now()}`, peerId: localPeerId, name: userName, text, createdAt: Date.now() };
    setChatMessages(previous => [...previous.slice(-99), message]);
    channelRef.current.send({ type: "broadcast", event: "CHAT_MESSAGE", payload: { messageId: message.id, peerId: localPeerId, name: userName, text, createdAt: message.createdAt } });
    setChatDraft("");
  };

  const sendReaction = (reaction: string) => {
    channelRef.current?.send({ type: "broadcast", event: "REACTION", payload: { peerId: localPeerId, name: userName, reaction } });
    showReaction(localPeerId, userName, reaction);
  };

  const toggleHand = () => {
    const raised = !handRaised;
    setHandRaised(raised);
    channelRef.current?.send({ type: "broadcast", event: "HAND_STATUS", payload: { peerId: localPeerId, raised } });
  };

  const closeChatPanel = async () => {
    if (closingChatRef.current) return;
    closingChatRef.current = true;
    try {
      chatOpenRef.current = false;
      const shouldClose = await animateVisioPanelExit(containerRef.current?.querySelector<HTMLElement>('[aria-label="Chat de la réunion"]'));
      if (shouldClose) { setChatOpen(false); }
    } finally {
      chatOpenRef.current = false;
      setChatOpen(false);
      closingChatRef.current = false;
    }
  };

  const closePollsPanel = async () => {
    if (closingPollsRef.current) return;
    closingPollsRef.current = true;
    let shouldClose = true;
    try {
      shouldClose = await animateVisioPanelExit(containerRef.current?.querySelector<HTMLElement>('[data-visio-poll-panel="true"]'));
    } catch {
      // An unavailable animation must not prevent the panel from closing.
    } finally {
      closingPollsRef.current = false;
    }
    if (shouldClose) (onClosePolls ?? onTogglePolls)?.();
  };

  const toggleChat = () => {
    setReactionsOpen(false);
    if (chatOpen) {
      void closeChatPanel();
    } else {
      if (pollsOpen) {
        (onClosePolls ?? onTogglePolls)?.();
      }
      chatOpenRef.current = true;
      followChatRef.current = true;
      setHasNewChatMessages(false);
      setUnreadChatCount(0);
      setChatOpen(true);
    }
  };

  const togglePolls = () => {
    setReactionsOpen(false);
    if (pollsOpen) {
      void closePollsPanel();
    } else {
      if (chatOpen) {
        chatOpenRef.current = false;
        setChatOpen(false);
      }
      setUnreadPollCount(0);
      onTogglePolls?.();
    }
  };

  const leaveMeeting = () => {
    pendingNavigationUrlRef.current = null;
    setShowLeaveModal(true);
  };

  const moderatePeer = (peerId: string, action: "mute" | "remove") => {
    channelRef.current?.send({ type: "broadcast", event: "MODERATION", payload: { toPeerId: peerId, action } });
    if (action === "mute") {
      // Publish immediately so every participant sees the muted state even
      // before the targeted client echoes its updated track status.
      const target = remotePeers.find(peer => peer.id === peerId);
      setRemotePeers(previous => previous.map(peer => peer.id === peerId ? { ...peer, isMuted: true } : peer));
      channelRef.current?.send({
        type: "broadcast",
        event: "TRACK_STATUS",
        payload: { peerId, isMuted: true, isVideoOff: target?.isVideoOff ?? false },
      });
    }
    if (action === "remove") {
      const participant = peerConnectionsRef.current.get(peerId);
      participant?.pc.close();
      peerConnectionsRef.current.delete(peerId);
      if (participant) {
        approvedPeerIdsRef.current.delete(participant.participantId);
        revokedParticipantsRef.current.add(participant.participantId);
        channelRef.current?.send({ type: "broadcast", event: "ROOM_PEER_REVOKED", payload: { participantId: participant.participantId } });
      }
      setRemotePeers(previous => previous.filter(peer => peer.id !== peerId));
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const target = containerRef.current;
      if (target?.requestFullscreen) void target.requestFullscreen().catch(() => {});
    } else {
      if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    updateFullscreen();
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  // 1. Détection de format mobile
  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth <= 700);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 2. Énumération des périphériques disponibles (Micros & Caméras)
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      setAvailableAudioDevices(devs.filter(d => d.kind === "audioinput"));
      setAvailableVideoDevices(devs.filter(d => d.kind === "videoinput"));
    } catch {}
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  // 3. Changement direct de périphérique audio en cours d'appel
  const switchAudioDevice = async (deviceId: string) => {
    setActiveAudioDeviceId(deviceId);
    setDeviceMenuOpen(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;
      const oldTrack = localStreamRef.current?.getAudioTracks()[0];
      oldTrack?.stop();
      if (localStreamRef.current) {
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
      }
      peerConnectionsRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === "audio");
        if (sender) void sender.replaceTrack(newTrack).catch(() => {});
      });
      setIsMicMuted(false);
      notify("Microphone actif mis à jour.");
    } catch (err) {
      console.warn("Échec changement de micro:", err);
      notify("Impossible de changer de micro.");
    }
  };

  // 4. Changement direct de caméra en cours d'appel
  const switchVideoDevice = async (deviceId: string) => {
    setActiveVideoDeviceId(deviceId);
    setDeviceMenuOpen(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      const oldTrack = localStreamRef.current?.getVideoTracks()[0];
      oldTrack?.stop();
      if (localStreamRef.current) {
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      if (!screenTrackRef.current) {
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) void sender.replaceTrack(newTrack).catch(() => {});
        });
      }
      setIsVideoOff(false);
      notify("Caméra mise à jour.");
    } catch (err) {
      console.warn("Échec changement de caméra:", err);
      notify("Impossible de changer de caméra.");
    }
  };

  // 5. Inversion caméra mobile (Avant / Arrière)
  const flipCamera = async () => {
    const nextFacing = currentFacingMode === "user" ? "environment" : "user";
    try {
      // 1. Libérer l'ancienne piste vidéo pour éviter le conflit matériel de caméra sur mobile
      const oldTrack = localStreamRef.current?.getVideoTracks()[0];
      if (oldTrack) {
        oldTrack.stop();
      }

      // 2. Demander la nouvelle caméra
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) throw new Error("Piste vidéo introuvable");

      // 3. Mettre à jour le flux local
      if (localStreamRef.current) {
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
      } else {
        localStreamRef.current = newStream;
      }

      const updatedStream = new MediaStream(localStreamRef.current.getTracks());
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);

      // 4. Remplacer la piste chez tous les pairs distants
      if (!screenTrackRef.current) {
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video")
            || pc.getTransceivers().find(t => t.receiver.track?.kind === "video" || t.sender.track?.kind === "video")?.sender;
          if (sender) void sender.replaceTrack(newTrack).catch(() => {});
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = updatedStream;
        localVideoRef.current.play().catch(() => {});
      }

      setCurrentFacingMode(nextFacing);
      setIsVideoOff(false);
      notify(nextFacing === "environment" ? "Caméra arrière activée" : "Caméra avant activée");
    } catch (err) {
      console.warn("Échec inversion caméra:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const fallbackTrack = fallbackStream.getVideoTracks()[0];
        if (fallbackTrack && localStreamRef.current) {
          localStreamRef.current.addTrack(fallbackTrack);
          const fallbackUpdated = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = fallbackUpdated;
          setLocalStream(fallbackUpdated);
        }
      } catch {}
      notify("Impossible d'inverser la caméra sur cet appareil.");
    }
  };

  // 6. Gestion du masquage immersif des contrôles (Stable, sans clignotement)
  const resetActivityTimer = useCallback(() => {
    setControlsVisible(true);
    if (activityTimerRef.current !== null) window.clearTimeout(activityTimerRef.current);
    activityTimerRef.current = window.setTimeout(() => {
      activityTimerRef.current = null;
      setControlsVisible(false);
    }, 6000);
  }, []);

  const handleStageClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button") || target?.closest("a") || target?.closest("input") || target?.closest("form")) {
      return;
    }
    setControlsVisible((prev) => {
      const next = !prev;
      if (activityTimerRef.current !== null) {
        window.clearTimeout(activityTimerRef.current);
        activityTimerRef.current = null;
      }
      if (next) {
        activityTimerRef.current = window.setTimeout(() => {
          activityTimerRef.current = null;
          setControlsVisible(false);
        }, 6000);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (moreSheetOpen || reactionsOpen || deviceMenuOpen || chatOpen || pollsOpen || showPermissionModal || showReloadModal || showLeaveModal) {
      setControlsVisible(true);
      if (activityTimerRef.current !== null) window.clearTimeout(activityTimerRef.current);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Le déplacement ou le clic réinitialise le timer d'inactivité
    const onActivity = () => {
      resetActivityTimer();
    };

    container.addEventListener("pointermove", onActivity);
    container.addEventListener("mousemove", onActivity);
    container.addEventListener("click", onActivity);
    return () => {
      container.removeEventListener("pointermove", onActivity);
      container.removeEventListener("mousemove", onActivity);
      container.removeEventListener("click", onActivity);
      if (activityTimerRef.current !== null) window.clearTimeout(activityTimerRef.current);
    };
  }, [moreSheetOpen, reactionsOpen, deviceMenuOpen, chatOpen, pollsOpen, showPermissionModal, showReloadModal, showLeaveModal, resetActivityTimer]);

  // 7. Raccourcis clavier & Push-to-Talk (Espace maintenu pour parler)
  useEffect(() => {
    const isEditingText = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isEditingText(e.target)) return;

      // Push-to-talk avec la barre d'espace
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (isMicMuted && !pushToTalkActiveRef.current) {
          pushToTalkActiveRef.current = true;
          setIsPushToTalkActive(true);
          localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = true);
          channelRef.current?.send({
            type: "broadcast",
            event: "TRACK_STATUS",
            payload: { peerId: localPeerId, isMuted: false, isVideoOff },
          });
        }
      }

      // Raccourci Mute micro : 'M'
      if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleMic();
      }

      // Raccourci Caméra : 'V'
      if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleCam();
      }

      // Raccourci Chat : 'C'
      if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleChat();
      }

      // Raccourci Main levée : 'H'
      if ((e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleHand();
      }

      // Raccourci Plein écran : 'F'
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      }

      // Échap : fermer menus
      if (e.key === "Escape") {
        setMoreSheetOpen(false);
        setDeviceMenuOpen(null);
        setReactionsOpen(false);
        if (pinnedPeerId) setPinnedPeerId(null);
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (isEditingText(e.target)) return;
      if (e.code === "Space" && pushToTalkActiveRef.current) {
        e.preventDefault();
        pushToTalkActiveRef.current = false;
        setIsPushToTalkActive(false);
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = false);
        channelRef.current?.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: true, isVideoOff },
        });
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [isMicMuted, isVideoOff, localPeerId, pinnedPeerId]);

  const gridClass =
    totalParticipants === 1
      ? styles.grid1
      : totalParticipants === 2
      ? styles.grid2
      : totalParticipants <= 4
      ? styles.grid4
      : totalParticipants <= 6
      ? styles.grid6
      : styles.gridMany;

  // Liste ordonnée de tous les participants dans le carrousel mobile
  const allCarouselParticipants = useMemo(() => {
    return [
      { id: "local", name: userName ? `${userName} (Vous)` : "Vous", isLocal: true },
      ...remotePeers.map(p => ({ id: p.id, name: p.name, isLocal: false }))
    ];
  }, [userName, remotePeers]);

  // Détection du défilement tactile / swipe pour actualiser l'indicateur de carrousel
  const handleCarouselScroll = useCallback(() => {
    const el = carouselGridRef.current;
    if (!el) return;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild ? firstChild.offsetWidth + 16 : el.clientWidth;
    if (cardWidth <= 0) return;
    const newIndex = Math.round(el.scrollLeft / cardWidth);
    setCarouselIndex(Math.max(0, Math.min(newIndex, totalParticipants - 1)));
  }, [totalParticipants]);

  // Défilement ciblé et fluide vers un volet participant
  const scrollToParticipant = useCallback((index: number) => {
    const el = carouselGridRef.current;
    if (!el) return;
    const targetCard = el.children[index] as HTMLElement | undefined;
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else {
      const firstChild = el.firstElementChild as HTMLElement | null;
      const cardWidth = firstChild ? firstChild.offsetWidth + 16 : el.clientWidth;
      el.scrollTo({ left: index * cardWidth, behavior: "smooth" });
    }
    setCarouselIndex(index);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${styles.fullscreen} ${chatOpen || pollsOpen ? styles.interactionsOpen : ""}`}
      data-visio-fullscreen-mode="true"
      style={{ height: "var(--visio-viewport-height, 100dvh)", maxHeight: "var(--visio-viewport-height, 100dvh)" }}
      onClick={() => resetActivityTimer()}
      onPointerMove={() => resetActivityTimer()}
    >
      <header
        className={`${styles.topBar} ${!controlsVisible ? styles.topBarHidden : ""}`}
        onClick={(e) => { e.stopPropagation(); resetActivityTimer(); }}
      >
        <div className={styles.roomInfo}>
          <span className={`${styles.liveBadge} ${mediaMode === "blocked" || networkState === "reconnecting" ? styles.liveBadgeWarning : ""}`}>
            <span className={styles.liveDot} />
            {isLoading ? "Connexion..." : mediaMode === "blocked" ? "Mode écoute" : networkState === "reconnecting" ? "Reconnexion..." : isWaitingRoom ? "En attente d'accès" : "En direct"}
          </span>
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>{title}</h3>
            <span className={styles.roomCode}>
              Salle : {roomName} • {totalParticipants} participant{totalParticipants > 1 ? "s" : ""}
            </span>
          </div>

          <div className={styles.headerStatusPill} title={`État du réseau : ${networkState === "reconnecting" ? "Reconnexion..." : "Actif"}`}>
            <span className={`${styles.headerQualityDot} ${remotePeers.some(p => p.quality === "poor") ? styles.headerQualityPoor : remotePeers.some(p => p.quality === "fair") ? styles.headerQualityFair : ""}`} />
            <Wifi size={12} />
            {meetingStartedAt !== null && !isWaitingRoom && !joinRejected && (
              <span>{formatMeetingDuration(meetingElapsedSeconds)}</span>
            )}
          </div>

          {activePoll && (
            <button
              type="button"
              className={`${styles.headerProjectBtn} ${pinnedPeerId === "poll" ? styles.headerProjectBtnActive : ""}`}
              onClick={() => setPinnedPeerId(p => p === "poll" ? null : "poll")}
              title={pinnedPeerId === "poll" ? "Réduire la projection" : "Projeter le sondage au centre de l'appel"}
            >
              <Presentation size={13} />
              <span>{pinnedPeerId === "poll" ? "Quitter scène" : "Projeter"}</span>
            </button>
          )}
        </div>

        <div className={styles.actions}>
          <div className={styles.viewModeDropdownWrap} ref={viewMenuRef}>
            <button
              type="button"
              className={`${styles.btnAction} ${viewMenuOpen ? styles.btnActionActive : ""}`}
              onClick={() => setViewMenuOpen(v => !v)}
              title="Changer la disposition de l'affichage"
              aria-haspopup="menu"
              aria-expanded={viewMenuOpen}
            >
              {viewMode === "gallery" ? <LayoutGrid size={16} /> : viewMode === "speaker" ? <User size={16} /> : <Columns size={16} />}
              <span>Affichage</span>
            </button>
            {viewMenuOpen && (
              <div className={styles.viewModeDropdown} role="menu">
                <span className={styles.viewMenuHeader}>Disposition d'affichage</span>
                <button
                  type="button"
                  className={`${styles.viewMenuItem} ${viewMode === "gallery" ? styles.viewMenuItemActive : ""}`}
                  onClick={() => { setViewMode("gallery"); setViewMenuOpen(false); }}
                >
                  <LayoutGrid size={16} />
                  <div className={styles.viewMenuItemText}>
                    <strong>Galerie</strong>
                    <small>Tous les participants en mosaïque</small>
                  </div>
                  {viewMode === "gallery" && <Check size={14} className={styles.viewMenuCheck} />}
                </button>
                <button
                  type="button"
                  className={`${styles.viewMenuItem} ${viewMode === "speaker" ? styles.viewMenuItemActive : ""}`}
                  onClick={() => { setViewMode("speaker"); setViewMenuOpen(false); }}
                >
                  <User size={16} />
                  <div className={styles.viewMenuItemText}>
                    <strong>Intervenant</strong>
                    <small>L'orateur actif en grand écran</small>
                  </div>
                  {viewMode === "speaker" && <Check size={14} className={styles.viewMenuCheck} />}
                </button>
                <button
                  type="button"
                  className={`${styles.viewMenuItem} ${viewMode === "side-by-side" ? styles.viewMenuItemActive : ""}`}
                  onClick={() => { setViewMode("side-by-side"); setViewMenuOpen(false); }}
                >
                  <Columns size={16} />
                  <div className={styles.viewMenuItemText}>
                    <strong>Côte à côte</strong>
                    <small>Présentation à gauche, participants à droite</small>
                  </div>
                  {viewMode === "side-by-side" && <Check size={14} className={styles.viewMenuCheck} />}
                </button>
                <div className={styles.viewMenuDivider} />
                <button
                  type="button"
                  className={styles.viewMenuItem}
                  onClick={() => { toggleFullscreen(); setViewMenuOpen(false); }}
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                  <div className={styles.viewMenuItemText}>
                    <strong>{isFullscreen ? "Quitter le plein écran" : "Plein écran"}</strong>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.btnAction}
            onClick={toggleThemeMode}
            title={currentTheme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-label={currentTheme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {currentTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{currentTheme === "dark" ? "Clair" : "Sombre"}</span>
          </button>

          <button
            type="button"
            className={styles.btnAction}
            onClick={handleCopyLink}
            title="Copier le lien d'invitation"
          >
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
          </button>

          <button
            type="button"
            className={`${styles.btnAction} ${styles.btnWhatsApp}`}
            onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            title="Partager l'invitation sur WhatsApp"
          >
            <Share2 size={16} />
            <span>Inviter WhatsApp</span>
          </button>
        </div>
      </header>

      <div className={`${styles.stageAndDock} ${chatOpen || pollsOpen ? styles.stageAndDockOpen : ""}`}>
      <div className={styles.stageWrapper}>
        {/* Toast Flottant de Sondage en direct */}
        {activePoll && activePoll.status === "open" && !pollsOpen && dismissedPollId !== activePoll.id && !activePoll.myVote && (
          <div className={styles.pollToastBanner} role="alert">
            <div className={styles.pollToastHeader}>
              <span className={styles.pollToastBadge}>
                <span className={styles.pollToastPulse} />
                <BarChart2 size={13} />
                <span>{activePoll.type === "quiz" ? "Quiz en direct" : activePoll.type === "open" ? "Question libre" : "Sondage en direct"}</span>
              </span>
              {activePoll.closesAt && (
                <span className={styles.pollToastTimer}>
                  <Clock size={12} />
                  <span>{Math.max(0, Math.ceil((activePoll.closesAt - Date.now()) / 1000))}s</span>
                </span>
              )}
              <button
                type="button"
                className={styles.pollToastDismiss}
                onClick={() => setDismissedPollId(activePoll.id)}
                aria-label="Ignorer ce sondage"
              >
                <X size={14} />
              </button>
            </div>
            <p className={styles.pollToastQuestion}>{activePoll.question}</p>
            <div className={styles.pollToastActions}>
              <button
                type="button"
                className={styles.pollToastBtnPrimary}
                onClick={() => {
                  if (chatOpen) {
                    chatOpenRef.current = false;
                    setChatOpen(false);
                  }
                  if (onTogglePolls && !pollsOpen) onTogglePolls();
                }}
              >
                <span>Participer</span>
              </button>
              <button
                type="button"
                className={styles.pollToastBtnStage}
                onClick={() => setPinnedPeerId(p => p === "poll" ? null : "poll")}
                title="Afficher au centre de la visio"
              >
                <Presentation size={14} />
                <span>{pinnedPeerId === "poll" ? "Réduire" : "Projeter"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bannière Push-to-Talk (Barre d'espace) */}
        {isPushToTalkActive && (
          <div className={styles.pushToTalkBanner} role="status">
            <Mic size={15} />
            <span>Micro ouvert temporairement (Espace maintenu)</span>
          </div>
        )}

        {callNotice && <div className={styles.callNotice} role="status" aria-live="polite" onClick={event => event.stopPropagation()}>
          <span>{callNotice}</span>
          {callNoticeTarget && (callNoticeTarget === "chat" || onTogglePolls) && <button type="button" onClick={() => {
            if (callNoticeTarget === "chat" && !chatOpen) toggleChat();
            if (callNoticeTarget === "poll" && !pollsOpen) togglePolls();
            setCallNotice("");
          }}>{callNoticeTarget === "chat" ? "Lire" : "Répondre"}</button>}
          <button type="button" aria-label="Masquer la notification" onClick={() => setCallNotice("")}><X size={16} /></button>
        </div>}
        {isLoading && (
          <div className={styles.noticeBanner}>
            <div className={styles.spinner} />
            <strong>Connexion à la visioconférence Poimén...</strong>
            <p style={{ fontSize: 13, color: "var(--ux-muted)", margin: 0 }}>
              Activation de votre flux audio et vidéo direct.
            </p>
          </div>
        )}

        {permissionError && (
          <div className={styles.permissionAlertBar}>
            <AlertCircle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
              <strong>Micro ou caméra indisponible.</strong>{" "}
              <span>{permissionError}</span>
            </div>
            <button
              type="button"
              className={styles.btnRetryPermission}
              onClick={() => setShowPermissionModal(true)}
              disabled={isLoading}
            >
              Gérer l'accès
            </button>
          </div>
        )}

        {privateRoomUnavailable && (
          <div className={styles.waitingRoomOverlay} role="alert">
            <AlertCircle size={24} />
            <strong>Salle personnalisée indisponible</strong>
            <span>{privateRoomUnavailable}</span>
            <button type="button" onClick={() => {
              if (onRoomUnavailable) onRoomUnavailable(privateRoomUnavailable);
              else onLeaveRef.current?.();
            }}>Quitter</button>
          </div>
        )}

        {totalParticipants === 1 && !isLoading && (
          <div className={styles.waitingHint}>
            <Users size={15} color="#d4af37" />
            <span>Vous êtes seul(e) dans cette réunion. Partagez le lien d'invitation pour accueillir les participants.</span>
          </div>
        )}

        {(isWaitingRoom || joinRejected) && (
          <div className={styles.waitingRoomOverlay} role="status">
            <ShieldCheck size={24} />
            <strong>{joinRejected ? "Demande refusée" : "En attente d’admission"}</strong>
            <span>{joinRejected ? "Contactez l’organisateur pour réessayer." : "Votre demande a été envoyée. Vous serez connecté dès qu’un membre de l’équipe vous aura admis."}</span>
            {joinRejected && <button type="button" onClick={() => { setJoinRejected(false); setIsWaitingRoom(true); channelRef.current?.send({ type: "broadcast", event: "PEER_JOIN", payload: { peerId: localPeerId, participantId, peerName: userName, isHost: false, isAdmitted: false } }); }}>Demander à nouveau</button>}
          </div>
        )}

        {isHost && waitingParticipants.length > 0 && (
          <div className={styles.lobbyPanel}>
            <strong>Invités en attente</strong>
            <small>Cette admission facilite la réunion, mais le lien reste accessible hors de ce contrôle d’interface.</small>
            {waitingParticipants.map(person => {
              const isResponding = respondingLobbyPeersRef.current.has(person.participantId) || respondingLobbyPeersRef.current.has(person.peerId);
              return (
                <div className={styles.lobbyRow} key={person.peerId}>
                  <span>{person.name}</span>
                  <button type="button" disabled={isResponding} onClick={() => void respondToWaitingParticipant(person, true)}>
                    {isResponding ? "Admission..." : "Admettre"}
                  </button>
                  <button type="button" disabled={isResponding} onClick={() => void respondToWaitingParticipant(person, false)}>
                    Refuser
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.reactionLayer}>
          {floatingReactions.map(item => <div key={item.id} className={styles.floatingReaction} style={{ left: `${item.left}%`, animationDuration: `${item.duration}ms` }}>
            <AnimatedReactionEmoji emoji={item.reaction} className={styles.floatingEmoji} animated />
            <span className={styles.floatingName}>{item.peerId === localPeerId ? "Vous" : item.name}</span>
          </div>)}
          <span className={styles.srOnly} role="status" aria-live="polite">{reactionAnnouncement}</span>
        </div>

        {/* Carrousel Mobile : Barre de navigation élégante quand le chat ou les sondages sont ouverts */}
        {isMobileScreen && (chatOpen || pollsOpen) && totalParticipants > 1 && (
          <div className={styles.carouselNavBar} role="region" aria-label="Navigation des participants">
            <button
              type="button"
              className={styles.carouselNavArrow}
              onClick={() => scrollToParticipant(Math.max(0, carouselIndex - 1))}
              disabled={carouselIndex === 0}
              aria-label="Participant précédent"
            >
              <ChevronLeft size={14} />
            </button>

            <div className={styles.carouselNavCenter}>
              <span className={styles.carouselNavLabel}>
                {carouselIndex + 1}/{totalParticipants} • {allCarouselParticipants[carouselIndex]?.name || ""}
              </span>
              <div className={styles.carouselDots}>
                {allCarouselParticipants.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.carouselDot} ${idx === carouselIndex ? styles.carouselDotActive : ""}`}
                    onClick={() => scrollToParticipant(idx)}
                    aria-label={`Afficher ${p.name}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.carouselNavArrow}
              onClick={() => scrollToParticipant(Math.min(totalParticipants - 1, carouselIndex + 1))}
              disabled={carouselIndex >= totalParticipants - 1}
              aria-label="Participant suivant"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Grille Vidéo et Dispositions Dynamiques (Galerie, Intervenant, Côte à côte type Zoom) */}
        {(() => {
          const screenSharingRemotePeer = remotePeers.find(p => p.isScreenSharing);
          const isPollSpotlight = pinnedPeerId === "poll";
          const isLocalSpotlight = pinnedPeerId === "local" || (isScreenSharing && !pinnedPeerId && !screenSharingRemotePeer);
          const spotlightPeer = pinnedPeerId && pinnedPeerId !== "local" && pinnedPeerId !== "poll"
            ? remotePeers.find(p => p.id === pinnedPeerId)
            : screenSharingRemotePeer || remotePeers.find(p => p.id === activeSpeakerId) || remotePeers[0] || null;

          // En mode mobile avec chat/sondages ouverts, forcer le carrousel galerie horizontal
          const isMobileInteractions = isMobileScreen && (chatOpen || pollsOpen);
          const effectiveMode = isMobileInteractions
            ? "gallery"
            : (isScreenSharing || screenSharingRemotePeer) && viewMode === "gallery" && totalParticipants > 1
              ? (isMobileScreen ? "speaker" : "side-by-side")
              : viewMode;

          const renderPollCard = () => activePoll && (
            <div className={styles.pollStageCard}>
              <div className={styles.pollStageHeader}>
                <span className={styles.pollStageBadge}>
                  <BarChart2 size={16} />
                  <span>{activePoll.type === "quiz" ? "Quiz en direct" : activePoll.type === "open" ? "Question libre" : "Sondage en direct"}</span>
                </span>
                <div className={styles.pollStageStats}>
                  <span>{activePoll.totalVotes} vote{activePoll.totalVotes !== 1 ? "s" : ""}</span>
                  <button
                    type="button"
                    className={styles.pollStageCloseBtn}
                    onClick={() => setPinnedPeerId(null)}
                    title="Quitter la scène"
                    aria-label="Quitter la scène"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <h3 className={styles.pollStageQuestion}>{activePoll.question}</h3>
              {activePoll.type !== "open" && activePoll.options && (
                <div className={styles.pollStageOptions}>
                  {activePoll.options.map((opt, idx) => {
                    const count = activePoll.counts?.[opt.id] || 0;
                    const percent = activePoll.totalVotes ? Math.round(count * 100 / activePoll.totalVotes) : 0;
                    const maxCount = activePoll.totalVotes > 0 && activePoll.counts ? Math.max(...activePoll.options.map(o => activePoll.counts?.[o.id] || 0)) : 0;
                    const isWinner = maxCount > 0 && count === maxCount && activePoll.totalVotes >= 2;
                    return (
                      <div key={opt.id} className={`${styles.pollStageOption} ${isWinner ? styles.pollStageWinner : ""}`}>
                        {activePoll.counts && <div className={styles.pollStageBar} style={{ width: `${percent}%` }} />}
                        <span className={styles.pollStageOptionLetter}>
                          {isWinner ? <Crown size={15} /> : String.fromCharCode(65 + idx)}
                        </span>
                        <span className={styles.pollStageOptionText}>{opt.text}</span>
                        {activePoll.counts && (
                          <span className={styles.pollStagePercent}>{percent}% ({count})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.pollStageFooter}>
                <button
                  type="button"
                  className={styles.pollStageActionBtn}
                  onClick={() => {
                    if (chatOpen) {
                      chatOpenRef.current = false;
                      setChatOpen(false);
                    }
                    if (onTogglePolls && !pollsOpen) onTogglePolls();
                  }}
                >
                  <BarChart2 size={16} />
                  <span>{activePoll.myVote ? "Voir les détails dans le panneau" : "Participer et voter"}</span>
                </button>
              </div>
            </div>
          );

          // 1. DISPOSITION CÔTE À CÔTE (Style Zoom Side-by-Side)
          if (effectiveMode === "side-by-side" && totalParticipants > 1) {
            return (
              <div className={styles.sideBySideContainer} onClick={handleStageClick}>
                <div className={styles.sideBySideStage}>
                  {isPollSpotlight && activePoll ? (
                    renderPollCard()
                  ) : isLocalSpotlight || !spotlightPeer ? (
                    <LocalVideoTile
                      videoRef={localVideoRef}
                      stream={localStreamRef.current || localStream}
                      userName={userName}
                      isScreenSharing={isScreenSharing}
                      isVideoOff={isVideoOff}
                      isMicMuted={isMicMuted}
                      isLocalSpeaking={isLocalSpeaking}
                      handRaised={handRaised}
                      facingMode={currentFacingMode}
                      isPinned={Boolean(pinnedPeerId === "local")}
                      onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
                    />
                  ) : (
                    <RemoteVideoTile
                      peer={spotlightPeer}
                      isHost={isHost}
                      onModerate={moderatePeer}
                      isPinned={Boolean(pinnedPeerId === spotlightPeer.id)}
                      onPin={() => setPinnedPeerId(pinnedPeerId === spotlightPeer.id ? null : spotlightPeer.id)}
                    />
                  )}
                </div>

                <div className={styles.sideBySideSidebar}>
                  {(!isLocalSpotlight || isPollSpotlight) && (
                    <div className={styles.sideBySideTile}>
                      <LocalVideoTile
                        videoRef={localVideoRef}
                        stream={localStreamRef.current || localStream}
                        userName={userName}
                        isScreenSharing={isScreenSharing}
                        isVideoOff={isVideoOff}
                        isMicMuted={isMicMuted}
                        isLocalSpeaking={isLocalSpeaking}
                        handRaised={handRaised}
                        facingMode={currentFacingMode}
                        isPinned={pinnedPeerId === "local"}
                        onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
                      />
                    </div>
                  )}
                  {remotePeers
                    .filter(p => isPollSpotlight || !spotlightPeer || p.id !== spotlightPeer.id)
                    .map(peer => (
                      <div className={styles.sideBySideTile} key={peer.id}>
                        <RemoteVideoTile
                          peer={peer}
                          isHost={isHost}
                          onModerate={moderatePeer}
                          isPinned={pinnedPeerId === peer.id}
                          onPin={() => setPinnedPeerId(pinnedPeerId === peer.id ? null : peer.id)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            );
          }

          // 2. DISPOSITION INTERVENANT (Speaker)
          if ((effectiveMode === "speaker" || pinnedPeerId !== null) && totalParticipants > 1 && effectiveMode !== "gallery") {
            return (
              <div className={styles.spotlightContainer} onClick={handleStageClick}>
                <div className={styles.spotlightStage}>
                  {isPollSpotlight && activePoll ? (
                    renderPollCard()
                  ) : isLocalSpotlight || !spotlightPeer ? (
                    <LocalVideoTile
                      videoRef={localVideoRef}
                      stream={localStreamRef.current || localStream}
                      userName={userName}
                      isScreenSharing={isScreenSharing}
                      isVideoOff={isVideoOff}
                      isMicMuted={isMicMuted}
                      isLocalSpeaking={isLocalSpeaking}
                      handRaised={handRaised}
                      facingMode={currentFacingMode}
                      isPinned={Boolean(pinnedPeerId === "local")}
                      onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
                    />
                  ) : (
                    <RemoteVideoTile
                      peer={spotlightPeer}
                      isHost={isHost}
                      onModerate={moderatePeer}
                      isPinned={Boolean(pinnedPeerId === spotlightPeer.id)}
                      onPin={() => setPinnedPeerId(pinnedPeerId === spotlightPeer.id ? null : spotlightPeer.id)}
                    />
                  )}
                </div>

                <div className={styles.filmstrip}>
                  {(!isLocalSpotlight || isPollSpotlight) && (
                    <div className={styles.filmstripTile}>
                      <LocalVideoTile
                        videoRef={localVideoRef}
                        stream={localStreamRef.current || localStream}
                        userName={userName}
                        isScreenSharing={isScreenSharing}
                        isVideoOff={isVideoOff}
                        isMicMuted={isMicMuted}
                        isLocalSpeaking={isLocalSpeaking}
                        handRaised={handRaised}
                        facingMode={currentFacingMode}
                        isPinned={pinnedPeerId === "local"}
                        onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
                      />
                    </div>
                  )}
                  {remotePeers
                    .filter(p => isPollSpotlight || !spotlightPeer || p.id !== spotlightPeer.id)
                    .map(peer => (
                      <div className={styles.filmstripTile} key={peer.id}>
                        <RemoteVideoTile
                          peer={peer}
                          isHost={isHost}
                          onModerate={moderatePeer}
                          isPinned={pinnedPeerId === peer.id}
                          onPin={() => setPinnedPeerId(pinnedPeerId === peer.id ? null : peer.id)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            );
          }

          // 3. DISPOSITION GALERIE (Par défaut : Mosaïque équilibrée ou Carrousel mobile)
          return (
            <div
              ref={carouselGridRef}
              onScroll={isMobileScreen && (chatOpen || pollsOpen) ? handleCarouselScroll : undefined}
              className={`${styles.videoGrid} ${gridClass}`}
              onClick={handleStageClick}
            >
              <LocalVideoTile
                videoRef={localVideoRef}
                stream={localStreamRef.current || localStream}
                userName={userName}
                isScreenSharing={isScreenSharing}
                isVideoOff={isVideoOff}
                isMicMuted={isMicMuted}
                isLocalSpeaking={isLocalSpeaking}
                handRaised={handRaised}
                facingMode={currentFacingMode}
                isPinned={pinnedPeerId === "local"}
                onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
              />
              {remotePeers.map((peer) => (
                <RemoteVideoTile
                  key={peer.id}
                  peer={peer}
                  isHost={isHost}
                  onModerate={moderatePeer}
                  isPinned={pinnedPeerId === peer.id}
                  onPin={() => setPinnedPeerId(pinnedPeerId === peer.id ? null : peer.id)}
                />
              ))}
            </div>
          );
        })()}
      </div>

      <div
        className={`${styles.interactionDock} ${chatOpen || pollsOpen ? styles.interactionDockOpen : ""}`}
        data-visio-interaction-dock="true"
        aria-hidden={!chatOpen && !pollsOpen}
      >
        {chatOpen && <aside className={`${styles.chatPanel} ${styles.dockPanel}`} aria-label="Chat de la réunion">
          <div className={styles.chatHeader}><strong>Messages de la réunion</strong><button type="button" onClick={() => void closeChatPanel()} aria-label="Fermer le chat">×</button></div>
          <div ref={chatScrollRef} className={styles.chatMessages} role="log" aria-label="Messages de la réunion" aria-live="polite" aria-relevant="additions" onScroll={event => {
            const list = event.currentTarget;
            const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
            followChatRef.current = isNearBottom;
            if (isNearBottom) setHasNewChatMessages(false);
          }}>
            {chatMessages.length === 0 ? <div className={styles.chatEmptyState}>
              <span className={styles.chatEmptyIcon} aria-hidden="true"><MessageSquare size={20} /></span>
              <strong>Aucun message pour l’instant</strong>
              <p>Démarrez la conversation avec l’équipe.</p>
            </div> : chatMessages.map(message => <article className={`${styles.chatMessage} ${message.peerId === localPeerId ? styles.chatMessageOwn : ""}`} key={message.id}>
              <div className={styles.chatMessageMeta}><strong>{message.peerId === localPeerId ? "Vous" : message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.text}</p>
            </article>)}
          </div>
          {hasNewChatMessages && <button type="button" className={styles.newChatMessages} onClick={() => {
            followChatRef.current = true;
            setHasNewChatMessages(false);
            const list = chatScrollRef.current;
            if (list) list.scrollTop = list.scrollHeight;
          }}><ChevronDown size={16} /> Nouveaux messages</button>}
          <form className={styles.chatForm} onSubmit={sendChatMessage}>
            <textarea ref={chatInputRef} aria-label="Votre message" rows={1} maxLength={500} value={chatDraft}
              onChange={event => setChatDraft(event.target.value)} placeholder="Écrire un message…"
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !isMobileScreen) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} />
            <button type="submit" disabled={!chatDraft.trim()} aria-label="Envoyer"><Send size={16} /></button>
          </form>
        </aside>}
      </div>
      </div>

      {/* 1. Barre de contrôle Desktop (Complète et jamais masquée) */}
      <footer
        className={`${styles.controlsBar} ${styles.controlsBarDesktop} ${!controlsVisible ? styles.controlsHidden : ""}`}
        onClick={(e) => { e.stopPropagation(); resetActivityTimer(); }}
      >
        {/* Micro avec sélecteur de périphérique */}
        <div className={styles.ctrlBtnGroup}>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${isMicMuted ? styles.ctrlBtnOff : ""}`}
            onClick={toggleMic}
            disabled={isLoading}
            aria-pressed={!isMicMuted}
            title={!localStream?.getAudioTracks().length ? "Autoriser le micro" : isMicMuted ? "Activer le micro (M ou Espace)" : "Couper le micro (M)"}
          >
            {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{isMicMuted ? "Micro coupé" : "Micro actif"}</span>
          </button>
          {availableAudioDevices.length > 1 && (
            <button
              type="button"
              className={styles.ctrlBtnChevron}
              onClick={() => setDeviceMenuOpen(d => d === "audio" ? null : "audio")}
              title="Choisir le microphone"
              aria-label="Choisir le microphone"
            >
              {deviceMenuOpen === "audio" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {deviceMenuOpen === "audio" && (
            <div className={styles.deviceMenuDropdown}>
              <span className={styles.deviceMenuTitle}>Microphones disponibles</span>
              {availableAudioDevices.map(dev => (
                <button
                  key={dev.deviceId}
                  type="button"
                  className={`${styles.deviceMenuItem} ${dev.deviceId === activeAudioDeviceId ? styles.deviceMenuItemActive : ""}`}
                  onClick={() => switchAudioDevice(dev.deviceId)}
                >
                  <span>{dev.label || `Microphone ${dev.deviceId.slice(0, 5)}`}</span>
                  {dev.deviceId === activeAudioDeviceId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Caméra avec sélecteur de périphérique */}
        <div className={styles.ctrlBtnGroup}>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${isVideoOff ? styles.ctrlBtnOff : ""}`}
            onClick={toggleCam}
            disabled={isLoading}
            aria-pressed={!isVideoOff}
            title={!localStream?.getVideoTracks().length ? "Autoriser la caméra" : isVideoOff ? "Activer la caméra (V)" : "Couper la caméra (V)"}
          >
            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            <span>{isVideoOff ? "Caméra coupée" : "Caméra"}</span>
          </button>
          {availableVideoDevices.length > 1 && (
            <button
              type="button"
              className={styles.ctrlBtnChevron}
              onClick={() => setDeviceMenuOpen(d => d === "video" ? null : "video")}
              title="Choisir la caméra"
              aria-label="Choisir la caméra"
            >
              {deviceMenuOpen === "video" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {deviceMenuOpen === "video" && (
            <div className={styles.deviceMenuDropdown}>
              <span className={styles.deviceMenuTitle}>Caméras disponibles</span>
              {availableVideoDevices.map(dev => (
                <button
                  key={dev.deviceId}
                  type="button"
                  className={`${styles.deviceMenuItem} ${dev.deviceId === activeVideoDeviceId ? styles.deviceMenuItemActive : ""}`}
                  onClick={() => switchVideoDevice(dev.deviceId)}
                >
                  <span>{dev.label || `Caméra ${dev.deviceId.slice(0, 5)}`}</span>
                  {dev.deviceId === activeVideoDeviceId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Partage d'écran */}
        <button
          type="button"
          className={`${styles.ctrlBtn} ${isScreenSharing ? styles.ctrlBtnActive : ""}`}
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Arrêter le partage d'écran" : "Partager l'écran"}
        >
          <Monitor size={18} />
          <span>{isScreenSharing ? "Arrêter partage" : "Partager écran"}</span>
        </button>

        {/* Main levée */}
        <button
          type="button"
          className={`${styles.ctrlBtn} ${handRaised ? styles.ctrlBtnActive : ""}`}
          onClick={toggleHand}
          aria-pressed={handRaised}
          title={handRaised ? "Baisser la main (H)" : "Lever la main (H)"}
        >
          <Hand size={18} />
          <span>{handRaised ? "Main levée" : "Lever la main"}</span>
        </button>

        {/* Réactions */}
        <div className={styles.reactionPickerWrap} ref={reactionPickerRef}>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${reactionsOpen ? styles.ctrlBtnActive : ""}`}
            ref={reactionTriggerRef}
            onClick={() => setReactionsOpen(open => !open)}
            aria-label="Choisir une réaction"
            aria-haspopup="dialog"
            aria-expanded={reactionsOpen}
            title="Réactions"
          >
            <Smile size={19} />
            <span>Réactions</span>
          </button>
          {reactionsOpen && <div className={styles.reactionPicker} style={{ bottom: `${reactionPickerBottom}px` }} role="dialog" aria-label="Choisir une réaction">
            {quickReactions.map(reaction => <button
              type="button"
              key={reaction.emoji}
              className={styles.reactionOption}
              onClick={() => { sendReaction(reaction.emoji); setReactionsOpen(false); }}
              aria-label={reaction.emoji === "🙌" ? "Dire Amen" : `Réagir : ${reaction.label}`}
            >
              <AnimatedReactionEmoji emoji={reaction.emoji} className={styles.reactionEmoji} />
            </button>)}
          </div>}
        </div>

        {/* Chat */}
        <button
          type="button"
          className={`${styles.ctrlBtn} ${chatOpen ? styles.ctrlBtnActive : ""}`}
          onClick={toggleChat}
          aria-pressed={chatOpen}
          aria-label={`${chatOpen ? "Fermer" : "Ouvrir"} le chat`}
          title="Chat de la réunion (C)"
        >
          <MessageSquare size={18} />
          <span>Chat</span>
          {unreadChatCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>}
        </button>

        {/* Sondages */}
        {onTogglePolls && (
          <button
            type="button"
            className={`${styles.ctrlBtn} ${pollsOpen ? styles.ctrlBtnActive : ""}`}
            onClick={togglePolls}
            aria-label={`${pollsOpen ? "Fermer" : "Ouvrir"} les sondages`}
            title="Ouvrir les sondages & quiz"
          >
            <BarChart2 size={18} />
            <span>Sondages</span>
            {unreadPollCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadPollCount > 9 ? "9+" : unreadPollCount}</span>}
          </button>
        )}

        {/* Animateur : Salle d'attente */}
        {isHost && (
          <button
            type="button"
            className={`${styles.ctrlBtn} ${roomLocked ? styles.ctrlBtnActive : ""}`}
            onClick={toggleWaitingRoom}
            aria-pressed={roomLocked}
            title={roomLocked ? "Salle d'attente activée" : "Salle ouverte"}
          >
            <ShieldCheck size={18} />
            <span>{roomLocked ? "Attente" : "Ouverte"}{waitingParticipants.length ? ` · ${waitingParticipants.length}` : ""}</span>
          </button>
        )}

        {/* Plein écran */}
        <button
          type="button"
          className={`${styles.ctrlBtn} ${isFullscreen ? styles.ctrlBtnActive : ""}`}
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          title={isFullscreen ? "Quitter le plein écran (F)" : "Passer en plein écran (F)"}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          <span>{isFullscreen ? "Réduire" : "Plein écran"}</span>
        </button>

        {/* Quitter */}
        {onLeave && (
          <button
            type="button"
            className={`${styles.ctrlBtn} ${styles.ctrlBtnLeave}`}
            onClick={leaveMeeting}
            title="Quitter la réunion"
          >
            <PhoneOff size={18} />
            <span>Quitter</span>
          </button>
        )}
      </footer>

      {/* 2. Barre de contrôle Mobile (5 gros boutons tactiles ergonomiques) */}
      <footer
        className={`${styles.controlsBarMobile} ${!controlsVisible ? styles.controlsHidden : ""}`}
        onClick={(e) => { e.stopPropagation(); resetActivityTimer(); }}
      >
        {/* Micro */}
        <button
          type="button"
          className={`${styles.ctrlBtnRound} ${isMicMuted ? styles.ctrlBtnRoundOff : ""}`}
          onClick={toggleMic}
          disabled={isLoading}
          aria-label={isMicMuted ? "Activer le micro" : "Couper le micro"}
          title={isMicMuted ? "Activer le micro" : "Couper le micro"}
        >
          {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Caméra */}
        <button
          type="button"
          className={`${styles.ctrlBtnRound} ${isVideoOff ? styles.ctrlBtnRoundOff : ""}`}
          onClick={toggleCam}
          disabled={isLoading}
          aria-label={isVideoOff ? "Activer la caméra" : "Couper la caméra"}
          title={isVideoOff ? "Activer la caméra" : "Couper la caméra"}
        >
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>

        {/* Inverser caméra (si caméra active) OU Main levée */}
        {!isVideoOff ? (
          <button
            type="button"
            className={styles.ctrlBtnRound}
            onClick={flipCamera}
            aria-label="Inverser la caméra"
            title="Inverser la caméra avant/arrière"
          >
            <SwitchCamera size={22} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.ctrlBtnRound} ${handRaised ? styles.ctrlBtnRoundActive : ""}`}
            onClick={toggleHand}
            aria-label={handRaised ? "Baisser la main" : "Lever la main"}
            title={handRaised ? "Baisser la main" : "Lever la main"}
          >
            <Hand size={22} />
          </button>
        )}

        {/* Plus (...) pour ouvrir le tiroir modal */}
        <button
          type="button"
          className={`${styles.ctrlBtnRound} ${(unreadChatCount > 0 || unreadPollCount > 0) ? styles.ctrlBtnRoundActive : ""}`}
          onClick={() => setMoreSheetOpen(true)}
          aria-label="Plus d'options"
          title="Plus d'options"
        >
          <MoreHorizontal size={22} />
          {(unreadChatCount > 0 || unreadPollCount > 0) && (
            <span className={styles.notificationBadge} aria-hidden="true">
              {unreadChatCount + unreadPollCount > 9 ? "9+" : unreadChatCount + unreadPollCount}
            </span>
          )}
        </button>

        {/* Quitter */}
        {onLeave && (
          <button
            type="button"
            className={`${styles.ctrlBtnRound} ${styles.ctrlBtnRoundLeave}`}
            onClick={leaveMeeting}
            aria-label="Quitter la réunion"
            title="Quitter la réunion"
          >
            <PhoneOff size={22} />
          </button>
        )}
      </footer>

      {/* 3. Tiroir tactile inférieur Mobile (Bottom Sheet) */}
      {moreSheetOpen && (
        <div
          className={styles.bottomSheetBackdrop}
          onClick={() => setMoreSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Options de la réunion"
        >
          <div className={styles.bottomSheetCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bottomSheetHandle} />
            <div className={styles.bottomSheetHeader}>
              <span>Options de la réunion</span>
              <button
                type="button"
                className={styles.bottomSheetClose}
                onClick={() => setMoreSheetOpen(false)}
                aria-label="Fermer les options"
              >
                <X size={16} />
              </button>
            </div>

            {/* Réactions rapides en haut du tiroir (au premier plan) */}
            <div className={styles.bottomSheetReactionsSection}>
              <span className={styles.bottomSheetSectionTitle}>Réactions rapides</span>
              <div className={styles.bottomSheetReactions}>
                {quickReactions.slice(0, 6).map(r => (
                  <button
                    key={r.emoji}
                    type="button"
                    className={styles.bottomSheetEmojiBtn}
                    onClick={() => {
                      sendReaction(r.emoji);
                      setMoreSheetOpen(false);
                    }}
                    aria-label={`Réagir ${r.label}`}
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur de disposition façon Zoom */}
            <div className={styles.bottomSheetViewSection}>
              <span className={styles.bottomSheetViewTitle}>Disposition d'affichage</span>
              <div className={styles.bottomSheetViewSegment}>
                <button
                  type="button"
                  className={`${styles.bottomSheetViewBtn} ${viewMode === "gallery" ? styles.bottomSheetViewBtnActive : ""}`}
                  onClick={() => setViewMode("gallery")}
                >
                  <LayoutGrid size={18} />
                  <span>Galerie</span>
                </button>
                <button
                  type="button"
                  className={`${styles.bottomSheetViewBtn} ${viewMode === "speaker" ? styles.bottomSheetViewBtnActive : ""}`}
                  onClick={() => setViewMode("speaker")}
                >
                  <User size={18} />
                  <span>Intervenant</span>
                </button>
                <button
                  type="button"
                  className={`${styles.bottomSheetViewBtn} ${viewMode === "side-by-side" ? styles.bottomSheetViewBtnActive : ""}`}
                  onClick={() => setViewMode("side-by-side")}
                >
                  <Columns size={18} />
                  <span>Côte à côte</span>
                </button>
              </div>
            </div>

            <div className={styles.bottomSheetGrid}>
              <button
                type="button"
                className={`${styles.bottomSheetItem} ${chatOpen ? styles.bottomSheetItemActive : ""}`}
                onClick={() => {
                  setMoreSheetOpen(false);
                  toggleChat();
                }}
              >
                <MessageSquare size={22} />
                <span>Chat {unreadChatCount > 0 ? `(${unreadChatCount})` : ""}</span>
              </button>

              {onTogglePolls && (
                <button
                  type="button"
                  className={`${styles.bottomSheetItem} ${pollsOpen ? styles.bottomSheetItemActive : ""}`}
                  onClick={() => {
                    setMoreSheetOpen(false);
                    togglePolls();
                  }}
                >
                  <BarChart2 size={22} />
                  <span>Sondages {unreadPollCount > 0 ? `(${unreadPollCount})` : ""}</span>
                </button>
              )}

              <button
                type="button"
                className={`${styles.bottomSheetItem} ${handRaised ? styles.bottomSheetItemActive : ""}`}
                onClick={() => {
                  toggleHand();
                }}
              >
                <Hand size={22} />
                <span>{handRaised ? "Baisser main" : "Lever main"}</span>
              </button>

              <button
                type="button"
                className={styles.bottomSheetItem}
                onClick={() => {
                  void flipCamera();
                }}
              >
                <SwitchCamera size={22} />
                <span>Inverser caméra</span>
              </button>

              <button
                type="button"
                className={`${styles.bottomSheetItem} ${isScreenSharing ? styles.bottomSheetItemActive : ""}`}
                onClick={() => {
                  setMoreSheetOpen(false);
                  void toggleScreenShare();
                }}
              >
                <Monitor size={22} />
                <span>{isScreenSharing ? "Arrêter partage" : "Partager écran"}</span>
              </button>

              <button
                type="button"
                className={styles.bottomSheetItem}
                onClick={() => {
                  void handleCopyLink();
                  setMoreSheetOpen(false);
                }}
              >
                {copied ? <Check size={22} color="#10b981" /> : <Copy size={22} />}
                <span>{copied ? "Lien copié !" : "Copier lien"}</span>
              </button>

              <button
                type="button"
                className={styles.bottomSheetItem}
                onClick={() => {
                  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                  setMoreSheetOpen(false);
                }}
              >
                <Share2 size={22} color="#25d366" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                className={styles.bottomSheetItem}
                onClick={() => {
                  toggleFullscreen();
                  setMoreSheetOpen(false);
                }}
              >
                {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                <span>{isFullscreen ? "Réduire" : "Plein écran"}</span>
              </button>

              <button
                type="button"
                className={styles.bottomSheetItem}
                onClick={toggleThemeMode}
              >
                {currentTheme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
                <span>{currentTheme === "dark" ? "Mode clair" : "Mode sombre"}</span>
              </button>

              {isHost && (
                <button
                  type="button"
                  className={`${styles.bottomSheetItem} ${roomLocked ? styles.bottomSheetItemActive : ""}`}
                  onClick={() => {
                    toggleWaitingRoom();
                  }}
                >
                  <ShieldCheck size={22} />
                  <span>{roomLocked ? "Attente ON" : "Salle ouverte"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Modale d'autorisation caméra et micro */}
      {showPermissionModal && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="permission-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPermissionModal(false);
          }}
        >
          <div className={styles.modalCard}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowPermissionModal(false)}
              aria-label="Fermer la boîte de dialogue"
            >
              <X size={16} />
            </button>

            <div className={`${styles.modalIconWrapper} ${styles.modalIconPermission}`}>
              <Camera size={28} />
            </div>

            <div className={styles.modalHeader}>
              <h3 id="permission-modal-title" className={styles.modalTitle}>
                Autorisation du micro et de la caméra
              </h3>
              <p className={styles.modalDescription}>
                Pour échanger avec les autres participants et être vu(e), votre navigateur a besoin de votre autorisation d'accès.
              </p>
            </div>

            <div className={styles.modalHighlightBox}>
              <div className={styles.modalPointRow}>
                <Check size={16} className={styles.modalPointIcon} style={{ color: "#10b981" }} />
                <span><strong>Échanges fraternels :</strong> Participez activement aux prières, partages et discussions.</span>
              </div>
              <div className={styles.modalPointRow}>
                <ShieldCheck size={16} className={styles.modalPointIcon} style={{ color: "var(--gold, #d4af37)" }} />
                <span><strong>Vie privée préservée :</strong> Les flux vidéo et audio sont chiffrés de bout en bout et jamais enregistrés.</span>
              </div>
              <div className={styles.modalPointRow}>
                <Lock size={16} className={styles.modalPointIcon} style={{ color: "#38bdf8" }} />
                <span><strong>Contrôle total :</strong> Vous pouvez couper votre micro ou votre caméra d’un simple clic à tout moment.</span>
              </div>
              {permissionError && (
                <div className={styles.modalPointRow} style={{ color: "#fbbf24", borderTop: "1px dashed rgba(245, 158, 11, 0.3)", paddingTop: 8, marginTop: 4 }}>
                  <AlertCircle size={16} className={styles.modalPointIcon} style={{ color: "#f59e0b" }} />
                  <span><em>Astuce :</em> Si l'accès est bloqué, cliquez sur l'icône de cadenas ou de réglages à gauche de l'adresse web pour autoriser micro et caméra, puis cliquez ci-dessous.</span>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={() => setShowPermissionModal(false)}
              >
                Continuer en écoute seule
              </button>
              <button
                type="button"
                className={styles.modalBtnPrimary}
                disabled={isLoading}
                onClick={async () => {
                  await retryPermissions();
                  if (!permissionError) setShowPermissionModal(false);
                }}
              >
                <Camera size={16} />
                <span>{isLoading ? "Activation..." : "Activer micro et caméra"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modale d'actualisation de la page pendant l'appel */}
      {showReloadModal && (
        <div
          className={styles.modalBackdrop}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reload-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReloadModal(false);
          }}
        >
          <div className={styles.modalCard}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowReloadModal(false)}
              aria-label="Fermer la boîte de dialogue"
            >
              <X size={16} />
            </button>

            <div className={`${styles.modalIconWrapper} ${styles.modalIconReload}`}>
              <RotateCcw size={28} />
            </div>

            <div className={styles.modalHeader}>
              <h3 id="reload-modal-title" className={styles.modalTitle}>
                Actualiser la page ?
              </h3>
              <p className={styles.modalDescription}>
                Attention : si vous actualisez la page, vous serez immédiatement déconnecté(e) de l'appel.
              </p>
            </div>

            <div className={`${styles.modalHighlightBox} ${styles.modalHighlightWarning}`}>
              <div className={styles.modalPointRow}>
                <AlertTriangle size={18} className={styles.modalPointIcon} style={{ color: "#f59e0b" }} />
                <div>
                  <strong>Votre connexion à la réunion sera coupée.</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, opacity: 0.95, lineHeight: 1.4 }}>
                    Votre transmission vidéo et audio s'arrêtera pour vous et tous les participants. Vous devrez rejoindre la salle à nouveau (et attendre l’admission par l'animateur si la salle est verrouillée).
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.35)" }}
                onClick={() => {
                  setShowReloadModal(false);
                  allowPageExitRef.current = true;
                  window.location.reload();
                }}
              >
                <RotateCcw size={15} />
                <span>Actualiser et quitter</span>
              </button>
              <button
                type="button"
                className={styles.modalBtnPrimary}
                autoFocus
                onClick={() => setShowReloadModal(false)}
              >
                <Check size={16} />
                <span>Rester dans l'appel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modale pour sortir / quitter l'appel */}
      {showLeaveModal && (
        <div
          className={styles.modalBackdrop}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="leave-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLeaveModal(false);
          }}
        >
          <div className={styles.modalCard}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => {
                pendingNavigationUrlRef.current = null;
                setShowLeaveModal(false);
              }}
              aria-label="Fermer la boîte de dialogue"
            >
              <X size={16} />
            </button>

            <div className={`${styles.modalIconWrapper} ${styles.modalIconLeave}`}>
              <PhoneOff size={28} />
            </div>

            <div className={styles.modalHeader}>
              <h3 id="leave-modal-title" className={styles.modalTitle}>
                Quitter la réunion ?
              </h3>
              <p className={styles.modalDescription}>
                {isHost
                  ? "Vous êtes l'animateur de cet appel. Si vous quittez, la salle continuera pour les autres participants."
                  : "Êtes-vous sûr(e) de vouloir vous déconnecter de cette visioconférence ?"}
              </p>
            </div>

            <div className={`${styles.modalHighlightBox} ${styles.modalHighlightDanger}`}>
              <div className={styles.modalPointRow}>
                <PhoneOff size={16} className={styles.modalPointIcon} style={{ color: "#ef4444" }} />
                <span>
                  Votre micro et votre caméra seront immédiatement éteints et vous sortirez de l'espace de réunion.
                </span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={() => {
                  pendingNavigationUrlRef.current = null;
                  setShowLeaveModal(false);
                }}
              >
                Annuler et rester
              </button>
              <button
                type="button"
                className={styles.modalBtnDanger}
                autoFocus
                onClick={() => {
                  setShowLeaveModal(false);
                  allowPageExitRef.current = true;
                  try {
                    sessionStorage.removeItem("visio_active_session");
                  } catch {}
                  if (document.fullscreenElement && document.exitFullscreen) {
                    void document.exitFullscreen().catch(() => {});
                  }
                  if (pendingNavigationUrlRef.current) {
                    const url = pendingNavigationUrlRef.current;
                    pendingNavigationUrlRef.current = null;
                    window.location.href = url;
                  } else {
                    onLeave?.();
                  }
                }}
              >
                <PhoneOff size={16} />
                <span>Quitter la réunion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant Tuile pour la vidéo locale (Vous)
function LocalVideoTile({
  videoRef,
  stream,
  userName,
  isScreenSharing,
  isVideoOff,
  isMicMuted,
  isLocalSpeaking,
  handRaised,
  isPinned,
  onPin,
  isPip,
  facingMode = "user",
}: {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  userName: string;
  isScreenSharing: boolean;
  isVideoOff: boolean;
  isMicMuted: boolean;
  isLocalSpeaking: boolean;
  handRaised: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  isPip?: boolean;
  facingMode?: "user" | "environment";
}) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("cover");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    internalRef.current = node;
    if (videoRef) {
      if (typeof videoRef === "function") {
        (videoRef as any)(node);
      } else {
        (videoRef as any).current = node;
      }
    }
    if (node && stream) {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.play().catch(() => {});
    }
  }, [videoRef, stream]);

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.play().catch(() => {});
  }, [stream, isVideoOff, isScreenSharing]);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "V";

  const isMirror = !isScreenSharing && facingMode === "user";

  return (
    <div className={`${styles.videoTile} ${isLocalSpeaking ? styles.videoTileSpeaking : ""} ${handRaised ? styles.videoTileHandRaised : ""}`}>
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted
        style={{ objectFit: fitMode }}
        className={`${styles.videoElement} ${isMirror ? styles.videoMirror : ""} ${
          isVideoOff && !isScreenSharing ? styles.videoHidden : ""
        }`}
      />

      {isVideoOff && !isScreenSharing && (
        <div className={styles.avatarPlaceholder}>
          <div className={styles.avatarCircle}>{initials}</div>
        </div>
      )}

      {/* Badges d'état discrets en haut à gauche */}
      <div className={styles.tileTopBadges}>
        {isPinned && (
          <button
            type="button"
            className={`${styles.tileBadgePill} ${styles.tileBadgePinned}`}
            onClick={(e) => { e.stopPropagation(); onPin?.(); }}
            title="Désépingler ma vidéo"
          >
            <Pin size={11} />
            <span>Épinglé</span>
          </button>
        )}
        {handRaised && (
          <div className={`${styles.tileBadgePill} ${styles.tileBadgeHand}`}>
            <Hand size={11} />
            <span>Main levée</span>
          </div>
        )}
        {isScreenSharing && (
          <div className={`${styles.tileBadgePill} ${styles.tileBadgeScreen}`}>
            <Monitor size={11} />
            <span>Écran partagé</span>
          </div>
        )}
      </div>

      {/* Actions discrètes en haut à droite (bouton 3-petits-points + épingle rapide) */}
      {!isPip && (
        <div className={styles.tileTopActions} ref={menuRef}>
          {onPin && (
            <button
              type="button"
              className={styles.tileQuickPin}
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              title={isPinned ? "Désépingler ma vidéo" : "Épingler ma vidéo"}
              aria-label={isPinned ? "Désépingler ma vidéo" : "Épingler ma vidéo"}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          )}

          <button
            type="button"
            className={styles.tileMenuTrigger}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
            title="Options de ma vidéo"
            aria-label="Options de ma vidéo"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div className={styles.tileMenuDropdown} onClick={(e) => e.stopPropagation()}>
              {onPin && (
                <button
                  type="button"
                  className={styles.tileMenuItem}
                  onClick={() => { onPin(); setMenuOpen(false); }}
                >
                  {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                  <span>{isPinned ? "Désépingler ma vidéo" : "Épingler ma vidéo"}</span>
                </button>
              )}
              <button
                type="button"
                className={styles.tileMenuItem}
                onClick={() => { setFitMode(f => f === "cover" ? "contain" : "cover"); setMenuOpen(false); }}
              >
                <Maximize size={14} />
                <span>{fitMode === "cover" ? "Ajuster à la tuile" : "Remplir la tuile"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nom et micro épurés en bas à gauche */}
      <div className={styles.tileOverlay}>
        <span className={styles.tileName}>{userName} (Vous)</span>
        {isMicMuted && (
          <span className={styles.mutedBadge} title="Micro coupé" aria-label="Micro coupé">
            <MicOff size={12} color="#f87171" />
          </span>
        )}
      </div>
    </div>
  );
}

// Composant Tuile pour les participants distants
function RemoteVideoTile({
  peer,
  isHost,
  onModerate,
  isPinned,
  onPin,
}: {
  peer: RemotePeer;
  isHost: boolean;
  onModerate: (peerId: string, action: "mute" | "remove") => void;
  isPinned?: boolean;
  onPin?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [playbackNoticeVisible, setPlaybackNoticeVisible] = useState(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !peer.stream) return;
    let active = true;
    let dismissNoticeTimer: number | undefined;
    video.srcObject = peer.stream;

    const attemptPlayback = (showNotice = false) => {
      void video.play().then(() => {
        if (!active) return;
        setPlaybackBlocked(false);
        setPlaybackNoticeVisible(false);
        if (dismissNoticeTimer !== undefined) window.clearTimeout(dismissNoticeTimer);
      }).catch(() => {
        if (!active) return;
        setPlaybackBlocked(true);
        if (showNotice) {
          setPlaybackNoticeVisible(true);
          dismissNoticeTimer = window.setTimeout(() => setPlaybackNoticeVisible(false), 5200);
        }
      });
    };

    const retryAfterInteraction = () => {
      if (video.paused) attemptPlayback();
    };

    setPlaybackBlocked(false);
    setPlaybackNoticeVisible(false);
    attemptPlayback(true);
    document.addEventListener("pointerdown", retryAfterInteraction, true);
    return () => {
      active = false;
      document.removeEventListener("pointerdown", retryAfterInteraction, true);
      if (dismissNoticeTimer !== undefined) window.clearTimeout(dismissNoticeTimer);
    };
  }, [peer.stream]);

  const initials =
    peer.name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";

  const handlePiP = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("Échec Picture-in-Picture:", err);
    }
  };

  return (
    <div
      className={`${styles.videoTile} ${peer.isSpeaking ? styles.videoTileSpeaking : ""} ${peer.handRaised ? styles.videoTileHandRaised : ""}`}
      onDoubleClick={() => setFitMode(f => f === "contain" ? "cover" : "contain")}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ objectFit: peer.isScreenSharing ? "contain" : fitMode }}
        className={`${styles.videoElement} ${styles.remoteVideoElement} ${peer.isVideoOff && !peer.isScreenSharing ? styles.videoHidden : ""}`}
      />

      {playbackBlocked && playbackNoticeVisible && (
        <button type="button" className={styles.resumePlayback} onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          video.play().then(() => { setPlaybackBlocked(false); setPlaybackNoticeVisible(false); }).catch(() => setPlaybackBlocked(true));
        }} aria-label={`Le navigateur bloque le son de ${peer.name}. Touchez pour l’activer.`}>
          <Mic size={16} /> Activer le son
        </button>
      )}

      {peer.isVideoOff && !peer.isScreenSharing && (
        <div className={styles.avatarPlaceholder}>
          <div className={styles.avatarCircle}>{initials}</div>
        </div>
      )}

      {/* Badges d'état discrets en haut à gauche */}
      <div className={styles.tileTopBadges}>
        {isPinned && (
          <button
            type="button"
            className={`${styles.tileBadgePill} ${styles.tileBadgePinned}`}
            onClick={(e) => { e.stopPropagation(); onPin?.(); }}
            title="Désépingler cette vidéo"
          >
            <Pin size={11} />
            <span>Épinglé</span>
          </button>
        )}
        {peer.handRaised && (
          <div className={`${styles.tileBadgePill} ${styles.tileBadgeHand}`}>
            <Hand size={11} />
            <span>Main levée</span>
          </div>
        )}
        {peer.isScreenSharing && (
          <div className={`${styles.tileBadgePill} ${styles.tileBadgeScreen}`}>
            <Monitor size={11} />
            <span>Écran partagé</span>
          </div>
        )}
        {peer.connection === "reconnecting" && (
          <div className={styles.peerConnectionBadge}>
            Reconnexion…
          </div>
        )}
      </div>

      {/* Actions discrètes en haut à droite (bouton 3-petits-points + qualité + épingle rapide) */}
      <div className={styles.tileTopActions} ref={menuRef}>
        {peer.quality && (
          <span
            className={`${styles.qualityBadge} ${peer.quality === "poor" ? styles.qualityPoor : peer.quality === "fair" ? styles.qualityFair : ""}`}
            aria-label={`Qualité réseau ${peer.quality === "good" ? "bonne" : peer.quality === "fair" ? "moyenne" : "faible"}`}
          >
            <Wifi size={12} />
          </span>
        )}

        {onPin && (
          <button
            type="button"
            className={styles.tileQuickPin}
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            title={isPinned ? "Désépingler cette vidéo" : "Épingler cette vidéo"}
            aria-label={isPinned ? "Désépingler cette vidéo" : "Épingler cette vidéo"}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        )}

        <button
          type="button"
          className={styles.tileMenuTrigger}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
          title={`Options pour ${peer.name}`}
          aria-label={`Options pour ${peer.name}`}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div className={styles.tileMenuDropdown} onClick={(e) => e.stopPropagation()}>
            {onPin && (
              <button
                type="button"
                className={styles.tileMenuItem}
                onClick={() => { onPin(); setMenuOpen(false); }}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                <span>{isPinned ? "Désépingler la vidéo" : "Épingler la vidéo"}</span>
              </button>
            )}
            <button
              type="button"
              className={styles.tileMenuItem}
              onClick={() => { setFitMode(f => f === "contain" ? "cover" : "contain"); setMenuOpen(false); }}
            >
              <Maximize size={14} />
              <span>{fitMode === "cover" ? "Adapter à la tuile" : "Remplir la tuile"}</span>
            </button>
            {typeof document !== "undefined" && document.pictureInPictureEnabled && (
              <button
                type="button"
                className={styles.tileMenuItem}
                onClick={(e) => { void handlePiP(e); setMenuOpen(false); }}
              >
                <PictureInPicture size={14} />
                <span>Fenêtre flottante (PiP)</span>
              </button>
            )}
            {isHost && !peer.isMuted && (
              <button
                type="button"
                className={styles.tileMenuItem}
                onClick={() => { onModerate(peer.id, "mute"); setMenuOpen(false); }}
              >
                <MicOff size={14} />
                <span>Couper le micro</span>
              </button>
            )}
            {isHost && (
              <button
                type="button"
                className={`${styles.tileMenuItem} ${styles.tileMenuItemDanger}`}
                onClick={() => { onModerate(peer.id, "remove"); setMenuOpen(false); }}
              >
                <UserX size={14} />
                <span>Retirer de la réunion</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nom et micro épurés en bas à gauche */}
      <div className={styles.tileOverlay}>
        <span className={styles.tileName}>{peer.name}</span>
        {peer.isMuted && (
          <span className={styles.mutedBadge} title="Micro coupé" aria-label="Micro coupé">
            <MicOff size={12} color="#f87171" />
          </span>
        )}
      </div>
    </div>
  );
}
