"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  Mic, MicOff, Video, VideoOff, Monitor, BarChart2,
  Users, AlertCircle 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPublicVisioUrl, getWhatsAppShareUrl } from "@/lib/visio";
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
  const localPeerId = useRef<string>(
    `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  ).current;

  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // UI states
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, { pc: RTCPeerConnection; name: string }>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<any>(null);

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
    setIsLoading(true);
    setPermissionError(null);

    let stream: MediaStream | null = null;

    try {
      // 1. Essai complet : Caméra + Micro
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setIsVideoOff(false);
      setIsMicMuted(false);
    } catch (err: any) {
      console.warn("Échec vidéo + audio, tentative audio seul:", err);
      try {
        // 2. Fallback Audio seul
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setIsVideoOff(true);
        setIsMicMuted(false);
        notify("Caméra non disponible : appel démarré en audio seul.");
      } catch (audioErr: any) {
        console.warn("Échec audio seul, tentative vidéo seule:", audioErr);
        try {
          // 3. Fallback Vidéo seule (si micro absent)
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          setIsVideoOff(false);
          setIsMicMuted(true);
          notify("Micro non disponible : appel démarré en vidéo seule.");
        } catch (totalErr: any) {
          console.warn("Accès média bloqué (NotAllowedError):", totalErr);
          // 4. Fallback Mode Écoute Seule (Spectateur) : flux vide pour ne jamais bloquer la réunion
          stream = new MediaStream();
          setIsVideoOff(true);
          setIsMicMuted(true);
          setPermissionError(
            "L'accès au micro et à la caméra est bloqué dans votre navigateur."
          );
        }
      }
    }

    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
    setIsLoading(false);
    return stream;
  }, [notify]);

  // Fonction pour réactiver micro/caméra une fois l'autorisation accordée
  const retryPermissions = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(newStream);
      setPermissionError(null);
      setIsVideoOff(false);
      setIsMicMuted(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        localVideoRef.current.play().catch(() => {});
      }

      // Remplacer ou ajouter les pistes dans toutes les connexions actives
      const newAudio = newStream.getAudioTracks()[0];
      const newVideo = newStream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach(({ pc }) => {
        if (newAudio) {
          const aSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (aSender) aSender.replaceTrack(newAudio);
          else pc.addTrack(newAudio, newStream);
        }
        if (newVideo) {
          const vSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) vSender.replaceTrack(newVideo);
          else pc.addTrack(newVideo, newStream);
        }
      });

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "TRACK_STATUS",
          payload: { peerId: localPeerId, isMuted: false, isVideoOff: false },
        });
      }

      notify("Micro et caméra connectés avec succès !");
    } catch (err) {
      console.warn("Échec nouvelle tentative média:", err);
      notify("Permissions toujours bloquées. Vérifiez l'icône de cadenas 🔒 dans la barre d'adresse.");
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
      const incomingStream = event.streams[0];
      setRemotePeers((prev) => {
        const existing = prev.find((p) => p.id === peerId);
        if (existing) {
          return prev.map((p) => (p.id === peerId ? { ...p, stream: incomingStream } : p));
        }
        return [...prev, { id: peerId, name: peerName, stream: incomingStream }];
      });
    };

    // Gestion de la déconnexion
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
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

    const startSignaling = async () => {
      const stream = await initLocalMedia();
      if (!stream || !isSubscribed) return;
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
          const pc = createPeerConnection(peerId, peerName, activeStream!);
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

          const pc = createPeerConnection(fromPeerId, fromPeerName, activeStream!);
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
          if (peerObj && candidate) {
            try {
              if (peerObj.pc.remoteDescription) {
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
      // Nettoyage complet
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "PEER_LEAVE",
          payload: { peerId: localPeerId },
        });
        channelRef.current.unsubscribe();
      }

      peerConnectionsRef.current.forEach(({ pc }) => pc.close());
      peerConnectionsRef.current.clear();

      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
    };
  }, [roomName, localPeerId, userName, initLocalMedia, createPeerConnection]);

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
    }
  };

  // Partage d'écran
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Arrêt du partage d'écran
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      const cameraTrack = localStream?.getVideoTracks()[0];
      if (cameraTrack) {
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(cameraTrack);
        });
      }

      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
      notify("Partage d'écran arrêté.");
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

        screenTrack.onended = () => {
          toggleScreenShare();
        };

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
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            En direct
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
              <strong style={{ color: "#fef08a" }}>Micro / Caméra non autorisés :</strong>{" "}
              <span style={{ color: "var(--cream, #f8fafc)" }}>{permissionError}</span>
              <span style={{ display: "block", color: "var(--ux-muted, #94a3b8)", marginTop: 3, fontSize: 12 }}>
                💡 Cliquez sur l'icône de cadenas ou de réglages 🔒 à gauche de la barre d'adresse (à côté de <code>localhost:3000</code>), activez <strong>Caméra</strong> et <strong>Microphone</strong>, puis cliquez sur <strong>Réessayer</strong>.
              </span>
            </div>
            <button
              type="button"
              className={styles.btnRetryPermission}
              onClick={retryPermissions}
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
          title={isMicMuted ? "Activer le micro" : "Couper le micro"}
        >
          {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
          <span>{isMicMuted ? "Micro coupé" : "Micro actif"}</span>
        </button>

        <button
          type="button"
          className={`${styles.ctrlBtn} ${isVideoOff ? styles.ctrlBtnOff : ""}`}
          onClick={toggleCam}
          title={isVideoOff ? "Activer la caméra" : "Couper la caméra"}
        >
          {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
          <span>{isVideoOff ? "Caméra coupée" : "Caméra"}</span>
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

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch((err) => {
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
