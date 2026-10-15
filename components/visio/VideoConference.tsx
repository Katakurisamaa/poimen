"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  Mic, MicOff, Video, VideoOff, Monitor, BarChart2,
  Users, AlertCircle, Wifi, MessageSquare, Send, Hand, ShieldCheck, UserX, Smile, Clock,
  RotateCcw, AlertTriangle, Lock, Camera, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPublicVisioUrl, getWhatsAppShareUrl, matchesLobbyAdmission, wasLobbyAdmissionDelivered } from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { animateVisioPanelExit } from "./interaction-transition";
import styles from "./VideoConference.module.css";
import type { VisioDeviceSelection } from "./VisioPreflight";

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
}

interface ChatMessage { id: string; peerId: string; name: string; text: string; createdAt: number; }
interface WaitingParticipant { peerId: string; participantId: string; name: string; }
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
    return `guest_${crypto.randomUUID()}`;
  } catch {
    return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
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

export default function VideoConference({
  roomName,
  title,
  userName = "Participant",
  guestName,
  participantId: participantIdProp,
  onLeave,
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
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
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

  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadPollCount, setUnreadPollCount] = useState(0);
  const [callNotice, setCallNotice] = useState("");
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
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS);
  const roomLockedRef = useRef(roomLocked);
  const meetingStartedAtRef = useRef<number | null>(null);
  const onLeaveRef = useRef(onLeave);
  const approvedPeerIdsRef = useRef<Set<string>>(new Set());
  const announcedAdmissionsRef = useRef<Set<string>>(new Set());
  const revokedParticipantsRef = useRef<Set<string>>(new Set());
  const rejectedParticipantsRef = useRef<Set<string>>(new Set());
  const isAdmittedRef = useRef(isHost);
  const reactionTimersRef = useRef<Set<number>>(new Set());
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  const showCallNotice = useCallback((message: string) => {
    setCallNotice(message);
    if (callNoticeTimerRef.current !== null) window.clearTimeout(callNoticeTimerRef.current);
    callNoticeTimerRef.current = window.setTimeout(() => {
      callNoticeTimerRef.current = null;
      setCallNotice("");
    }, 4200);
  }, []);

  useEffect(() => () => {
    if (callNoticeTimerRef.current !== null) window.clearTimeout(callNoticeTimerRef.current);
  }, []);

  useEffect(() => {
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
      // Interception des raccourcis d'actualisation de la page (F5, Ctrl+R, Cmd+R)
      if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && (event.key === "r" || event.key === "R"))) {
        event.preventDefault();
        setShowReloadModal(true);
      }
      // Fermeture des modales avec la touche Échap
      if (event.key === "Escape") {
        setShowPermissionModal(false);
        setShowReloadModal(false);
        setShowLeaveModal(false);
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, []);

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
        const snapshot: { polls?: { id?: string; status?: string; startedAt?: number; createdAt?: number; question?: string }[] } = await response.json();
        const openPoll = snapshot.polls?.find(poll => poll.status === "open");
        const signature = openPoll ? `${openPoll.id || ""}:${openPoll.startedAt || openPoll.createdAt || 0}` : "";
        if (hasInitialSnapshot && signature && signature !== previousOpenPoll && !pollsOpen) {
          setUnreadPollCount(count => Math.min(99, count + 1));
          showCallNotice(`Nouveau sondage : ${(openPoll?.question || "une nouvelle question").slice(0, 110)}`);
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
    if (chatOpen) chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatOpen]);

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
    setRemotePeers(previous => previous.filter(peer => peer.participantId !== peerParticipantId));

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    // Ajouter toutes les pistes locales disponibles
    streamToShare.getTracks().forEach((track) => {
      pc.addTrack(track, streamToShare);
    });

    // En mode écoute seule (sans pistes locales), ajouter des récepteurs pour recevoir les flux distants
    const hasVideo = streamToShare.getVideoTracks().length > 0;
    const hasAudio = streamToShare.getAudioTracks().length > 0;
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
        const existing = prev.find((p) => p.participantId === peerParticipantId);
        if (existing) {
          return prev.map((p) => (p.participantId === peerParticipantId ? { ...p, id: peerId, stream: incomingStream, name: peerName } : p));
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
      if (!stream || !isSubscribed) {
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
      let localAdmissionHandled = false;
      const admitLocalParticipant = async (proposedStart?: unknown) => {
        if (isHost || localAdmissionHandled) return;
        localAdmissionHandled = true;
        const candidateStart = Number(proposedStart);
        const startedAt = Number.isFinite(candidateStart) && candidateStart > 0
          ? candidateStart
          : meetingStartedAtRef.current || Date.now();
        setIsWaitingRoom(false);
        setJoinRejected(false);
        setMeetingStartedAt(startedAt);
        meetingStartedAtRef.current = startedAt;
        approvedPeerIdsRef.current.add(participantId);
        setNetworkState("connecting");
        await trackPresence(true, startedAt);
        channel.send({
          type: "broadcast",
          event: "PEER_JOIN",
          payload: { peerId: localPeerId, participantId, peerName: userName, isHost: false, isAdmitted: true, meetingStartedAt: startedAt },
        });
      };
      const announceAdmission = (admittedParticipantId: string) => {
        if (revokedParticipantsRef.current.has(admittedParticipantId) || rejectedParticipantsRef.current.has(admittedParticipantId)) return;
        approvedPeerIdsRef.current.add(admittedParticipantId);
        if (!announcedAdmissionsRef.current.has(admittedParticipantId)) {
          announcedAdmissionsRef.current.add(admittedParticipantId);
          channel.send({ type: "broadcast", event: "ROOM_PEER_ADMITTED", payload: { participantId: admittedParticipantId, meetingStartedAt: meetingStartedAtRef.current } });
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

          for (const presences of Object.values(state)) {
            for (const presence of presences) {
              if (!presence.peerId || !presence.participantId) continue;
              activePeerIds.add(presence.peerId);
              if ((presence.isHost || presence.isAdmitted) && Number.isFinite(presence.meetingStartedAt) && presence.meetingStartedAt) {
                startTimes.push(presence.meetingStartedAt);
              }
              if (isHost && !presence.isHost) {
                if (revokedParticipantsRef.current.has(presence.participantId) || rejectedParticipantsRef.current.has(presence.participantId)) continue;
                if (presence.isAdmitted) announceAdmission(presence.participantId);
                else if (roomLockedRef.current) waitingNow.push({
                  peerId: presence.peerId,
                  participantId: presence.participantId,
                  name: presence.peerName || "Invité",
                });
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

          if (isHost && waitingNow.length) {
            setWaitingParticipants(previous => {
              const byParticipant = new Map(previous.map(person => [person.participantId, person]));
              waitingNow.forEach(person => byParticipant.set(person.participantId, person));
              return Array.from(byParticipant.values());
            });
            waitingNow.forEach(person => channel.send({ type: "broadcast", event: "LOBBY_WAITING", payload: { toPeerId: person.peerId } }));
          }
          if (isHost) {
            setWaitingParticipants(previous => previous.filter(person => activePeerIds.has(person.peerId)));
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
          const isAlreadyAdmitted = Object.values(channel.presenceState<RoomPresence>()).flat().some(
            presence => presence.peerId === peerId && presence.participantId === peerParticipantId && presence.isAdmitted
          );
          if (isHost && isAlreadyAdmitted) announceAdmission(peerParticipantId);
          if (isHost && !roomLockedRef.current && !payload.isHost) announceAdmission(peerParticipantId);

          if (isHost && !payload.isHost && roomLockedRef.current && !approvedPeerIdsRef.current.has(peerParticipantId)) {
            setWaitingParticipants(previous => {
              const next = previous.filter(person => person.participantId !== peerParticipantId);
              return [...next, { peerId, participantId: peerParticipantId, name: peerName || "Invité" }];
            });
            channel.send({ type: "broadcast", event: "LOBBY_WAITING", payload: { toPeerId: peerId } });
            return;
          }
          if (!isHost && roomLockedRef.current && !payload.isHost && !approvedPeerIdsRef.current.has(peerParticipantId)) return;
          if (peerConnectionsRef.current.get(peerId)?.pc.signalingState !== undefined
            && peerConnectionsRef.current.get(peerId)?.pc.signalingState !== "closed") return;

          // L'ancien pair prend l'initiative d'envoyer l'offre SDP
          const pc = createPeerConnection(peerId, peerName, localStreamRef.current!, peerParticipantId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            channel.send({
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
            console.error("Erreur création d'offre WebRTC:", err);
          }
        })
        .on("broadcast", { event: "WEBRTC_OFFER" }, async ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          const { fromPeerId, fromPeerName, sdp } = payload;

          const currentPeer = peerConnectionsRef.current.get(fromPeerId);
          const pc = currentPeer?.pc || createPeerConnection(fromPeerId, fromPeerName, localStreamRef.current!, String(payload.fromParticipantId || fromPeerId));
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            flushPendingIceCandidates(fromPeerId, pc);
            const answer = await pc.createAnswer();
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
          if (peerObj) {
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
          setRemotePeers((prev) =>
            prev.map((p) =>
              p.id === payload.peerId
                ? {
                    ...p,
                    ...(typeof payload.isMuted === "boolean" ? { isMuted: payload.isMuted } : {}),
                    ...(typeof payload.isVideoOff === "boolean" ? { isVideoOff: payload.isVideoOff } : {}),
                  }
                : p
            )
          );
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
          if (payload?.toPeerId === localPeerId && !approvedPeerIdsRef.current.has(participantId)) {
            setMeetingStartedAt(null);
            meetingStartedAtRef.current = null;
            await trackPresence(false, null);
            setNetworkState("connecting");
            setIsWaitingRoom(true);
          }
        })
        .on("broadcast", { event: "LOBBY_APPROVED" }, async ({ payload }) => {
          if (!matchesLobbyAdmission(payload, localPeerId, participantId)) return;
          await admitLocalParticipant(payload.meetingStartedAt);
        })
        .on("broadcast", { event: "LOBBY_REJECTED" }, async ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          setMeetingStartedAt(null);
          meetingStartedAtRef.current = null;
          await trackPresence(false, null);
          setIsWaitingRoom(false);
          setJoinRejected(true);
          notify("Votre demande d'accès à la salle a été refusée.");
        })
        .on("broadcast", { event: "ROOM_PEER_ADMITTED" }, ({ payload }) => {
          if (payload?.participantId) {
            const admittedParticipantId = String(payload.participantId);
            approvedPeerIdsRef.current.add(admittedParticipantId);
            announcedAdmissionsRef.current.add(admittedParticipantId);
            if (admittedParticipantId === participantId) void admitLocalParticipant(payload.meetingStartedAt);
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
              showCallNotice(`Nouveau message de ${String(payload.name || "un participant").slice(0, 48)}.`);
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
          if (isHost) setWaitingParticipants(previous => previous.filter(person => person.peerId !== payload.peerId));
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
  }, [roomName, localPeerId, participantId, userName, isHost, initLocalMedia, createPeerConnection, flushPendingIceCandidates, notify, showReaction, showCallNotice]);

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
      // Arrêt du partage d'écran
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) void sender.replaceTrack(cameraTrack).catch(() => {});
        });

      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
      notify("Partage d'écran arrêté.");
  };

  const toggleScreenShare = async () => {
    if (screenTrackRef.current) {
      stopScreenShare();
    } else {
      // Démarrage du partage d'écran
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = stopScreenShare;

        setIsScreenSharing(true);
        notify("Partage d'écran actif.");
      } catch (err) {
        console.warn("Partage d'écran annulé ou refusé:", err);
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
    if (!approved) {
      rejectedParticipantsRef.current.add(person.participantId);
      const status = await channel.send({ type: "broadcast", event: "LOBBY_REJECTED", payload: { toPeerId: person.peerId, toParticipantId: person.participantId } });
      if (status !== "ok") {
        rejectedParticipantsRef.current.delete(person.participantId);
        notify("Le refus n’a pas pu être transmis. Réessayez.");
        return;
      }
      setWaitingParticipants(previous => previous.filter(item => item.participantId !== person.participantId));
      return;
    }
    rejectedParticipantsRef.current.delete(person.participantId);
    revokedParticipantsRef.current.delete(person.participantId);
    approvedPeerIdsRef.current.add(person.participantId);
    announcedAdmissionsRef.current.add(person.participantId);
    const admissionPayload = { participantId: person.participantId, meetingStartedAt: meetingStartedAtRef.current };
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
      announcedAdmissionsRef.current.delete(person.participantId);
      notify("L’admission n’a pas pu être transmise. La personne reste en attente, réessayez.");
      return;
    }
    setWaitingParticipants(previous => previous.filter(item => item.participantId !== person.participantId));
  };

  const sendChatMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatDraft.trim().slice(0, 500);
    if (!text || !channelRef.current) return;
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
      const shouldClose = await animateVisioPanelExit(containerRef.current?.querySelector<HTMLElement>('[aria-label="Chat de la réunion"]'));
      if (shouldClose) { chatOpenRef.current = false; setChatOpen(false); }
    } finally {
      closingChatRef.current = false;
    }
  };

  const closePollsPanel = async () => {
    if (closingPollsRef.current) return;
    closingPollsRef.current = true;
    try {
      const shouldClose = await animateVisioPanelExit(containerRef.current?.querySelector<HTMLElement>('[data-visio-poll-panel="true"]'));
      if (shouldClose) (onClosePolls ?? onTogglePolls)?.();
    } finally {
      closingPollsRef.current = false;
    }
  };

  const toggleChat = () => {
    if (closingChatRef.current || closingPollsRef.current || containerRef.current?.querySelector<HTMLElement>('[data-visio-interaction-dock="true"]')?.dataset.visioClosing === "true") return;
    setReactionsOpen(false);
    if (chatOpen) {
      void closeChatPanel();
    } else if (pollsOpen) {
      void closePollsPanel().then(() => { chatOpenRef.current = true; setUnreadChatCount(0); setChatOpen(true); });
    } else {
      chatOpenRef.current = true;
      setUnreadChatCount(0);
      setChatOpen(true);
    }
  };

  const togglePolls = () => {
    if (closingChatRef.current || closingPollsRef.current || containerRef.current?.querySelector<HTMLElement>('[data-visio-interaction-dock="true"]')?.dataset.visioClosing === "true") return;
    setReactionsOpen(false);
    if (pollsOpen) {
      void closePollsPanel();
    } else if (chatOpen) {
      void closeChatPanel().then(() => { setUnreadPollCount(0); onTogglePolls?.(); });
    } else {
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

  const totalParticipants = 1 + remotePeers.length;
  const gridClass =
    totalParticipants === 1
      ? styles.grid1
      : totalParticipants === 2
      ? styles.grid2
      : totalParticipants <= 4
      ? styles.grid4
      : styles.gridMany;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${styles.fullscreen} ${chatOpen || pollsOpen ? styles.interactionsOpen : ""}`}
      data-visio-fullscreen-mode="true"
      style={{ height: "var(--visio-viewport-height, 100dvh)", maxHeight: "var(--visio-viewport-height, 100dvh)" }}
    >
      <header className={styles.topBar}>
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
        </div>

        <div className={styles.actions}>
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

          {onTogglePolls && (
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnMobileDuplicate} ${pollsOpen ? styles.btnActive : ""}`}
              onClick={togglePolls}
              title={pollsOpen ? "Fermer les sondages" : "Ouvrir les sondages et quiz interactifs"}
              aria-label={`${pollsOpen ? "Fermer" : "Ouvrir"} les sondages${unreadPollCount ? `, ${unreadPollCount} nouveau${unreadPollCount > 1 ? "x" : ""}` : ""}`}
            >
              <BarChart2 size={16} />
              <span>Sondages</span>
              {unreadPollCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadPollCount > 9 ? "9+" : unreadPollCount}</span>}
            </button>
          )}

          <button type="button" className={`${styles.btnAction} ${styles.btnMobileDuplicate} ${chatOpen ? styles.btnActive : ""}`} onClick={toggleChat} aria-pressed={chatOpen} aria-label={`${chatOpen ? "Fermer" : "Ouvrir"} le chat${unreadChatCount ? `, ${unreadChatCount} nouveau${unreadChatCount > 1 ? "x" : ""} message${unreadChatCount > 1 ? "s" : ""}` : ""}`} title={chatOpen ? "Fermer le chat" : "Ouvrir le chat de la réunion"}>
            <MessageSquare size={16} /><span>Chat ({chatMessages.length})</span>
            {unreadChatCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>}
          </button>

          {isHost && (
            <button type="button" className={`${styles.btnAction} ${roomLocked ? styles.btnActive : ""}`} onClick={toggleWaitingRoom} aria-pressed={roomLocked} title={roomLocked ? "Ouvrir la salle aux invités (admission d'interface)" : "Activer l'admission d'interface"}>
              <ShieldCheck size={16} /><span>{roomLocked ? "Salle d'attente" : "Salle ouverte"}{waitingParticipants.length ? ` · ${waitingParticipants.length}` : ""}</span>
            </button>
          )}

          <button
            type="button"
            className={styles.btnAction}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran natif" : "Passer en plein écran natif"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            <span>{isFullscreen ? "Réduire" : "Plein écran"}</span>
          </button>

          {onLeave && (
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnDanger}`}
              onClick={leaveMeeting}
              title="Quitter la réunion"
            >
              <PhoneOff size={16} />
              <span>Quitter</span>
            </button>
          )}
        </div>
      </header>

      <div className={styles.networkBar} role="status" aria-live="polite">
        <Wifi size={14} />
        <span>{networkState === "reconnecting" ? "Connexion instable · tentative de reconnexion" : remotePeers.some(peer => peer.quality === "poor") ? "Qualité réseau faible" : remotePeers.some(peer => peer.quality === "fair") ? "Qualité réseau moyenne" : "Connexion active"}</span>
        {meetingStartedAt !== null && !isWaitingRoom && !joinRejected && <span className={styles.meetingDuration} title="Durée de la réunion" aria-live="off">
          <Clock size={12} aria-hidden="true" />
          <span>Durée {formatMeetingDuration(meetingElapsedSeconds)}</span>
        </span>}
        <span className={hasTurnRelay ? styles.turnReady : styles.turnMissing}>{hasTurnRelay ? "Relais TURN disponible" : "Relais TURN non configuré"}</span>
      </div>
      <div className={`${styles.stageAndDock} ${chatOpen || pollsOpen ? styles.stageAndDockOpen : ""}`}>
      <div className={styles.stageWrapper}>
        {callNotice && <div className={styles.callNotice} role="status" aria-live="polite">{callNotice}</div>}
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
            {waitingParticipants.map(person => <div className={styles.lobbyRow} key={person.peerId}>
              <span>{person.name}</span>
              <button type="button" onClick={() => void respondToWaitingParticipant(person, true)}>Admettre</button>
              <button type="button" onClick={() => void respondToWaitingParticipant(person, false)}>Refuser</button>
            </div>)}
          </div>
        )}

        <div className={styles.reactionLayer}>
          {floatingReactions.map(item => <div key={item.id} className={styles.floatingReaction} style={{ left: `${item.left}%`, animationDuration: `${item.duration}ms` }}>
            <AnimatedReactionEmoji emoji={item.reaction} className={styles.floatingEmoji} animated />
            <span className={styles.floatingName}>{item.peerId === localPeerId ? "Vous" : item.name}</span>
          </div>)}
          <span className={styles.srOnly} role="status" aria-live="polite">{reactionAnnouncement}</span>
        </div>

        {/* Grille Vidéo Native */}
        <div className={`${styles.videoGrid} ${gridClass}`}>
          {/* Tuile Vidéo Locale (Vous) */}
      <div className={`${styles.videoTile} ${isLocalSpeaking ? styles.videoTileSpeaking : ""} ${handRaised ? styles.videoTileHandRaised : ""}`}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`${styles.videoElement} ${!isScreenSharing ? styles.videoMirror : ""} ${
                isVideoOff && !isScreenSharing ? styles.videoHidden : ""
              }`}
            />

            {isVideoOff && !isScreenSharing && (
              <div className={styles.avatarPlaceholder}>
                <div className={styles.avatarCircle}>
                  {userName
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "V"}
                </div>
                <span className={styles.avatarName}>{userName}</span>
              </div>
            )}

            <div className={styles.tileOverlay}>
              <span className={styles.tileName}>{userName} (Vous)</span>
              {isMicMuted && (
                <span className={styles.mutedBadge} title="Micro coupé" aria-label="Micro coupé">
                  <MicOff size={13} />
                  <span>Micro coupé</span>
                </span>
              )}
            </div>
            {handRaised && <div className={styles.handRaisedBanner}><Hand size={16} /><span>MAIN LEVÉE</span></div>}
          </div>

          {/* Tuiles Vidéos Distantes */}
          {remotePeers.map((peer) => (
            <RemoteVideoTile key={peer.id} peer={peer} isHost={isHost} onModerate={moderatePeer} />
          ))}
        </div>
      </div>

      <div
        className={`${styles.interactionDock} ${chatOpen || pollsOpen ? styles.interactionDockOpen : ""}`}
        data-visio-interaction-dock="true"
        aria-hidden={!chatOpen && !pollsOpen}
      >
        {chatOpen && <aside className={`${styles.chatPanel} ${styles.dockPanel}`} aria-label="Chat de la réunion">
          <div className={styles.chatHeader}><strong>Messages de la réunion</strong><button type="button" onClick={() => void closeChatPanel()} aria-label="Fermer le chat">×</button></div>
          <div className={styles.chatMessages} aria-live="polite">
            {chatMessages.length === 0 ? <div className={styles.chatEmptyState}>
              <span className={styles.chatEmptyIcon} aria-hidden="true"><MessageSquare size={20} /></span>
              <strong>Aucun message pour l’instant</strong>
              <p>Démarrez la conversation avec l’équipe.</p>
            </div> : chatMessages.map(message => <article className={`${styles.chatMessage} ${message.peerId === localPeerId ? styles.chatMessageOwn : ""}`} key={message.id}>
              <div className={styles.chatMessageMeta}><strong>{message.peerId === localPeerId ? "Vous" : message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.text}</p>
            </article>)}
            <div ref={chatMessagesEndRef} aria-hidden="true" />
          </div>
          <form className={styles.chatForm} onSubmit={sendChatMessage}><input aria-label="Votre message" maxLength={500} value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder="Écrire un message…" /><button type="submit" disabled={!chatDraft.trim()} aria-label="Envoyer"><Send size={16} /></button></form>
        </aside>}
      </div>
      </div>

      {/* Barre de contrôle flottante en bas */}
      <footer className={`${styles.controlsBar} ${chatOpen || pollsOpen ? styles.controlsBarHidden : ""}`}>
          <button
          type="button"
          className={`${styles.ctrlBtn} ${isMicMuted ? styles.ctrlBtnOff : ""}`}
          onClick={toggleMic}
          disabled={isLoading}
          aria-pressed={!isMicMuted}
          title={!localStream?.getAudioTracks().length ? "Autoriser le micro" : isMicMuted ? "Activer le micro" : "Couper le micro"}
        >
          {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
          <span>{!localStream?.getAudioTracks().length ? "Autoriser micro" : isMicMuted ? "Micro coupé" : "Micro actif"}</span>
        </button>

        <button
          type="button"
          className={`${styles.ctrlBtn} ${isVideoOff ? styles.ctrlBtnOff : ""}`}
          onClick={toggleCam}
          disabled={isLoading}
          aria-pressed={!isVideoOff}
          title={!localStream?.getVideoTracks().length ? "Autoriser la caméra" : isVideoOff ? "Activer la caméra" : "Couper la caméra"}
        >
          {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
          <span>{!localStream?.getVideoTracks().length ? "Autoriser caméra" : isVideoOff ? "Caméra coupée" : "Caméra"}</span>
        </button>

        <button
          type="button"
          className={`${styles.ctrlBtn} ${isScreenSharing ? styles.ctrlBtnActive : ""}`}
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Arrêter le partage d'écran" : "Partager l'écran"}
        >
          <Monitor size={18} />
          <span>{isScreenSharing ? "Arrêter partage" : "Partager écran"}</span>
        </button>

        {onTogglePolls && (
          <button
            type="button"
            className={`${styles.ctrlBtn} ${pollsOpen ? styles.ctrlBtnActive : ""}`}
            onClick={togglePolls}
            aria-label={`${pollsOpen ? "Fermer" : "Ouvrir"} les sondages${unreadPollCount ? `, ${unreadPollCount} nouveau${unreadPollCount > 1 ? "x" : ""}` : ""}`}
            title={pollsOpen ? "Fermer les sondages" : "Ouvrir les sondages & quiz"}
          >
            <BarChart2 size={18} />
            <span>Sondages</span>
            {unreadPollCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadPollCount > 9 ? "9+" : unreadPollCount}</span>}
          </button>
        )}

        <button type="button" className={`${styles.ctrlBtn} ${handRaised ? styles.ctrlBtnActive : ""}`} onClick={toggleHand} aria-pressed={handRaised} title={handRaised ? "Baisser la main" : "Lever la main"}>
          <Hand size={18} /><span>{handRaised ? "Main levée" : "Lever la main"}</span>
        </button>
        <button type="button" className={`${styles.ctrlBtn} ${chatOpen ? styles.ctrlBtnActive : ""}`} onClick={toggleChat} aria-pressed={chatOpen} aria-label={`${chatOpen ? "Fermer" : "Ouvrir"} le chat${unreadChatCount ? `, ${unreadChatCount} nouveau${unreadChatCount > 1 ? "x" : ""} message${unreadChatCount > 1 ? "s" : ""}` : ""}`} title={chatOpen ? "Fermer le chat" : "Ouvrir le chat de la réunion"}>
          <MessageSquare size={18} /><span>Chat</span>
          {unreadChatCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>}
        </button>
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
            <Smile size={19} /><span>Réactions</span>
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

        <button type="button" className={`${styles.ctrlBtn} ${styles.ctrlBtnMobileDuplicate} ${isFullscreen ? styles.ctrlBtnActive : ""}`} onClick={toggleFullscreen} aria-pressed={isFullscreen} title={isFullscreen ? "Quitter le plein écran natif" : "Passer en plein écran natif"}>
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}<span>{isFullscreen ? "Réduire" : "Plein écran"}</span>
        </button>

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

// Composant Tuile pour les participants distants
function RemoteVideoTile({ peer, isHost, onModerate }: { peer: RemotePeer; isHost: boolean; onModerate: (peerId: string, action: "mute" | "remove") => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [playbackNoticeVisible, setPlaybackNoticeVisible] = useState(false);

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

  return (
    <div className={`${styles.videoTile} ${peer.isSpeaking ? styles.videoTileSpeaking : ""} ${peer.handRaised ? styles.videoTileHandRaised : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`${styles.videoElement} ${styles.remoteVideoElement} ${peer.isVideoOff ? styles.videoHidden : ""}`}
      />

      {playbackBlocked && playbackNoticeVisible && (
        <button type="button" className={styles.resumePlayback} onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          video.play().then(() => { setPlaybackBlocked(false); setPlaybackNoticeVisible(false); }).catch(() => setPlaybackBlocked(true));
        }} aria-label={`Le navigateur bloque le son de ${peer.name}. Touchez pour l’activer.`}>
          <Mic size={16} /> Le navigateur bloque le son. Touchez pour écouter {peer.name}.
        </button>
      )}

      {peer.isVideoOff && (
        <div className={styles.avatarPlaceholder}>
          <div className={styles.avatarCircle}>{initials}</div>
          <span className={styles.avatarName}>{peer.name}</span>
        </div>
      )}

      <div className={styles.tileOverlay}>
        <span className={styles.tileName}>{peer.name}</span>
        {peer.isMuted && (
          <span className={styles.mutedBadge} title="Micro coupé" aria-label="Micro coupé">
            <MicOff size={13} />
            <span>Micro coupé</span>
          </span>
        )}
      </div>
      {peer.handRaised && <div className={styles.handRaisedBanner}><Hand size={16} /><span>MAIN LEVÉE</span></div>}
      {peer.connection === "reconnecting" && <span className={styles.peerConnectionBadge}>Reconnexion…</span>}
      {peer.quality && <span className={`${styles.qualityBadge} ${peer.quality === "poor" ? styles.qualityPoor : peer.quality === "fair" ? styles.qualityFair : ""}`} aria-label={`Qualité réseau ${peer.quality === "good" ? "bonne" : peer.quality === "fair" ? "moyenne" : "faible"}`}><Wifi size={13} /></span>}
      {isHost && <div className={styles.moderationActions}>
        {!peer.isMuted && <button type="button" onClick={() => onModerate(peer.id, "mute")} title={`Couper le son de ${peer.name}`}><MicOff size={14} /> Couper le son</button>}
        <button type="button" onClick={() => onModerate(peer.id, "remove")} title={`Retirer ${peer.name} de la réunion`}><UserX size={14} /> Retirer</button>
      </div>}
    </div>
  );
}
