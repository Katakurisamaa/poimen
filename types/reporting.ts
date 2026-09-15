export interface FddReportingData {
  id?: string;
  bergerie_id: string;
  church_id?: string;
  nom_famille: string;
  nom_berger: string;
  slogan?: string; // Slogan / Devise personnalisable par famille
  date_rapport: string; // YYYY-MM-DD
  date_libelle?: string; // Dimanche 30 août 2026
  logo_url?: string;

  // Membres
  nombre_total_membres: number;
  repartition_hommes: number;
  repartition_femmes: number;

  // Cultes (Culte 1, Culte 2, Culte en ligne)
  culte_1: number;
  culte_2: number;
  culte_en_ligne: number;

  // Absences et engagements
  absences_justifiees: number;
  absences_non_justifiees: number;
  star_en_service: number;
  nombre_total_star: number;
  reunion_hebdomadaire: number;
  nouveaux_membres: number;

  // Disciples
  nombre_disciples: number;
  taux_participation_disciples: number; // %

  // Synthèse & Actions
  points_cles: string[];
  action_1: string;
  action_2: string;
  action_3: string;
  verset_texte: string;
  verset_ref: string;

  created_at?: string;
  updated_at?: string;
}

export interface CalculatedMetrics {
  totalParticipation: number;
  tauxParticipationGlobale: number; // %
  
  // % sur le total des membres
  pctTotalCulte1: number;
  pctTotalCulte2: number;
  pctTotalCulteEnLigne: number;
  pctTotalHommes: number;
  pctTotalFemmes: number;
  pctTotalAbsenceDimanche: number;
  pctTotalAbsencesJustifiees: number;
  pctTotalAbsencesNonJustifiees: number;
  pctTotalStarEnService: number;
  pctTotalStar: number;
  pctTotalReunionHebdo: number;
  pctTotalNouveauxMembres: number;

  // % sur la participation
  pctPartCulte1: number;
  pctPartCulte2: number;
  pctPartCulteEnLigne: number;
  pctPartHommes: number;
  pctPartFemmes: number;

  // Absences totales
  totalAbsences: number;
}

export function computeReportingMetrics(data: FddReportingData): CalculatedMetrics {
  const total = Math.max(0, data.nombre_total_membres || 0);
  const c1 = Math.max(0, data.culte_1 || 0);
  const c2 = Math.max(0, data.culte_2 || 0);
  const cLigne = Math.max(0, data.culte_en_ligne || 0);
  
  const totalPart = c1 + c2 + cLigne;
  const absJust = Math.max(0, data.absences_justifiees || 0);
  const totalAbs = Math.max(0, total - totalPart);
  
  // Si les absences non justifiées ne sont pas renseignées ou égales à zéro alors qu'il y a des absences
  const absNonJust = (data.absences_non_justifiees !== undefined && data.absences_non_justifiees > 0)
    ? data.absences_non_justifiees
    : Math.max(0, totalAbs - absJust);

  const pct = (val: number, base: number) => base > 0 ? parseFloat(((val / base) * 100).toFixed(2)) : 0;

  return {
    totalParticipation: totalPart,
    tauxParticipationGlobale: pct(totalPart, total),

    // % sur total membres
    pctTotalCulte1: pct(c1, total),
    pctTotalCulte2: pct(c2, total),
    pctTotalCulteEnLigne: pct(cLigne, total),
    pctTotalHommes: pct(data.repartition_hommes, total),
    pctTotalFemmes: pct(data.repartition_femmes, total),
    pctTotalAbsenceDimanche: pct(totalAbs, total),
    pctTotalAbsencesJustifiees: pct(absJust, total),
    pctTotalAbsencesNonJustifiees: pct(absNonJust, total),
    pctTotalStarEnService: pct(data.star_en_service, total),
    pctTotalStar: pct(data.nombre_total_star, total),
    pctTotalReunionHebdo: pct(data.reunion_hebdomadaire, total),
    pctTotalNouveauxMembres: pct(data.nouveaux_membres, total),

    // % sur la participation
    pctPartCulte1: pct(c1, totalPart),
    pctPartCulte2: pct(c2, totalPart),
    pctPartCulteEnLigne: pct(cLigne, totalPart),
    pctPartHommes: pct(data.repartition_hommes, totalPart),
    pctPartFemmes: pct(data.repartition_femmes, totalPart),

    totalAbsences: totalAbs,
  };
}

export function getKeyPointsSummary(data: FddReportingData, metrics: CalculatedMetrics): string[] {
  const points: string[] = [];

  // 1. Taux de participation globale
  if (data.nombre_total_membres > 0) {
    if (metrics.tauxParticipationGlobale >= 80) {
      points.push(`Excellente mobilisation : ${metrics.tauxParticipationGlobale}% de participation globale (${metrics.totalParticipation} sur ${data.nombre_total_membres} membres).`);
    } else if (metrics.tauxParticipationGlobale >= 50) {
      points.push(`La participation globale est de ${metrics.tauxParticipationGlobale}% (${metrics.totalParticipation} présents sur ${data.nombre_total_membres} membres).`);
    } else if (metrics.totalParticipation > 0) {
      points.push(`Participation globale : ${metrics.tauxParticipationGlobale}% (${metrics.totalParticipation} présents sur ${data.nombre_total_membres} membres).`);
    } else {
      points.push(`Aucune présence enregistrée au culte ce dimanche sur ${data.nombre_total_membres} membres.`);
    }
  } else {
    points.push(`Taux de participation globale : ${metrics.tauxParticipationGlobale}%.`);
  }

  // 2. Répartition des cultes
  const cultes = [
    { name: "Culte 1", count: data.culte_1 || 0, pct: metrics.pctPartCulte1 || 0 },
    { name: "Culte 2", count: data.culte_2 || 0, pct: metrics.pctPartCulte2 || 0 },
    { name: "Culte en ligne", count: data.culte_en_ligne || 0, pct: metrics.pctPartCulteEnLigne || 0 },
  ].filter(c => c.count > 0);

  cultes.sort((a, b) => b.count - a.count);

  if (metrics.totalParticipation === 0) {
    points.push("Aucune participation aux cultes ce dimanche.");
  } else if (cultes.length === 1) {
    points.push(`100% des présences se concentrent sur le ${cultes[0].name} (${cultes[0].count} participant${cultes[0].count > 1 ? "s" : ""}).`);
  } else if (cultes.length === 2 && cultes[0].count === cultes[1].count) {
    points.push(`Participation équilibrée entre le ${cultes[0].name} et le ${cultes[1].name} (${cultes[0].pct}% chacun).`);
  } else if (cultes.length >= 2) {
    const others = cultes.slice(1).map(c => `${c.name} (${c.pct}%)`).join(", ");
    points.push(`Le ${cultes[0].name} arrive en tête avec ${cultes[0].pct}% des participants (${cultes[0].count}), suivi de : ${others}.`);
  }

  // 3. Répartition Hommes / Femmes
  if (data.repartition_femmes === data.repartition_hommes && data.repartition_femmes > 0) {
    points.push(`Parité dans la famille : 50% de femmes (${data.repartition_femmes}) et 50% d'hommes (${data.repartition_hommes}).`);
  } else if (data.repartition_femmes > data.repartition_hommes) {
    points.push(`Les femmes représentent ${metrics.pctTotalFemmes}% de l'effectif (${data.repartition_femmes}) et les hommes ${metrics.pctTotalHommes}% (${data.repartition_hommes}).`);
  } else if (data.repartition_hommes > data.repartition_femmes) {
    points.push(`Les hommes représentent ${metrics.pctTotalHommes}% de l'effectif (${data.repartition_hommes}) et les femmes ${metrics.pctTotalFemmes}% (${data.repartition_femmes}).`);
  } else {
    points.push(`Répartition par genre : ${metrics.pctTotalFemmes}% femmes, ${metrics.pctTotalHommes}% hommes.`);
  }

  // 4. Absences
  const effectiveNonJust = (data.absences_non_justifiees !== undefined && data.absences_non_justifiees > 0)
    ? data.absences_non_justifiees
    : Math.max(0, metrics.totalAbsences - data.absences_justifiees);

  if (effectiveNonJust === 0) {
    if (data.absences_justifiees === 0) {
      points.push("Assiduité remarquable : aucune absence signalée ce dimanche !");
    } else {
      points.push(`Toutes les absences sont justifiées (${data.absences_justifiees} absence${data.absences_justifiees > 1 ? "s" : ""} justifiée${data.absences_justifiees > 1 ? "s" : ""}).`);
    }
  } else if (effectiveNonJust === 1) {
    points.push(`1 absence non justifiée à contacter pour suivi pastoral${data.absences_justifiees > 0 ? ` (${data.absences_justifiees} justifiée${data.absences_justifiees > 1 ? "s" : ""})` : ""}.`);
  } else {
    points.push(`${effectiveNonJust} absences non justifiées à suivre en priorité${data.absences_justifiees > 0 ? ` (${data.absences_justifiees} justifiée${data.absences_justifiees > 1 ? "s" : ""})` : ""}.`);
  }

  // 5. STAR en service
  if (data.star_en_service > 0) {
    points.push(`${data.star_en_service} membre${data.star_en_service > 1 ? "s" : ""} STAR en service ce dimanche${data.nombre_total_star > 0 ? ` (sur ${data.nombre_total_star} ouvriers)` : ""}.`);
  } else if (data.nombre_total_star > 0) {
    points.push(`Aucun membre STAR en service ce dimanche (${data.nombre_total_star} ouvriers dans la famille).`);
  } else {
    points.push("Aucun ouvrier STAR répertorié dans la famille actuellement.");
  }

  // 6. Nouveaux membres & Disciples
  if (data.nouveaux_membres > 0) {
    points.push(`${data.nouveaux_membres} nouveau${data.nouveaux_membres > 1 ? "x" : ""} membre${data.nouveaux_membres > 1 ? "s" : ""} accueilli${data.nouveaux_membres > 1 ? "s" : ""} cette semaine.`);
  } else if (data.nombre_disciples > 0) {
    points.push(`Engagement des faiseurs de disciples : ${data.taux_participation_disciples || 0}% de présence (${data.nombre_disciples} FDD répertoriés).`);
  } else {
    points.push("Aucun nouveau membre enregistré cette semaine.");
  }

  return points;
}

// Alias for backward compatibility
export const getIntelligentKeyPoints = getKeyPointsSummary;

