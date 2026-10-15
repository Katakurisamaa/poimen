"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Video, Play } from "lucide-react";
import PoimenLogo from "@/components/brand/PoimenLogo";
import VideoConference from "@/components/visio/VideoConference";
import InteractivePollPanel from "@/components/visio/InteractivePollPanel";
import VisioPreflight, { type VisioDeviceSelection } from "@/components/visio/VisioPreflight";
import styles from "./PublicVisio.module.css";
import { FeedbackProvider } from "@/components/experience/FeedbackProvider";

export default function PublicVisioPage() {
  return (
    <FeedbackProvider><Suspense fallback={null}>
      <PublicVisioContent />
    </Suspense></FeedbackProvider>
  );
}

function PublicVisioContent() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") || "poimen-reunion";
  const nameParam = searchParams.get("name") || "";
  const titleParam = searchParams.get("title") || "";
  const roomTitle = titleParam.trim() || `Salle ${roomParam}`;

  const [displayName, setDisplayName] = useState(nameParam);
  const [hasJoined, setHasJoined] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [privateRoomIssue, setPrivateRoomIssue] = useState("");
  const [privateRoomChecking, setPrivateRoomChecking] = useState(false);
  const [pollsOpen, setPollsOpen] = useState(false);
  const [mediaDevices, setMediaDevices] = useState<VisioDeviceSelection>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!roomParam.startsWith("poimen-prive-")) {
      setPrivateRoomChecking(false);
      setPrivateRoomIssue("");
      return;
    }
    let active = true;
    setPrivateRoomChecking(true);
    setPrivateRoomIssue("");
    void fetch(`/api/visio/custom-rooms?room=${encodeURIComponent(roomParam)}`, { cache: "no-store" })
      .then(async response => {
        const result = await response.json().catch(() => ({})) as { active?: boolean; error?: string };
        if (!active) return;
        if (!response.ok) setPrivateRoomIssue(result.error || "Impossible de vérifier la disponibilité de cette salle.");
        else if (result.active === false) setPrivateRoomIssue("L’animateur a supprimé cette salle. Demandez-lui un nouveau lien pour participer.");
      })
      .catch(() => { if (active) setPrivateRoomIssue("Impossible de vérifier la disponibilité de cette salle. Réessayez plus tard."); })
      .finally(() => { if (active) setPrivateRoomChecking(false); });
    return () => { active = false; };
  }, [roomParam]);

  useEffect(() => {
    if (nameParam) {
      setDisplayName(nameParam);
    }
  }, [nameParam]);

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!displayName.trim()) return;
    setShowPreflight(true);
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className={styles.pageWrapper}>
      {privateRoomChecking ? (
        <div className={styles.prejoinContainer}>
          <div className={styles.prejoinCard}>
            <div className={styles.roomBadge}><Video size={16} /><span>{roomTitle}</span></div>
            <h1>Vérification du lien…</h1>
          </div>
        </div>
      ) : privateRoomIssue ? (
        <div className={styles.prejoinContainer}>
          <div className={styles.prejoinCard}>
            <div className={styles.roomBadge}><Video size={16} /><span>{roomTitle}</span></div>
            <h1>Salle personnalisée indisponible</h1>
            <p className={styles.infoFootnote}>{privateRoomIssue}</p>
          </div>
        </div>
      ) : hasJoined ? (
        <div 
          className={`${styles.meetingContainer} ${pollsOpen ? styles.withPolls : ""}`}
          style={{ 
            display: "grid", 
            gap: 12, 
            height: "100%", 
            width: "100%" 
          }}
        >
          <VideoConference
            roomName={roomParam}
            title={roomTitle}
            userName={displayName.trim()}
            mediaDevices={mediaDevices}
            isHost={false}
            onTogglePolls={() => setPollsOpen(!pollsOpen)}
            pollsOpen={pollsOpen}
            onLeave={() => { setHasJoined(false); setShowPreflight(false); }}
            onRoomUnavailable={message => {
              setHasJoined(false);
              setShowPreflight(false);
              setPrivateRoomIssue(message);
            }}
          />

          {pollsOpen && (
            <div style={{ height: "100%", overflowY: "auto" }}>
              <InteractivePollPanel
                roomName={roomParam}
                isHost={false}
                userName={displayName.trim()}
                onClose={() => setPollsOpen(false)}
              />
            </div>
          )}
        </div>
      ) : showPreflight ? (
        <VisioPreflight
          name={displayName.trim()}
          title={roomTitle}
          onJoin={devices => {
            setMediaDevices(devices);
            setHasJoined(true);
          }}
          onCancel={() => setShowPreflight(false)}
        />
      ) : (
        <div className={styles.prejoinContainer}>
          <div className={styles.prejoinCard}>
            <div className={styles.brandRow}><PoimenLogo /><p className={styles.brandSubtitle}>Espace de Visioconférence & Partage d'Écran</p></div>
            <div className={styles.roomBadge}><Video size={16} /><span>{roomTitle}</span></div>
            <form className={styles.formBox} onSubmit={event => { event.preventDefault(); if (displayName.trim()) handleJoin(); }}>
              <label htmlFor="participant-name">Votre prénom et nom pour la réunion :</label>
              <input id="participant-name" className={styles.inputName} type="text" placeholder="Ex. Jean Dupont" value={displayName} onChange={event => setDisplayName(event.target.value)} autoFocus required />
              <button type="submit" className={styles.btnJoin} disabled={!displayName.trim()}><Play size={18} /> Continuer vers le contrôle des appareils</button>
            </form>
            <p className={styles.infoFootnote}>Vous pourrez choisir votre micro et votre caméra avant de rejoindre.</p>
          </div>
        </div>
      )}
    </main>
  );
}
