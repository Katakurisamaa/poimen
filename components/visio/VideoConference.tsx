"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  Mic, MicOff, Video, VideoOff, Monitor, BarChart2,
  Users, AlertCircle, Wifi, MessageSquare, Send, Hand, ShieldCheck, UserX, Smile, Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPublicVisioUrl, getWhatsAppShareUrl } from "@/lib/visio";
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
  name: string;
  stream: MediaStream;
  isMuted?: boolean;
  isVideoOff?: boolean;
  connection?: "connected" | "reconnecting" | "failed";
  quality?: "good" | "fair" | "poor";
  handRaised?: boolean;
}

interface ChatMessage { id: string; peerId: string; name: string; text: string; createdAt: number; }
interface WaitingParticipant { peerId: string; name: string; }
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
  guestName?: string;
  onLeave?: () => void;
  onTogglePolls?: () => void;
  onClosePolls?: () => void;
  pollsOpen?: boolean;
  isHost?: boolean;
  mediaDevices?: VisioDeviceSelection;
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

  // Unique client peer ID
  const [localPeerId] = useState(
    () => `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );

  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
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
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reactionPickerBottom, setReactionPickerBottom] = useState(96);
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [reactionAnnouncement, setReactionAnnouncement] = useState("");

  // UI states
  const [copied, setCopied] = useState(false);
  // The meeting opens in an immersive layout; this state tracks only native fullscreen.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, { pc: RTCPeerConnection; name: string }>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRequestRef = useRef(0);
  const channelRef = useRef<any>(null);
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS);
  const roomLockedRef = useRef(roomLocked);
  const onLeaveRef = useRef(onLeave);
  const approvedPeerIdsRef = useRef<Set<string>>(new Set());
  const reactionTimersRef = useRef<Set<number>>(new Set());
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

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
          payload: { peerId: localPeerId, peerName: userName, isHost },
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
  const createPeerConnection = useCallback((peerId: string, peerName: string, streamToShare: MediaStream) => {
    // Si une connexion existe déjà, la fermer
    if (peerConnectionsRef.current.has(peerId)) {
      peerConnectionsRef.current.get(peerId)?.pc.close();
      peerConnectionsRef.current.delete(peerId);
    }

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
        const existing = prev.find((p) => p.id === peerId);
        if (existing) {
          return prev.map((p) => (p.id === peerId ? { ...p, stream: incomingStream, name: peerName } : p));
        }
        return [...prev, { id: peerId, name: peerName, stream: incomingStream }];
      });
    };

    // Allow a brief network interruption, then release departed peers.
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    const updatePeerStatus = (connection: RemotePeer["connection"], quality?: RemotePeer["quality"]) => {
      setRemotePeers(prev => prev.map(peer => peer.id === peerId ? { ...peer, connection, quality: quality ?? peer.quality } : peer));
    };
    const restartIce = async () => {
      if (localPeerId < peerId || !channelRef.current || pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        channelRef.current.send({ type: "broadcast", event: "WEBRTC_OFFER", payload: {
          toPeerId: peerId, fromPeerId: localPeerId, fromPeerName: userName, sdp: offer,
        } });
      } catch (error) { console.warn("La reconnexion automatique WebRTC a échoué:", error); }
    };
    pc.oniceconnectionstatechange = () => {
      clearTimeout(disconnectTimer);
      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        updatePeerStatus("connected", "good");
        setNetworkState("connected");
        if (!statsTimer) statsTimer = setInterval(() => {
          void pc.getStats().then(report => {
            let received = 0; let lost = 0; let jitter = 0;
            report.forEach(stat => {
              if (stat.type === "inbound-rtp" && !stat.isRemote && (stat.kind === "audio" || stat.kind === "video")) {
                received += Number(stat.packetsReceived || 0);
                lost += Number(stat.packetsLost || 0);
                jitter = Math.max(jitter, Number(stat.jitter || 0));
              }
            });
            const lossRate = received + lost ? lost / (received + lost) : 0;
            const quality = lossRate > 0.08 || jitter > 0.05 ? "poor" : lossRate > 0.025 || jitter > 0.03 ? "fair" : "good";
            updatePeerStatus("connected", quality);
          }).catch(() => {});
        }, 5000);
      } else if (pc.iceConnectionState === "disconnected") {
        updatePeerStatus("reconnecting", "fair");
        setNetworkState("reconnecting");
        void restartIce();
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") void restartIce();
        }, 4000);
      } else if (pc.iceConnectionState === "failed") {
        updatePeerStatus("reconnecting", "poor");
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
        setRemotePeers((prev) => prev.filter((p) => p.id !== peerId));
        peerConnectionsRef.current.delete(peerId);
        pendingIceCandidatesRef.current.delete(peerId);
      }
    };

    pc.addEventListener("signalingstatechange", () => {
      if (pc.signalingState === "closed") { clearInterval(statsTimer); clearTimeout(disconnectTimer); }
    });

    peerConnectionsRef.current.set(peerId, { pc, name: peerName });
    return pc;
  }, [localPeerId, userName]);

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
      setMeetingElapsedSeconds(0);
      roomLockedRef.current = true;
      setRoomLocked(true);
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
        config: { broadcast: { self: false } },
      });

      // Annonce de présence et négociation
      channel
        .on("broadcast", { event: "PEER_JOIN" }, async ({ payload }) => {
          if (!payload?.peerId || payload.peerId === localPeerId) return;
          const { peerId, peerName } = payload;

          if (isHost && !payload.isHost && roomLockedRef.current && !approvedPeerIdsRef.current.has(peerId)) {
            setWaitingParticipants(previous => previous.some(person => person.peerId === peerId)
              ? previous : [...previous, { peerId, name: peerName || "Invité" }]);
            channel.send({ type: "broadcast", event: "LOBBY_WAITING", payload: { toPeerId: peerId } });
            return;
          }
          if (!isHost && roomLockedRef.current) return;
          if (peerConnectionsRef.current.get(peerId)?.pc.signalingState !== undefined
            && peerConnectionsRef.current.get(peerId)?.pc.signalingState !== "closed") return;

          // L'ancien pair prend l'initiative d'envoyer l'offre SDP
          const pc = createPeerConnection(peerId, peerName, localStreamRef.current!);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            channel.send({
              type: "broadcast",
              event: "WEBRTC_OFFER",
              payload: {
                toPeerId: peerId,
                fromPeerId: localPeerId,
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
          const pc = currentPeer?.pc || createPeerConnection(fromPeerId, fromPeerName, localStreamRef.current!);
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
                ? { ...p, isMuted: payload.isMuted, isVideoOff: payload.isVideoOff }
                : p
            )
          );
        })
        .on("broadcast", { event: "ROOM_LOCK" }, ({ payload }) => {
          const locked = Boolean(payload?.locked);
          setRoomLocked(locked);
          roomLockedRef.current = locked;
          if (!isHost) {
            channel.send({ type: "broadcast", event: "PEER_JOIN", payload: { peerId: localPeerId, peerName: userName, isHost: false } });
          }
        })
        .on("broadcast", { event: "LOBBY_WAITING" }, ({ payload }) => {
          if (payload?.toPeerId === localPeerId) {
            setMeetingStartedAt(null);
            setNetworkState("connecting");
            setIsWaitingRoom(true);
          }
        })
        .on("broadcast", { event: "LOBBY_APPROVED" }, ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          setIsWaitingRoom(false);
          setJoinRejected(false);
          setWaitingParticipants([]);
          setMeetingStartedAt(Date.now());
          setNetworkState("connecting");
        })
        .on("broadcast", { event: "LOBBY_REJECTED" }, ({ payload }) => {
          if (payload?.toPeerId !== localPeerId) return;
          setMeetingStartedAt(null);
          setIsWaitingRoom(false);
          setJoinRejected(true);
          notify("Votre demande d'accès à la salle a été refusée.");
        })
        .on("broadcast", { event: "CHAT_MESSAGE" }, ({ payload }) => {
          if (!payload?.messageId || !payload?.text || !payload?.peerId) return;
          setChatMessages(previous => [...previous.slice(-99), {
            id: payload.messageId, peerId: payload.peerId, name: payload.name || "Participant",
            text: String(payload.text).slice(0, 500), createdAt: Number(payload.createdAt) || Date.now(),
          }]);
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
            notify("L'animateur a demandé la coupure de votre micro.");
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
          approvedPeerIdsRef.current.delete(payload.peerId);
          setRemotePeers((prev) => prev.filter((p) => p.id !== payload.peerId));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setMeetingStartedAt(current => current ?? Date.now());
            if (isHost) channel.send({ type: "broadcast", event: "ROOM_LOCK", payload: { locked: roomLockedRef.current } });
            // Annoncer notre arrivée dans la salle
            channel.send({
              type: "broadcast",
              event: "PEER_JOIN",
              payload: { peerId: localPeerId, peerName: userName, isHost },
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
        channelRef.current.send({
          type: "broadcast",
          event: "PEER_LEAVE",
          payload: { peerId: localPeerId },
        });
        channelRef.current.unsubscribe();
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
  }, [roomName, localPeerId, userName, isHost, initLocalMedia, createPeerConnection, flushPendingIceCandidates, notify, showReaction]);

  // Basculer le micro (Mute / Unmute)
  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !audioTrack.enabled;
      setIsMicMuted(nextMuted);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: nextMuted, isVideoOff },
        });
      }
    } else {
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
    channelRef.current?.send({ type: "broadcast", event: "ROOM_LOCK", payload: { locked: nextLocked } });
    notify(nextLocked ? "La salle d'attente est activée pour les invités." : "La salle est ouverte aux invités.");
  };

  const respondToWaitingParticipant = async (person: WaitingParticipant, approved: boolean) => {
    channelRef.current?.send({ type: "broadcast", event: approved ? "LOBBY_APPROVED" : "LOBBY_REJECTED", payload: { toPeerId: person.peerId } });
    setWaitingParticipants(previous => previous.filter(item => item.peerId !== person.peerId));
    if (!approved || !localStreamRef.current || !channelRef.current) return;
    approvedPeerIdsRef.current.add(person.peerId);
    const pc = createPeerConnection(person.peerId, person.name, localStreamRef.current);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channelRef.current.send({ type: "broadcast", event: "WEBRTC_OFFER", payload: {
        toPeerId: person.peerId, fromPeerId: localPeerId, fromPeerName: userName, sdp: offer,
      } });
    } catch (error) { console.error("Impossible de joindre l'invité approuvé:", error); }
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
      if (shouldClose) setChatOpen(false);
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
      void closePollsPanel().then(() => setChatOpen(true));
    } else {
      setChatOpen(true);
    }
  };

  const togglePolls = () => {
    if (closingChatRef.current || closingPollsRef.current || containerRef.current?.querySelector<HTMLElement>('[data-visio-interaction-dock="true"]')?.dataset.visioClosing === "true") return;
    setReactionsOpen(false);
    if (pollsOpen) {
      void closePollsPanel();
    } else if (chatOpen) {
      void closeChatPanel().then(() => onTogglePolls?.());
    } else {
      onTogglePolls?.();
    }
  };

  const leaveMeeting = () => {
    if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    onLeave?.();
  };

  const moderatePeer = (peerId: string, action: "mute" | "remove") => {
    channelRef.current?.send({ type: "broadcast", event: "MODERATION", payload: { toPeerId: peerId, action } });
    if (action === "remove") {
      peerConnectionsRef.current.get(peerId)?.pc.close();
      peerConnectionsRef.current.delete(peerId);
      approvedPeerIdsRef.current.delete(peerId);
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
              title="Sondages et Quizz interactifs"
            >
              <BarChart2 size={16} />
              <span>Sondages</span>
            </button>
          )}

          <button type="button" className={`${styles.btnAction} ${styles.btnMobileDuplicate} ${chatOpen ? styles.btnActive : ""}`} onClick={toggleChat} aria-pressed={chatOpen} title="Ouvrir le chat de la réunion">
            <MessageSquare size={16} /><span>Chat ({chatMessages.length})</span>
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
              onClick={onLeave}
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
              onClick={retryPermissions}
              disabled={isLoading}
            >
              Réessayer
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
            {joinRejected && <button type="button" onClick={() => { setJoinRejected(false); setIsWaitingRoom(true); channelRef.current?.send({ type: "broadcast", event: "PEER_JOIN", payload: { peerId: localPeerId, peerName: userName, isHost: false } }); }}>Demander à nouveau</button>}
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
          <div className={styles.videoTile}>
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
                <span className={styles.mutedBadge} title="Micro coupé">
                  <MicOff size={13} color="#ef4444" />
                </span>
              )}
            </div>
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
            </div> : chatMessages.map(message => <article className={styles.chatMessage} key={message.id}>
              <strong>{message.name}{message.peerId === localPeerId ? " · vous" : ""}</strong><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>
            </article>)}
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
            title="Sondages & Quizz"
          >
            <BarChart2 size={18} />
            <span>Sondages</span>
          </button>
        )}

        <button type="button" className={`${styles.ctrlBtn} ${handRaised ? styles.ctrlBtnActive : ""}`} onClick={toggleHand} aria-pressed={handRaised} title={handRaised ? "Baisser la main" : "Lever la main"}>
          <Hand size={18} /><span>{handRaised ? "Main levée" : "Lever la main"}</span>
        </button>
        <button type="button" className={`${styles.ctrlBtn} ${chatOpen ? styles.ctrlBtnActive : ""}`} onClick={toggleChat} aria-pressed={chatOpen} title="Ouvrir le chat de la réunion">
          <MessageSquare size={18} /><span>Chat</span>
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
            className={`${styles.ctrlBtn} ${styles.ctrlBtnMobileDuplicate} ${styles.ctrlBtnLeave}`}
            onClick={leaveMeeting}
            title="Quitter la réunion"
          >
            <PhoneOff size={18} />
            <span>Quitter</span>
          </button>
        )}
      </footer>
    </div>
  );
}

// Composant Tuile pour les participants distants
function RemoteVideoTile({ peer, isHost, onModerate }: { peer: RemotePeer; isHost: boolean; onModerate: (peerId: string, action: "mute" | "remove") => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch((err) => {
        setPlaybackBlocked(true);
        console.warn("Lecture du flux distant en attente d'interaction:", err);
      });
    }
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
    <div className={styles.videoTile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`${styles.videoElement} ${peer.isVideoOff ? styles.videoHidden : ""}`}
      />

      {playbackBlocked && (
        <button type="button" className={styles.resumePlayback} onClick={() => {
          videoRef.current?.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
        }}>
          <Mic size={18} /> Écouter {peer.name}
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
        {peer.handRaised && <span className={styles.handBadge} title="Main levée"><Hand size={14} /></span>}
        {peer.isMuted && (
          <span className={styles.mutedBadge} title="Micro coupé">
            <MicOff size={13} color="#ef4444" />
          </span>
        )}
      </div>
      {peer.connection === "reconnecting" && <span className={styles.peerConnectionBadge}>Reconnexion…</span>}
      {peer.quality && <span className={`${styles.qualityBadge} ${peer.quality === "poor" ? styles.qualityPoor : peer.quality === "fair" ? styles.qualityFair : ""}`} aria-label={`Qualité réseau ${peer.quality === "good" ? "bonne" : peer.quality === "fair" ? "moyenne" : "faible"}`}><Wifi size={13} /></span>}
      {isHost && <div className={styles.moderationActions}>
        <button type="button" onClick={() => onModerate(peer.id, "mute")} title={`Demander à ${peer.name} de couper son micro`}><MicOff size={14} /> Demander coupure</button>
        <button type="button" onClick={() => onModerate(peer.id, "remove")} title={`Retirer ${peer.name} de la réunion`}><UserX size={14} /> Retirer</button>
      </div>}
    </div>
  );
}
