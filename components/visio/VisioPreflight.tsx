"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, ChevronDown, Mic, MicOff, Play } from "lucide-react";
import styles from "./VisioPreflight.module.css";

export interface VisioDeviceSelection {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

interface VisioPreflightProps {
  name: string;
  title: string;
  onJoin: (devices: VisioDeviceSelection) => void;
  onCancel?: () => void;
}

export default function VisioPreflight({ name, title, onJoin, onCancel }: VisioPreflightProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(false);
  const [error, setError] = useState("");
  const [openDeviceMenu, setOpenDeviceMenu] = useState<"camera" | "microphone" | null>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Les périphériques audio et vidéo ne sont pas accessibles dans ce navigateur.");
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
          catch { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); }
        }
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = stream;
        setCameraAvailable(stream.getVideoTracks().length > 0);
        setMicrophoneAvailable(stream.getAudioTracks().length > 0);
        if (videoRef.current) videoRef.current.srcObject = stream;
        const found = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        setDevices(found);
        const audio = found.find(device => device.kind === "audioinput");
        const video = found.find(device => device.kind === "videoinput");
        if (audio) setAudioDeviceId(audio.deviceId);
        if (video) setVideoDeviceId(video.deviceId);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Autorisez le micro ou la caméra dans votre navigateur.");
      }
    };
    void initialize();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  const audioInputs = devices.filter(device => device.kind === "audioinput");
  const videoInputs = devices.filter(device => device.kind === "videoinput");

  useEffect(() => {
    if (!openDeviceMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !copyRef.current?.contains(event.target)) setOpenDeviceMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDeviceMenu(null);
        copyRef.current?.querySelector<HTMLButtonElement>(`[data-device-trigger="${openDeviceMenu}"]`)?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [openDeviceMenu]);

  const selectDevices = async (kind: "audioinput" | "videoinput", id: string) => {
    const nextAudio = kind === "audioinput" ? id : audioDeviceId;
    const nextVideo = kind === "videoinput" ? id : videoDeviceId;
    if (kind === "audioinput") setAudioDeviceId(id); else setVideoDeviceId(id);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: microphoneAvailable ? (nextAudio ? { deviceId: { exact: nextAudio } } : true) : false,
        video: cameraAvailable ? (nextVideo ? { deviceId: { exact: nextVideo } } : true) : false,
      });
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = nextStream;
      if (videoRef.current) videoRef.current.srcObject = nextStream;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cet appareil ne peut pas être utilisé.");
    }
  };

  return (
    <section className={styles.shell} aria-labelledby="visio-preflight-title">
      <div className={styles.card}>
        <div className={styles.copy} ref={copyRef}>
          {onCancel && <button className={styles.cancel} type="button" onClick={onCancel}>← Retour</button>}
          <span className={styles.eyebrow}>Avant de rejoindre</span>
          <h1 id="visio-preflight-title">{title}</h1>
          <p>Vérifiez votre image et choisissez vos périphériques. Le micro et la caméra ne seront transmis qu’une fois la réunion rejointe.</p>
          <label className={styles.nameLabel} htmlFor="visio-preflight-name">Vous participez en tant que</label>
          <div className={styles.name}>{name}</div>
          <label className={styles.deviceLabel} htmlFor="visio-camera">Caméra</label>
          <div className={styles.selectWrap}><Camera size={16} />
            <button type="button" id="visio-camera" className={styles.deviceTrigger} data-device-trigger="camera" aria-haspopup="listbox" aria-expanded={openDeviceMenu === "camera"} aria-controls="visio-camera-options" onClick={() => setOpenDeviceMenu(openDeviceMenu === "camera" ? null : "camera")}>
              <span>{videoInputs.find(device => device.deviceId === videoDeviceId)?.label || (videoDeviceId ? `Caméra ${Math.max(1, videoInputs.findIndex(device => device.deviceId === videoDeviceId) + 1)}` : "Caméra par défaut")}</span><ChevronDown size={17} />
            </button>
            {openDeviceMenu === "camera" && <div id="visio-camera-options" className={styles.deviceOptions} role="listbox" aria-label="Choisir une caméra">
              {[{ id: "", label: "Caméra par défaut" }, ...videoInputs.map((device, index) => ({ id: device.deviceId, label: device.label || `Caméra ${index + 1}` }))].map(option => <button type="button" role="option" aria-selected={videoDeviceId === option.id} className={styles.deviceOption} key={option.id || "default-camera"} onClick={() => { setOpenDeviceMenu(null); void selectDevices("videoinput", option.id); }}><span>{option.label}</span>{videoDeviceId === option.id && <Check size={16} />}</button>)}
            </div>}
          </div>
          <label className={styles.deviceLabel} htmlFor="visio-microphone">Micro</label>
          <div className={styles.selectWrap}><Mic size={16} />
            <button type="button" id="visio-microphone" className={styles.deviceTrigger} data-device-trigger="microphone" aria-haspopup="listbox" aria-expanded={openDeviceMenu === "microphone"} aria-controls="visio-microphone-options" onClick={() => setOpenDeviceMenu(openDeviceMenu === "microphone" ? null : "microphone")}>
              <span>{audioInputs.find(device => device.deviceId === audioDeviceId)?.label || (audioDeviceId ? `Micro ${Math.max(1, audioInputs.findIndex(device => device.deviceId === audioDeviceId) + 1)}` : "Micro par défaut")}</span><ChevronDown size={17} />
            </button>
            {openDeviceMenu === "microphone" && <div id="visio-microphone-options" className={`${styles.deviceOptions} ${styles.deviceOptionsAbove}`} role="listbox" aria-label="Choisir un micro">
              {[{ id: "", label: "Micro par défaut" }, ...audioInputs.map((device, index) => ({ id: device.deviceId, label: device.label || `Micro ${index + 1}` }))].map(option => <button type="button" role="option" aria-selected={audioDeviceId === option.id} className={styles.deviceOption} key={option.id || "default-microphone"} onClick={() => { setOpenDeviceMenu(null); void selectDevices("audioinput", option.id); }}><span>{option.label}</span>{audioDeviceId === option.id && <Check size={16} />}</button>)}
            </div>}
          </div>
          <div className={styles.statusRow}>
            <span className={cameraAvailable ? styles.ok : styles.missing}>{cameraAvailable ? <Camera size={15} /> : <CameraOff size={15} />}{cameraAvailable ? "Caméra prête" : "Caméra indisponible"}</span>
            <span className={microphoneAvailable ? styles.ok : styles.missing}>{microphoneAvailable ? <Mic size={15} /> : <MicOff size={15} />}{microphoneAvailable ? "Micro prêt" : "Micro indisponible"}</span>
          </div>
          {error && <p className={styles.error} role="status">{error} Vous pourrez rejoindre en mode écoute.</p>}
          <button className={styles.join} type="button" onClick={() => onJoin({ audioDeviceId: audioDeviceId || undefined, videoDeviceId: videoDeviceId || undefined })}>
            <Play size={17} /> Rejoindre la réunion
          </button>
        </div>
        <div className={styles.preview}>
          <video ref={videoRef} autoPlay playsInline muted aria-label="Aperçu de votre caméra" />
          {!cameraAvailable && <div className={styles.previewFallback}><CameraOff size={32} /><span>Aperçu caméra indisponible</span></div>}
          <span className={styles.previewName}>{name}</span>
        </div>
      </div>
    </section>
  );
}
