import { getAttendanceStatus, type AttendanceMap } from "./attendance";

export type PersonSummary = ReturnType<typeof summarizePerson>;
export function summarizePerson(input: object, kind: "member" | "guest") {
  const person = input as Record<string, unknown>;
  const text = (key: string, fallback = "") => typeof person[key] === "string" ? person[key] as string : fallback;
  const attendance = (person.attendance || {}) as AttendanceMap;
  const events: { date: string; activity: string; status: string; reason: string }[] = [];
  const activityNames: Record<string, string> = { culte: "Culte", cdm: "Cellule de maison" };
  const statuses = { present: "Présent", justified: "Absence justifiée", unjustified: "Absence non justifiée", unpointed: "Non pointé" };
  const activityIds = new Set([...Object.keys(attendance).filter(key => !key.startsWith("_")), ...Object.keys(attendance._attendance_status || {}), ...Object.keys(attendance._comments || {})]);
  for (const activityId of activityIds) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(activityId)) {
      const value = attendance[activityId] as unknown;
      events.push({ date: activityId, activity: "Culte", status: value ? "Présent" : "Non pointé", reason: "" });
      continue;
    }
    const dates = new Set([...Object.keys(attendance[activityId] || {}), ...Object.keys(attendance._attendance_status?.[activityId] || {}), ...Object.keys(attendance._comments?.[activityId] || {})]);
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const status = getAttendanceStatus(attendance, activityId, date);
      const value = attendance[activityId]?.[date];
      const service = value === "culte_2" ? " · Culte 2" : value === "culte_en_ligne" ? " · En ligne" : value === "culte_1" ? " · Culte 1" : "";
      events.push({ date, activity: activityNames[activityId] || activityId, status: statuses[status] + (status === "present" ? service : ""), reason: attendance._comments?.[activityId]?.[date] || "" });
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date) || a.activity.localeCompare(b.activity));
  const formations = Array.isArray(person.formations) ? person.formations as string[] : [];
  const steps = kind === "guest" ? [
    { label: "Contact établi", done: person.appelAbouti === true },
    { label: "Rencontre effectuée", done: person.rencontreEffectuee === true },
    { label: "Parcours PCNC terminé", done: person.terminePCNC === true },
    { label: "Intégré à une famille", done: person.isInBergerie === true || person.dansFamilleDisciple === true },
  ] : [
    { label: "Baptême", done: person.est_baptise === true },
    { label: "Formation", done: formations.length > 0 },
    { label: "Cellule de maison", done: person.est_cdm === true },
    { label: "Service dans un département", done: person.est_star === true },
  ];
  const contactAllowed = person.souhaiteEtreContacte !== false;
  const responsible = text("responsible");
  const nextAction = kind === "guest"
    ? !contactAllowed ? "Cette personne ne souhaite pas être contactée."
      : !person.appelAbouti ? "Prendre contact et renseigner le résultat de l’échange."
      : !person.rencontreEffectuee ? "Organiser une rencontre pour poursuivre l’accompagnement."
      : "Faire le point sur les prochaines étapes du parcours."
    : "Consulter les dernières présences et mettre à jour les informations utiles.";
  return {
    id: text("id"), name: [text("firstName"), text("lastName")].filter(Boolean).join(" ") || "Sans nom",
    firstName: text("firstName"), lastName: text("lastName"), kind, role: text("status", kind === "guest" ? "Invité" : "Membre"),
    phone: text("phone"), email: text("email"), address: text("address", text("adresse")),
    arrivalDate: text("arrivalDate", text("date_entree")), responsible: responsible && responsible !== "Non assigné" ? responsible : "À affecter",
    contactAllowed, notes: [text("commentaire"), text("commentaireSuivi"), text("commentaire_pcnc")].filter(Boolean),
    steps, events: events.slice(0, 30), eventCount: events.length, formations, nextAction,
  };
}
