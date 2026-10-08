"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Video, Users, Share2, Copy, Check, ShieldCheck, Monitor, 
  House, UserCheck, MessageSquare, ArrowLeft, Play, Link as LinkIcon, BarChart2
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { getActiveUserInfo, getActiveSpaceType } from "@/lib/client-session";
import { 
  buildRoomName, 
  getPublicVisioUrl, 
  getVisioLinkNotice,
  getJitsiVisioUrl,
  getWhatsAppShareUrl, 
  sanitizeRoomName,
  type VisioSpaceType 
} from "@/lib/visio";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import VideoConference from "@/components/visio/VideoConference";
import InteractivePollPanel from "@/components/visio/InteractivePollPanel";
import styles from "./VisioDashboard.module.css";

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

  // If activeTab is not in allowedTabs (e.g. following a state change), reset it
  useEffect(() => {
    if (!allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "custom");
    }
  }, [allowedTabs, activeTab]);

  // Field states
  const [customRoomInput, setCustomRoomInput] = useState("");
  const [guestNameInput, setGuestNameInput] = useState(paramGuestName || "");
  const [copied, setCopied] = useState(false);

  // Sync if params change
  useEffect(() => {
    if (paramRoom) {
      setInMeeting(true);
    }
    if (paramGuestName) {
      setGuestNameInput(paramGuestName);
    }
  }, [paramRoom, paramGuestName]);

  // Compute room name and title according to active tab
  const { roomName, meetingTitle, description } = useMemo(() => {
    if (paramRoom) {
      return {
        roomName: paramRoom,
        meetingTitle: "Réunion Poimén",
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
    const code = customRoomInput.trim() || "reunion-generale";
    const room = buildRoomName({
      churchName: church,
      customCode: code,
    });
    return {
      roomName: room,
      meetingTitle: `Salle : ${code}`,
      description: "Salle de réunion avec lien d'accès direct.",
    };
  }, [
    paramRoom, 
    activeTab, 
    workspace, 
    guestNameInput, 
    customRoomInput, 
    paramGuestId,
    isFamily
  ]);

  const publicUrl = getPublicVisioUrl(roomName, activeTab === "guest" ? guestNameInput : undefined);
  const linkNotice = getVisioLinkNotice(publicUrl);
  const jitsiUrl = getJitsiVisioUrl(roomName);
  const whatsappUrl = getWhatsAppShareUrl({
    roomName,
    title: meetingTitle,
    guestName: activeTab === "guest" ? guestNameInput : undefined,
  });

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
                setInMeeting(false);
                router.push("/dashboard/visio");
              }}
            >
              <ArrowLeft size={16} /> Retour au tableau de bord
            </button>
          </div>

          <div className={`${styles.meetingLayout} ${pollsOpen ? styles.withPolls : ""}`}>
            <VideoConference
              roomName={roomName}
              title={meetingTitle}
              userName={userName}
              userEmail={userEmail}
              guestName={activeTab === "guest" ? guestNameInput : undefined}
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
                  <label htmlFor="custom-room-field">Nom ou code de la salle</label>
                  <input
                    id="custom-room-field"
                    type="text"
                    placeholder="Ex: point-hebdo, priere-matin..."
                    value={customRoomInput}
                    onChange={(e) => setCustomRoomInput(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={styles.roomPreviewBox}>
              <span className={styles.roomLabel}>Identifiant de la salle :</span>
              <span className={styles.roomValue}>{roomName}</span>
            </div>

            {linkNotice && <p className={styles.linkNotice}><LinkIcon size={18} />{linkNotice}</p>}

            <div className={styles.actionsBar}>
              <a
                className={styles.btnJitsi}
                href={jitsiUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Video size={18} /> Démarrer avec Jitsi (gratuit)
              </a>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setInMeeting(true)}
              >
                <Play size={18} /> Démarrer la visioconférence
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleCopyLink}
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                {copied ? "Lien copié !" : "Copier le lien d'invitation"}
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleShareWhatsApp}
              >
                <Share2 size={16} color="#25d366" /> Inviter sur WhatsApp
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPollsOpen(!pollsOpen)}
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
                <ShieldCheck size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Chiffrement & Sécurité</h4>
                <p>Flux audio et vidéo protégés avec isolation des salles.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
