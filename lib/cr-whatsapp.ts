/**
 * Helpers for creating an accurate call-center summary to review and share on WhatsApp.
 */

export type CrStatus = boolean | null;
export type CrAudience = "team" | "group";

export interface SoulCrItem {
  id: string;
  name: string;
  arrivalDate?: string;
  appelAbouti: CrStatus;
  appelNonAboutiRaison?: string;
  revientEglise?: CrStatus;
  prevuRevenir: CrStatus;
  estRevenuCulte: CrStatus;
  groupeWhatsapp: CrStatus;
  pcnc: CrStatus;
  celluleMaison: string;
  crEnLigne?: CrStatus;
  commentaire: string;
}

export interface GuestCrSource {
  id: string;
  firstName?: string;
  lastName?: string;
  civility?: string;
  arrivalDate?: string;
  arrival_date?: string;
  appelAbouti?: boolean | null;
  appel_abouti?: boolean | null;
  motifRetrait?: string;
  motif_retrait?: string;
  neDecrochePas?: boolean | null;
  ne_decroche_pas?: boolean | null;
  fauxNumero?: boolean | null;
  faux_numero?: boolean | null;
  prevuRevenir?: boolean | null;
  prevu_revenir?: boolean | null;
  estRevenuCulte?: boolean | null;
  est_revenu_culte?: boolean | null;
  groupeWhatsapp?: boolean | null;
  groupe_whatsapp?: boolean | null;
  pcnc?: boolean | null;
  p101?: boolean | null;
  p201?: boolean | null;
  p301?: boolean | null;
  terminePCNC?: boolean | null;
  termine_pcnc?: boolean | null;
  interetFormation?: boolean | null;
  interet_formation?: boolean | null;
  interetCDM?: boolean | null;
  interet_cdm?: boolean | null;
  integreCDM?: boolean | null;
  integre_cdm?: boolean | null;
  familleDisciple?: string;
  famille_disciple?: string;
  dansFamilleDisciple?: boolean | null;
  dans_famille_disciple?: boolean | null;
  commentaireSuivi?: string;
  commentaire_suivi?: string;
  commentaire?: string;
}

export function formatCrDate(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${today.getFullYear()}`;
  }

  const clean = dateStr.split("T")[0];
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return clean;
}

function nullableBoolean(...values: Array<boolean | null | undefined>): CrStatus {
  const value = values.find(candidate => typeof candidate === "boolean");
  return typeof value === "boolean" ? value : null;
}

function statusEmoji(value?: CrStatus): string {
  if (value === true) return "✅";
  if (value === false) return "❌";
  return "À préciser";
}

export function cleanCommentaire(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/\[[A-Za-z0-9_]+:[^\]]*\]\s*/gi, "")
    .replace(/\[(?:FAUX_NUMERO|PAS_DE_NUMERO|NE_DECROCHE_PAS)\]\s*/gi, "")
    .replace(/Retir[ée] directement depuis l'onglet Mes [âa]mes/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function guestToSoulCrItem(guest: GuestCrSource): SoulCrItem {
  const firstName = (guest.firstName || "").trim();
  const lastName = (guest.lastName || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Invité(e)";
  const arrivalDate = guest.arrivalDate || guest.arrival_date;
  const appelAbouti = nullableBoolean(guest.appelAbouti, guest.appel_abouti);

  let appelNonAboutiRaison = "";
  const motif = guest.motifRetrait || guest.motif_retrait;
  if (appelAbouti === false) {
    if (motif === "ne_decroche_pas" || guest.neDecrochePas || guest.ne_decroche_pas) {
      appelNonAboutiRaison = "Ne décroche pas";
    } else if (motif === "faux_numero" || guest.fauxNumero || guest.faux_numero) {
      appelNonAboutiRaison = "Faux numéro";
    } else if (motif === "pas_de_numero") {
      appelNonAboutiRaison = "Pas de numéro";
    } else if (motif === "pas_interesse") {
      appelNonAboutiRaison = "Pas intéressé(e)";
    } else if (motif === "autre_eglise") {
      appelNonAboutiRaison = "Autre église";
    }
  }

  // An interest in training does not mean the person has started PCNC.
  const pcncSources = [guest.pcnc, guest.p101, guest.p201, guest.p301, guest.terminePCNC, guest.termine_pcnc]
    .filter((value): value is boolean => typeof value === "boolean");
  const pcnc: CrStatus = pcncSources.length
    ? pcncSources.some(Boolean)
    : null;
  const integre = nullableBoolean(guest.integreCDM, guest.integre_cdm);
  const interet = nullableBoolean(guest.interetCDM, guest.interet_cdm);
  const fdd = guest.familleDisciple || guest.famille_disciple;

  let celluleMaison = "";
  if (integre === true) {
    celluleMaison = fdd && fdd !== "AUCUNE" ? `✅ Intégré(e) (${fdd})` : "✅ Intégré(e)";
  } else if (interet === true) {
    celluleMaison = "Intéressé(e) / à orienter";
  } else if (fdd && fdd !== "AUCUNE") {
    celluleMaison = `✅ ${fdd}`;
  }

  const rawComment = guest.commentaireSuivi || guest.commentaire_suivi || guest.commentaire || "";

  return {
    id: guest.id,
    name,
    arrivalDate,
    appelAbouti,
    appelNonAboutiRaison,
    prevuRevenir: nullableBoolean(guest.prevuRevenir, guest.prevu_revenir),
    revientEglise: nullableBoolean(guest.prevuRevenir, guest.prevu_revenir, guest.estRevenuCulte, guest.est_revenu_culte),
    estRevenuCulte: nullableBoolean(guest.estRevenuCulte, guest.est_revenu_culte),
    groupeWhatsapp: nullableBoolean(guest.groupeWhatsapp, guest.groupe_whatsapp),
    pcnc,
    celluleMaison,
    crEnLigne: true,
    commentaire: cleanCommentaire(rawComment)
  };
}

export function formatSoulCrBlock(item: SoulCrItem, audience: CrAudience = "team"): string {
  const appel = item.appelAbouti === false && item.appelNonAboutiRaison
    ? `❌ (${item.appelNonAboutiRaison})`
    : statusEmoji(item.appelAbouti);

  const lines = [
    `*${item.name}*`,
    "",
    `*Appel Abouti* : ${appel}`,
    "",
    `*Revient à l’église* : ${statusEmoji(item.revientEglise === undefined ? item.prevuRevenir : item.revientEglise)}`,
    "",
    `*Groupe WhatsApp* :  ${statusEmoji(item.groupeWhatsapp)}`,
    "",
    `*PCNC* :${statusEmoji(item.pcnc)}`,
    "",
    `*Cellule de maison*: ${item.celluleMaison.trim() || "À préciser"}`,
    "",
    `*CR en ligne* : ${statusEmoji(item.crEnLigne === undefined ? true : item.crEnLigne)}`
  ];

  if (audience === "team" && item.commentaire && item.commentaire.trim()) {
    lines.push("", `*Commentaire* : ${item.commentaire.trim()}`);
  }

  return lines.join("\n");
}

export function formatFullCrMessage(
  items: SoulCrItem[],
  dateStr?: string,
  audience: CrAudience = "team"
): string {
  if (!items || items.length === 0) return "";
  const effectiveDate = formatCrDate(dateStr || items[0]?.arrivalDate);
  const header = `*CR CALL CENTER DES INVITÉS DU _${effectiveDate}_*`;
  const blocks = items.map(item => formatSoulCrBlock(item, audience)).join("\n\n");
  return `${header}\n\n${blocks}\n\nBlessings 💎`;
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
