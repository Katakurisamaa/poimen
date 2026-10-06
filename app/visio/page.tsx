"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Video, ShieldCheck, Monitor, Users, Play, ExternalLink } from "lucide-react";
import PoimenLogo from "@/components/brand/PoimenLogo";
import VideoConference from "@/components/visio/VideoConference";
import InteractivePollPanel from "@/components/visio/InteractivePollPanel";
import styles from "./PublicVisio.module.css";

export default function PublicVisioPage() {
  return (
    <Suspense fallback={null}>
      <PublicVisioContent />
    </Suspense>
  );
}

function PublicVisioContent() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") || "poimen-reunion";
  const nameParam = searchParams.get("name") || "";

  const [displayName, setDisplayName] = useState(nameParam);
  const [hasJoined, setHasJoined] = useState(false);
  const [pollsOpen, setPollsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (nameParam) {
      setDisplayName(nameParam);
    }
  }, [nameParam]);

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!displayName.trim()) return;
    setHasJoined(true);
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className={styles.pageWrapper}>
      {hasJoined ? (
        <div 
          className={styles.meetingContainer}
          style={{ 
            display: "grid", 
            gridTemplateColumns: pollsOpen ? "minmax(0, 1fr) 380px" : "1fr", 
            gap: 12, 
            height: "100%", 
            width: "100%" 
          }}
        >
          <VideoConference
            roomName={roomParam}
            title="Visioconférence Poimén"
            userName={displayName.trim()}
            onTogglePolls={() => setPollsOpen(!pollsOpen)}
            pollsOpen={pollsOpen}
            onLeave={() => setHasJoined(false)}
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
      ) : (
        <div className={styles.prejoinContainer}>
          <div className={styles.prejoinCard}>
            <div className={styles.brandRow}>
              <PoimenLogo />
              <p className={styles.brandSubtitle}>
                Espace de Visioconférence & Partage d'Écran
              </p>
            </div>

            <div className={styles.roomBadge}>
              <Video size={16} />
              <span>Salle : {roomParam}</span>
            </div>

            <form className={styles.formBox} onSubmit={handleJoin}>
              <label htmlFor="participant-name">
                Votre Prénom et Nom pour la réunion :
              </label>
              <input
                id="participant-name"
                className={styles.inputName}
                type="text"
                placeholder="Ex: Jean Dupont"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
                required
              />

              <button
                type="submit"
                className={styles.btnJoin}
                disabled={!displayName.trim()}
              >
                <Play size={18} /> Rejoindre la visioconférence
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`https://meet.jit.si/${roomParam}`, "_blank", "noopener,noreferrer");
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--ux-line, rgba(255, 255, 255, 0.12))",
                  color: "var(--cream, #f8fafc)",
                  padding: "12px",
                  borderRadius: "14px",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                }}
              >
                <ExternalLink size={15} /> Ouvrir dans un nouvel onglet
              </button>
            </form>

            <p className={styles.infoFootnote}>
              Connexion directe et sécurisée depuis votre navigateur. 
              Aucune installation d'application requise.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
