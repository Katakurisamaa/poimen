/**
 * Utilities for Poimén Video Conferences (Visio).
 * Native WebRTC Video Conferences (Visio) for Poimén.
 * Direct peer-to-peer audio, video, screen-sharing and interactive polls.
 */

export function sanitizeRoomName(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "reunion";
}

export type VisioSpaceType = "family" | "integration" | "guest" | "custom";

export function buildRoomName({
  churchName,
  spaceType,
  familyOrContextName,
  guestId,
  customCode,
}: {
  churchName?: string;
  spaceType?: VisioSpaceType;
  familyOrContextName?: string;
  guestId?: string;
  customCode?: string;
}): string {
  const cleanChurch = sanitizeRoomName(churchName || "icc");

  if (customCode && customCode.trim()) {
    return `poimen-${cleanChurch}-${sanitizeRoomName(customCode)}`;
  }

  if (spaceType === "guest" && guestId) {
    const cleanGuest = sanitizeRoomName(guestId.slice(0, 10));
    return `poimen-${cleanChurch}-entretien-${cleanGuest}`;
  }

  if (spaceType === "family") {
    const cleanFam = sanitizeRoomName(familyOrContextName || "cellule");
    return `poimen-${cleanChurch}-famille-${cleanFam}`;
  }

  // default: integration team
  return `poimen-${cleanChurch}-integration-equipe`;
}

export function getPublicVisioUrl(roomName: string, participantName?: string): string {
  if (typeof window === "undefined") {
    return `/visio?room=${encodeURIComponent(roomName)}`;
  }
  const origin = window.location.origin;
  const params = new URLSearchParams({ room: roomName });
  if (participantName && participantName.trim()) {
    params.set("name", participantName.trim());
  }
  return `${origin}/visio?${params.toString()}`;
}

export function getVisioLinkNotice(link: string): string | null {
  if (!link.startsWith("http")) return null;
  const url = new URL(link);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return "Ce lien fonctionne uniquement sur cet ordinateur. Pour inviter depuis un autre appareil, ouvrez l'application avec son adresse HTTPS publique.";
  }
  if (url.protocol !== "https:") {
    return "Pour utiliser la caméra et le micro depuis un autre appareil, partagez l'adresse HTTPS de l'application.";
  }
  return null;
}

/** Free hosted fallback for browsers that block the embedded WebRTC client. */
export function getJitsiVisioUrl(roomName: string): string {
  return `https://meet.jit.si/${sanitizeRoomName(roomName)}`;
}

export function getWhatsAppShareUrl({
  roomName,
  title,
  guestName,
  origin,
}: {
  roomName: string;
  title: string;
  guestName?: string;
  origin?: string;
}): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams({ room: roomName });
  if (guestName && guestName.trim()) {
    params.set("name", guestName.trim());
  }
  const link = `${base}/visio?${params.toString()}`;

  const message = `Bonjour${guestName ? ` ${guestName}` : ""} !\n\nVous êtes invité(e) à participer à la réunion : *${title}*.\n\n👉 Cliquez sur le lien pour rejoindre la visioconférence (sur smartphone ou ordinateur, sans installation) :\n${link}\n\nÀ très vite !`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
