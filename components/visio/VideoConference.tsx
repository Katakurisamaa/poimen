"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  Mic, MicOff, Video, VideoOff, Monitor, BarChart2,
  Users, AlertCircle 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPublicVisioUrl, getVisioLinkNotice, getJitsiVisioUrl, getWhatsAppShareUrl } from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./VideoConference.module.css";

const ICE_SERVERS: RTCIceServer[] = [
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
}

interface VideoConferenceProps {
  roomName: string;
  title: string;
  userName?: string;
  userEmail?: string;
  guestName?: string;
  onLeave?: () => void;
  onTogglePolls?: () => void;
  pollsOpen?: boolean;
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
  pollsOpen,
}: VideoConferenceProps) {
  const { notify } = useFeedback();
  const containerRef = useRef<HTMLDivElement>(null);

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

  // UI states
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, { pc: RTCPeerConnection; name: string }>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRequestRef = useRef(0);
  const channelRef = useRef<any>(null);

  const publicUrl = getPublicVisioUrl(roomName, guestName);
  const linkNotice = getVisioLinkNotice(publicUrl);
  const jitsiUrl = getJitsiVisioUrl(roomName);
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
      // 1. Essai complet universel : Caméra + Micro
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
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
  }, [notify]);

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
          payload: { peerId: localPeerId, peerName: userName },
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

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
          return prev.map((p) => (p.id === peerId ? { ...p, stream: incomingStream } : p));
        }
        return [...prev, { id: peerId, name: peerName, stream: incomingStream }];
      });
    };

    // Allow a brief network interruption, then release departed peers.
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    pc.onconnectionstatechange = () => {
      clearTimeout(disconnectTimer);
      if (pc.connectionState === "disconnected") {
        disconnectTimer = setTimeout(() => {
          if (pc.connectionState === "disconnected") pc.close();
        }, 10000);
      }
      if (["failed", "closed"].includes(pc.connectionState) && peerConnectionsRef.current.get(peerId)?.pc === pc) {
        setRemotePeers((prev) => prev.filter((p) => p.id !== peerId));
        peerConnectionsRef.current.delete(peerId);
        pendingIceCandidatesRef.current.delete(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, { pc, name: peerName });
    return pc;
  }, [localPeerId]);

  // 3. Cycle de vie WebRTC et Signaling Supabase
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isSubscribed = true;
    const peerConnections = peerConnectionsRef.current;

    const startSignaling = async () => {
      // Let an immediately cancelled mount finish before opening physical devices.
      await Promise.resolve();
      if (!isSubscribed) return;
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

          const pc = createPeerConnection(fromPeerId, fromPeerName, localStreamRef.current!);
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
        .on("broadcast", { event: "PEER_LEAVE" }, ({ payload }) => {
          if (!payload?.peerId) return;
          const peerObj = peerConnectionsRef.current.get(payload.peerId);
          if (peerObj) {
            peerObj.pc.close();
            peerConnectionsRef.current.delete(payload.peerId);
          }
          setRemotePeers((prev) => prev.filter((p) => p.id !== payload.peerId));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Annoncer notre arrivée dans la salle
            channel.send({
              type: "broadcast",
              event: "PEER_JOIN",
              payload: { peerId: localPeerId, peerName: userName },
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
  }, [roomName, localPeerId, userName, initLocalMedia, createPeerConnection, flushPendingIceCandidates]);

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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
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
      className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}
    >
      <header className={styles.topBar}>
        <div className={styles.roomInfo}>
            <span className={`${styles.liveBadge} ${mediaMode === "blocked" ? styles.liveBadgeWarning : ""}`}>
            <span className={styles.liveDot} />
            {isLoading ? "Connexion..." : mediaMode === "blocked" ? "Mode écoute" : "En direct"}
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
              className={`${styles.btnAction} ${pollsOpen ? styles.btnActive : ""}`}
              onClick={onTogglePolls}
              title="Sondages et Quizz interactifs"
            >
              <BarChart2 size={16} />
              <span>Sondages</span>
            </button>
          )}

          <button
            type="button"
            className={styles.btnAction}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
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

      {linkNotice && <p className={styles.linkNotice}>{linkNotice}</p>}
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
              <a className={styles.btnJitsi} href={jitsiUrl} target="_blank" rel="noreferrer">
                Rejoindre avec Jitsi
              </a>
          </div>
        )}

        {totalParticipants === 1 && !isLoading && (
          <div className={styles.waitingHint}>
            <Users size={15} color="#d4af37" />
            <span>Vous êtes seul(e) dans cette réunion. Partagez le lien d'invitation pour accueillir les participants.</span>
          </div>
        )}

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
            <RemoteVideoTile key={peer.id} peer={peer} />
          ))}
        </div>
      </div>

      {/* Barre de contrôle flottante en bas */}
      <footer className={styles.controlsBar}>
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
            onClick={onTogglePolls}
            title="Sondages & Quizz"
          >
            <BarChart2 size={18} />
            <span>Sondages</span>
          </button>
        )}

        {onLeave && (
          <button
            type="button"
            className={`${styles.ctrlBtn} ${styles.ctrlBtnLeave}`}
            onClick={onLeave}
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
function RemoteVideoTile({ peer }: { peer: RemotePeer }) {
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
        {peer.isMuted && (
          <span className={styles.mutedBadge} title="Micro coupé">
            <MicOff size={13} color="#ef4444" />
          </span>
        )}
      </div>
    </div>
  );
}
