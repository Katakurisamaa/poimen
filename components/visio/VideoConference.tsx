"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Copy, Check, Share2, Maximize, Minimize, PhoneOff, 
  ShieldCheck, Monitor, Mic, Video, Users, ExternalLink, BarChart2 
} from "lucide-react";
import { getPublicVisioUrl, getWhatsAppShareUrl } from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./VideoConference.module.css";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
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
  userEmail,
  guestName,
  onLeave,
  onTogglePolls,
  pollsOpen,
}: VideoConferenceProps) {
  const { notify } = useFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const publicUrl = getPublicVisioUrl(roomName, guestName);
  const whatsappUrl = getWhatsAppShareUrl({
    roomName,
    title,
    guestName,
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      notify("Lien d'invitation copié dans le presse-papiers !");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Impossible de copier le lien. Copiez l'adresse URL manuellement.");
    }
  };

  const handleShareWhatsApp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initJitsi = () => {
      if (!isMounted || !jitsiContainerRef.current) return;

      // Dispose existing instance if any
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch {
          // ignore
        }
        apiRef.current = null;
      }

      jitsiContainerRef.current.innerHTML = "";

      try {
        const domain = "meet.jit.si";
        const options = {
          roomName,
          parentNode: jitsiContainerRef.current,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName: userName || "Participant",
            email: userEmail || undefined,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true, // Prevents mobile redirects to app store
            enableWelcomePage: false,
            enableClosePage: false,
            defaultLanguage: "fr",
            hideConferenceSubject: false,
            disableInviteFunctions: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: "",
            SHOW_POWERED_BY: false,
            DEFAULT_REMOTE_DISPLAY_NAME: "Participant",
            TOOLBAR_BUTTONS: [
              "microphone", "camera", "closedcaptions", "desktop", "fullscreen",
              "fodeviceselection", "hangup", "chat", "recording",
              "livestreaming", "etherpad", "sharedvideo", "settings", "raisehand",
              "videoquality", "filmstrip", "invite", "feedback", "stats", "shortcuts",
              "tileview", "videobackgroundblur", "download", "help", "mute-everyone",
              "security"
            ],
          },
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;

        api.addEventListener("videoConferenceJoined", () => {
          if (!isMounted) return;
          setIsLoading(false);
        });

        api.addEventListener("readyToClose", () => {
          if (!isMounted) return;
          onLeave?.();
        });

        api.addEventListener("videoConferenceLeft", () => {
          if (!isMounted) return;
          onLeave?.();
        });

        // Fallback to remove loading screen after 3.5s
        setTimeout(() => {
          if (isMounted) setIsLoading(false);
        }, 3500);

      } catch (err) {
        console.error("Error instantiating Jitsi Meet:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const existingScript = document.getElementById("jitsi-external-api-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "jitsi-external-api-script";
        script.src = "https://meet.jit.si/external_api.js";
        script.async = true;
        script.onload = () => {
          initJitsi();
        };
        script.onerror = () => {
          console.error("Failed to load Jitsi Meet External API script.");
          if (isMounted) setIsLoading(false);
        };
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener("load", initJitsi);
      }
    }

    return () => {
      isMounted = false;
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch {
          // ignore
        }
        apiRef.current = null;
      }
    };
  }, [roomName, userName, userEmail, onLeave]);

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
            <span className={styles.roomCode}>Salle : {roomName}</span>
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
            onClick={handleShareWhatsApp}
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

          <button 
            type="button" 
            className={styles.btnAction} 
            onClick={() => window.open(`https://meet.jit.si/${roomName}`, "_blank", "noopener,noreferrer")}
            title="Ouvrir la salle directement dans un nouvel onglet sans limite"
          >
            <ExternalLink size={16} />
            <span>Nouvel onglet</span>
          </button>

          {onLeave && (
            <button 
              type="button" 
              className={`${styles.btnAction} ${styles.btnLeave}`} 
              onClick={onLeave}
              title="Quitter la réunion"
            >
              <PhoneOff size={16} />
              <span>Quitter</span>
            </button>
          )}
        </div>
      </header>

      <div className={styles.videoWrapper}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <div className={styles.loadingText}>Connexion à la visioconférence Poimén...</div>
            <div className={styles.loadingSub}>
              Préparation de votre salle sécurisée avec micro, caméra et partage d'écran.
            </div>
          </div>
        )}
        <div 
          ref={jitsiContainerRef} 
          style={{ width: "100%", height: "100%", minHeight: 480 }} 
        />
      </div>

      <footer className={styles.bottomTips}>
        <div className={styles.tipsTags}>
          <span className={styles.tipsTag}>
            <Monitor size={14} color="#d4af37" /> Partage d'écran HD
          </span>
          <span className={styles.tipsTag}>
            <Users size={14} color="#d4af37" /> Multi-participants
          </span>
          <span className={styles.tipsTag}>
            <ShieldCheck size={14} color="#10b981" /> Flux chiffré & sécurisé
          </span>
        </div>
        <span>Accessible sur mobile, tablette et ordinateur sans installation</span>
      </footer>
    </div>
  );
}
