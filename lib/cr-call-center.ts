export interface CrGuest {
  id: string; firstName?: string; lastName?: string;
  phone?: string; email?: string; address?: string; arrivalDate?: string;
  aps?: boolean; localChurch?: boolean; autreEglise?: string; souhaiteEtreContacte?: boolean;
  appelAbouti?: boolean; neDecrochePas?: boolean; fauxNumero?: boolean;
  prevuRevenir?: boolean; estRevenuCulte?: boolean; groupeWhatsapp?: boolean;
  rdvPastoral?: boolean; visiteDomicile?: boolean; interetFormation?: boolean;
  pcnc?: boolean; p101?: boolean; p201?: boolean; p301?: boolean; terminePCNC?: boolean;
  interetCDM?: boolean; integreCDM?: boolean; dansFamilleDisciple?: boolean; souhaitSuivi?: boolean;
  piliers1?: boolean; piliers2?: boolean; piliers3?: boolean; piliers4?: boolean; termine12Piliers?: boolean;
  commentaireSuivi?: string;
}
export const hasCallAttempt = (g: CrGuest) => Boolean(g.appelAbouti || g.neDecrochePas || g.fauxNumero || /\[TENTATIVE/i.test(g.commentaireSuivi || ""));
export const formatCrDate = (value?: string) => value ? value.split("T")[0].split("-").reverse().join("/") : "Non renseignée";
export function buildCrReport(guests: CrGuest[]) {
  const count = (matches: (g: CrGuest) => unknown) => guests.filter(matches).length;
  const withChurch = count(g => g.localChurch || g.autreEglise?.trim());
  return [
    { title: "Nombre de personnes reçues", value: guests.length, rows: [
      { label: "Nombre de personnes ayant laissé leurs coordonnées", value: count(g => g.phone?.trim() || g.email?.trim() || g.address?.trim()) },
      { label: "Avec église", value: withChurch },
      { label: "Sans église", value: guests.length - withChurch },
    ] },
    { title: "Nombre de personnes contactées", value: count(hasCallAttempt), rows: [
      { label: "Faux numéros ou erronés / sans numéro", value: count(g => g.fauxNumero || !g.phone?.trim()) },
      { label: "Ne décroche pas suite à plusieurs relances", value: count(g => !g.appelAbouti && (g.neDecrochePas || /\[TENTATIVE/i.test(g.commentaireSuivi || ""))) },
      { label: "Call center non entamé", value: count(g => !hasCallAttempt(g)) },
    ] },
    { title: "Nombre d’appels aboutis", value: count(g => g.appelAbouti), rows: [
      { label: "Revient à l’église", value: count(g => g.prevuRevenir) },
      { label: "Sont revenues à l’église", value: count(g => g.estRevenuCulte) },
      { label: "Groupe WhatsApp", value: count(g => g.groupeWhatsapp) },
      { label: "RDV pastoral", value: count(g => g.rdvPastoral) },
      { label: "Souhait visites", value: count(g => g.visiteDomicile) },
      { label: "Souhait inscription PCNC", value: count(g => g.interetFormation) },
      { label: "Inscrit au PCNC", value: count(g => g.pcnc || g.p101 || g.p201 || g.p301 || g.terminePCNC) },
      { label: "Souhaite intégrer une cellule de maison", value: count(g => g.interetCDM) },
      { label: "Cellule de maison ok", value: count(g => g.integreCDM) },
      { label: "Souhait suivi", value: count(g => g.souhaitSuivi) },
      { label: "APS", value: count(g => g.aps) },
      { label: "Inscrit au groupe des 12 piliers", value: count(g => g.piliers1 || g.piliers2 || g.piliers3 || g.piliers4 || g.termine12Piliers) },
    ] },
  ];
}
export function crReportText(guests: CrGuest[], church: string, period: string, comment: string) {
  return [`*CR CALL CENTER INVITÉS ${period.toUpperCase()} - INTEGRATION ${church.toUpperCase()}*`,
    ...buildCrReport(guests).map(group => `*${group.title} : ${group.value}*\n${group.rows.map(row => `• ${row.label} : ${row.value ?? "Non renseigné"}`).join("\n")}`),
    `*Commentaire*\n${comment.trim() || "Aucun commentaire."}`,
  ].join("\n\n");
}
