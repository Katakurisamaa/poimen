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

  // Cultes (Culte 1, Culte 2, Culte en ligne, Culte 1 & 2)
  culte_1: number;
  culte_2: number;
  culte_1_et_2?: number; // Participants ayant assisté tant au Culte 1 qu'au Culte 2
  culte_en_ligne: number;
  taux_participation_globale?: number; // % Optionnel pour ajuster le taux de participation des membres

  // Absences et engagements
  absences_justifiees: number;
  absences_non_justifiees: number;
  star_en_service: number;
  nombre_total_star: number;
  reunion_hebdomadaire: number; // Participation aux sorties d'évangélisation de la semaine (lundi au dimanche)
  nouveaux_membres: number;

  // Disciples
  nombre_disciples: number;
  disciples_culte_1?: number;
  disciples_culte_2?: number;
  disciples_culte_1_et_2?: number; // Disciples ayant assisté tant au Culte 1 qu'au Culte 2
  disciples_culte_en_ligne?: number;
  disciples_presents_total?: number;
  taux_participation_disciples: number; // %

  // 1/4 H des familles (Agapé) - saisie manuelle
  quart_heure_tenue?: boolean;
  quart_heure_presents?: number;

  // Faiseurs de disciples
  faiseurs_de_disciples?: number;

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
  totalParticipation: number; // Participants physiques uniques (présentiel)
  totalParticipationAvecLigne?: number; // Participants totaux (présentiel + en ligne)
  tauxParticipationGlobale: number; // %
  
  // Disciples metrics
  disciplesTotal: number;
  disciplesCulte1: number;
  disciplesCulte2: number;
  disciplesCulte1Et2: number;
  disciplesCulteEnLigne: number;
  disciplesPresents: number;
  tauxParticipationDisciples: number; // %
  pctDisciplesCulte1: number;
  pctDisciplesCulte2: number;
  pctDisciplesCulte1Et2: number;
  pctDisciplesCulteEnLigne: number;

  // Faiseurs de disciples
  faiseursDeDisciples: number;

  // 1/4h des familles (Agapé)
  quartHeureTenue: boolean;
  quartHeurePresents: number;

  // % sur le total des membres
  pctTotalCulte1: number;
  pctTotalCulte2: number;
  pctTotalCulte1Et2: number;
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
  pctPartCulte1Et2: number;
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
  const cBoth = Math.max(0, data.culte_1_et_2 || 0);
  
  // Participants physiques uniques en présentiel :
  // Les participants aux 2 cultes étant comptés dans c1 et c2, on retranche le cumul
  // pour obtenir l'effectif exact des participants physiques uniques.
  const totalPartPhysique = Math.max(0, c1 + c2 - cBoth);
  // Total participants tous canaux (physique + en ligne conservé à titre informatif)
  const totalPartAvecLigne = Math.max(0, totalPartPhysique + cLigne);

  // Le taux de participation globale concerne uniquement les présences en présentiel.
  const totalPart = totalPartPhysique;
  const absJust = Math.max(0, data.absences_justifiees || 0);
  const totalAbs = Math.max(0, total - totalPart);
  
  // Si les absences non justifiées ne sont pas renseignées ou égales à zéro alors qu'il y a des absences
  const absNonJust = (data.absences_non_justifiees !== undefined && data.absences_non_justifiees > 0)
    ? data.absences_non_justifiees
    : Math.max(0, totalAbs - absJust);

  const pct = (val: number, base: number) => base > 0 ? parseFloat(Math.min(100, (val / base) * 100).toFixed(1)) : 0;

  const partGlobale = (data.taux_participation_globale !== undefined && data.taux_participation_globale > 0)
    ? data.taux_participation_globale
    : pct(totalPartPhysique, total);

  // Disciples metrics (taux en présentiel uniquement)
  const discTotal = Math.max(0, data.nombre_disciples || 0);
  const discC1 = Math.max(0, data.disciples_culte_1 || 0);
  const discC2 = Math.max(0, data.disciples_culte_2 || 0);
  const discLigne = Math.max(0, data.disciples_culte_en_ligne || 0);
  const discBoth = Math.max(0, data.disciples_culte_1_et_2 || 0);
  const computedDiscPartPhysique = Math.max(0, discC1 + discC2 - discBoth);
  const computedDiscPart = computedDiscPartPhysique;
  const discPart = (data.disciples_presents_total !== undefined && data.disciples_presents_total > 0)
    ? data.disciples_presents_total
    : (computedDiscPart > 0
        ? computedDiscPart
        : Math.round((discTotal * (data.taux_participation_disciples || 0)) / 100));

  const discPct = discTotal > 0
    ? pct(discPart, discTotal)
    : (data.taux_participation_disciples || 0);

  const faiseurs = data.faiseurs_de_disciples !== undefined
    ? Math.max(0, data.faiseurs_de_disciples)
    : 0;

  const quartTenue = data.quart_heure_tenue !== undefined ? Boolean(data.quart_heure_tenue) : false;
  const quartPresents = Math.max(0, data.quart_heure_presents || 0);

  return {
    totalParticipation: totalPart,
    totalParticipationAvecLigne: totalPartAvecLigne,
    tauxParticipationGlobale: partGlobale,

    // Disciples
    disciplesTotal: discTotal,
    disciplesCulte1: discC1,
    disciplesCulte2: discC2,
    disciplesCulte1Et2: discBoth,
    disciplesCulteEnLigne: discLigne,
    disciplesPresents: discPart,
    tauxParticipationDisciples: discPct,
    pctDisciplesCulte1: pct(discC1, discTotal),
    pctDisciplesCulte2: pct(discC2, discTotal),
    pctDisciplesCulte1Et2: pct(discBoth, discTotal),
    pctDisciplesCulteEnLigne: pct(discLigne, discTotal),

    // Faiseurs & 1/4h
    faiseursDeDisciples: faiseurs,
    quartHeureTenue: quartTenue,
    quartHeurePresents: quartPresents,

    // % sur total membres
    pctTotalCulte1: pct(c1, total),
    pctTotalCulte2: pct(c2, total),
    pctTotalCulte1Et2: pct(cBoth, total),
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

    // % sur la participation physique (présentiel)
    pctPartCulte1: pct(c1, totalPartPhysique),
    pctPartCulte2: pct(c2, totalPartPhysique),
    pctPartCulte1Et2: pct(cBoth, totalPartPhysique),
    pctPartCulteEnLigne: pct(cLigne, total),
    pctPartHommes: pct(data.repartition_hommes, totalPartPhysique),
    pctPartFemmes: pct(data.repartition_femmes, totalPartPhysique),

    totalAbsences: totalAbs,
  };
}

export function getKeyPointsSummary(data: FddReportingData, metrics: CalculatedMetrics): string[] {
  const points: string[] = [];

  // 1. Taux de participation globale (présentiel)
  if (data.nombre_total_membres > 0) {
    if (metrics.tauxParticipationGlobale >= 80) {
      points.push(`Excellente mobilisation : ${metrics.tauxParticipationGlobale}% de participation en présentiel (${metrics.totalParticipation} sur ${data.nombre_total_membres} membres).`);
    } else if (metrics.tauxParticipationGlobale >= 50) {
      points.push(`La participation en présentiel est de ${metrics.tauxParticipationGlobale}% (${metrics.totalParticipation} présents sur ${data.nombre_total_membres} membres).`);
    } else if (metrics.totalParticipation > 0) {
      points.push(`Participation en présentiel : ${metrics.tauxParticipationGlobale}% (${metrics.totalParticipation} présents sur ${data.nombre_total_membres} membres).`);
    } else {
      points.push(`Aucune présence en présentiel enregistrée au culte ce dimanche sur ${data.nombre_total_membres} membres.`);
    }
  } else {
    points.push(`Taux de participation globale (présentiel) : ${metrics.tauxParticipationGlobale}%.`);
  }

  // 2. Répartition des cultes physiques
  const cultes = [
    { name: "Culte 1", count: data.culte_1 || 0, pct: metrics.pctPartCulte1 || 0 },
    { name: "Culte 2", count: data.culte_2 || 0, pct: metrics.pctPartCulte2 || 0 },
  ].filter(c => c.count > 0);

  cultes.sort((a, b) => b.count - a.count);

  if (metrics.totalParticipation === 0) {
    points.push("Aucune participation physique aux cultes ce dimanche.");
  } else if (cultes.length === 1) {
    points.push(`100% des présences physiques se concentrent sur le ${cultes[0].name} (${cultes[0].count} participant${cultes[0].count > 1 ? "s" : ""}).`);
  } else if (cultes.length === 2 && cultes[0].count === cultes[1].count) {
    const bothMention = (data.culte_1_et_2 || 0) > 0 ? ` (dont ${data.culte_1_et_2} aux deux cultes)` : "";
    points.push(`Participation physique équilibrée entre le ${cultes[0].name} et le ${cultes[1].name} (${cultes[0].pct}% chacun)${bothMention}.`);
  } else if (cultes.length >= 2) {
    const others = cultes.slice(1).map(c => `${c.name} (${c.pct}%)`).join(", ");
    const bothMention = (data.culte_1_et_2 || 0) > 0 ? ` dont ${data.culte_1_et_2} ayant assisté aux deux cultes` : "";
    points.push(`Le ${cultes[0].name} arrive en tête avec ${cultes[0].pct}% des participants physiques (${cultes[0].count}), suivi de : ${others}${bothMention}.`);
  }

  if ((data.culte_en_ligne || 0) > 0) {
    points.push(`${data.culte_en_ligne} participant${data.culte_en_ligne > 1 ? "s" : ""} ont suivi le culte en ligne (${metrics.pctTotalCulteEnLigne}% de l'effectif total).`);
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
    points.push(`${data.star_en_service} membre${data.star_en_service > 1 ? "s" : ""} S.T.A.R en service ce dimanche${data.nombre_total_star > 0 ? ` (sur ${data.nombre_total_star} membres S.T.A.R)` : ""}.`);
  } else if (data.nombre_total_star > 0) {
    points.push(`Aucun membre S.T.A.R en service ce dimanche (${data.nombre_total_star} membres S.T.A.R dans la famille).`);
  } else {
    points.push("Aucun membre S.T.A.R répertorié dans la famille actuellement.");
  }

  // 6. Nouveaux membres & Disciples
  if (data.nouveaux_membres > 0) {
    points.push(`${data.nouveaux_membres} nouveau${data.nouveaux_membres > 1 ? "x" : ""} membre${data.nouveaux_membres > 1 ? "s" : ""} accueilli${data.nouveaux_membres > 1 ? "s" : ""} cette semaine.`);
  } else if (data.nombre_disciples > 0) {
    points.push(`Engagement des faiseurs de disciples : ${data.taux_participation_disciples || 0}% de présence (${data.nombre_disciples} FDD répertoriés).`);
  } else {
    points.push("Aucun nouveau membre enregistré cette semaine.");
  }

  // 7. Sorties d'évangélisation
  if (data.reunion_hebdomadaire > 0) {
    points.push(`Mobilisation pour l'évangélisation : ${data.reunion_hebdomadaire} participant${data.reunion_hebdomadaire > 1 ? "s" : ""} aux sorties cette semaine (${metrics.pctTotalReunionHebdo}% des membres).`);
  }

  return points;
}

// Alias for backward compatibility
export const getIntelligentKeyPoints = getKeyPointsSummary;

