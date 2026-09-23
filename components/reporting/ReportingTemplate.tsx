"use client";

import React from "react";
import { FddReportingData, computeReportingMetrics, getIntelligentKeyPoints } from "@/types/reporting";
import IccLogo from "./IccLogo";
import {
  Users, Church, Mic, Monitor, User, Sprout,
  Target, BookOpen, CheckCircle2
} from "lucide-react";

interface ReportingTemplateProps {
  data: FddReportingData;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function ReportingTemplate({ data, containerRef }: ReportingTemplateProps) {
  const metrics = computeReportingMetrics(data);

  // Exact Colors from the reference poster
  const colors = {
    cardMembres: "#0c1527",
    cardParticipation: "#0b6638",
    cardCulte1: "#1d4ed8",
    cardCulte2: "#ea580c",
    cardCulteLigne: "#4c1d95",
    cardHommes: "#0284c7",
    cardFemmes: "#be185d",
    cardNouveaux: "#ea580c",
  };

  // 8 Top Badges (No EJP, No Culte du soir)
  const topBadges = [
    {
      label: "NOMBRE TOTAL\nDE MEMBRES",
      count: data.nombre_total_membres,
      pct: "100%",
      headerBg: colors.cardMembres,
      icon: <Users size={18} color="#ffffff" />,
    },
    {
      label: "TOTAL PARTICIPATION\nAU CULTE",
      count: metrics.totalParticipation,
      pct: `${metrics.tauxParticipationGlobale}%`,
      headerBg: colors.cardParticipation,
      icon: <Church size={18} color="#ffffff" />,
    },
    {
      label: "CULTE 1\n ",
      count: data.culte_1,
      pct: `${metrics.pctTotalCulte1}%`,
      headerBg: colors.cardCulte1,
      icon: <Mic size={18} color="#ffffff" />,
    },
    {
      label: "CULTE 2\n ",
      count: data.culte_2,
      pct: `${metrics.pctTotalCulte2}%`,
      headerBg: colors.cardCulte2,
      icon: <Mic size={18} color="#ffffff" />,
    },
    {
      label: "CULTE EN LIGNE\n ",
      count: data.culte_en_ligne,
      pct: `${metrics.pctTotalCulteEnLigne}%`,
      headerBg: colors.cardCulteLigne,
      icon: <Monitor size={18} color="#ffffff" />,
    },
    {
      label: "RÉPARTITION\nHOMMES",
      count: data.repartition_hommes,
      pct: `${metrics.pctTotalHommes}%`,
      headerBg: colors.cardHommes,
      icon: <User size={18} color="#ffffff" />,
    },
    {
      label: "RÉPARTITION\nFEMMES",
      count: data.repartition_femmes,
      pct: `${metrics.pctTotalFemmes}%`,
      headerBg: colors.cardFemmes,
      icon: <User size={18} color="#ffffff" />,
    },
    {
      label: "NOUVEAUX\nMEMBRES",
      count: data.nouveaux_membres,
      pct: `${metrics.pctTotalNouveauxMembres}%`,
      headerBg: colors.cardNouveaux,
      icon: <Sprout size={18} color="#ffffff" />,
    },
  ];

  // Pie chart calculation for the 3 cultes (Culte 1, Culte 2, Culte en ligne)
  const pieSlices = [
    { label: "Culte 1", count: data.culte_1, color: "#1d4ed8", pct: metrics.pctPartCulte1 },
    { label: "Culte 2", count: data.culte_2, color: "#15803d", pct: metrics.pctPartCulte2 },
    { label: "Culte en ligne", count: data.culte_en_ligne, color: "#ea580c", pct: metrics.pctPartCulteEnLigne },
  ];

  const totalPieCount = metrics.totalParticipation > 0 ? metrics.totalParticipation : 1;
  let accumulatedAngle = 0;
  const piePaths = pieSlices.map((slice) => {
    const fraction = (slice.count || 0) / totalPieCount;
    const angle = fraction * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle = endAngle;

    if (slice.count === 0) return null;

    const cx = 95;
    const cy = 95;
    const r = 85;
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const midRad = ((startAngle + angle / 2 - 90) * Math.PI) / 180;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midRad);
    const ly = cy + labelR * Math.sin(midRad);

    const pathData = fraction >= 0.999
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...slice,
      pathData,
      lx,
      ly,
      visible: slice.count > 0,
    };
  }).filter(Boolean);

  // Bar Chart calculations for "VUE D'ENSEMBLE" (scale up to 100)
  const barChartMax = Math.max(100, data.nombre_total_membres);
  const getBarHeight = (val: number) => {
    const pct = Math.min(100, Math.max(0, (val / barChartMax) * 100));
    return `${(pct / 100) * 88}px`;
  };

  return (
    <div
      ref={containerRef as any}
      id="reporting-print-container"
      className="reporting-print-document"
      style={{
        width: 880,
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "24px 26px 20px",
        margin: "0 auto",
        boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
        borderRadius: "4px",
        boxSizing: "border-box",
        position: "relative",
        background: "radial-gradient(ellipse at 85% 0%, rgba(139,92,246,0.06) 0%, transparent 50%), radial-gradient(ellipse at 15% 0%, rgba(212,175,55,0.04) 0%, transparent 45%), #ffffff",
      }}
    >
      {/* ── TOP HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        {/* Left: Official Logo & Titles */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IccLogo customLogoUrl={data.logo_url} width={130} height={70} lightMode={true} />
          
          {/* Vertical divider */}
          <div style={{ width: 2, height: 64, backgroundColor: "#0c0d22" }} />

          <div>
            <h1
              className="reporting-title-text"
              style={{
                fontSize: 20.5,
                fontWeight: 900,
                letterSpacing: 0.3,
                margin: 0,
                color: "#0c0d22",
                textTransform: "uppercase",
              }}
            >
              REPORTING, PARTICIPATION & ENGAGEMENT
            </h1>
            <div className="reporting-family-name" style={{ fontSize: 16, fontWeight: 700, color: "#0c0d22", marginTop: 2 }}>
              {data.nom_famille || "La famille des bâtisseurs"}
            </div>
            <div className="reporting-berger-name" style={{ fontSize: 13, color: "#334155", marginTop: 1, fontWeight: 500 }}>
              <strong>Berger :</strong> {data.nom_berger && data.nom_berger.trim().toLowerCase() !== "berger" ? data.nom_berger : "Prénom Nom"}
            </div>
            <div className="reporting-tagline" style={{ fontSize: 10.5, color: "#64748b", letterSpacing: 1.2, marginTop: 2, textTransform: "uppercase", fontWeight: 600 }}>
              {data.slogan || "Suivi • Participation • Engagement • Croissance"}
            </div>
          </div>
        </div>

        {/* Right: Date Badge */}
        <div
          style={{
            backgroundColor: "#0b1028",
            color: "#ffffff",
            padding: "9px 18px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 3px 10px rgba(11, 16, 40, 0.25)",
            marginTop: 4,
          }}
        >
          <BookOpen size={16} color="#fbbf24" />
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5 }}>
            DATE : {data.date_libelle || data.date_rapport}
          </span>
        </div>
      </div>

      {/* ── 8 TOP KPI CARDS (2-PART CARDS: COLORED TOP + WHITE BOTTOM) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 7,
          marginBottom: 16,
        }}
      >
        {topBadges.map((badge, idx) => (
          <div
            key={idx}
            style={{
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Top colored section with icon + label */}
            <div
              style={{
                backgroundColor: badge.headerBg,
                color: "#ffffff",
                padding: "8px 4px 6px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 56,
              }}
            >
              <div style={{ marginBottom: 3 }}>{badge.icon}</div>
              <div
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  lineHeight: 1.2,
                  textTransform: "uppercase",
                  whiteSpace: "pre-line",
                  opacity: 0.95,
                }}
              >
                {badge.label}
              </div>
            </div>

            {/* Bottom white section with big count + percentage */}
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "6px 2px 5px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 23,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#0c0d22",
                }}
              >
                {badge.count}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "#334155",
                  marginTop: 2,
                }}
              >
                {badge.pct}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT (TABLE ON LEFT, VISUALS ON RIGHT) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "405px 1fr", gap: 14, marginBottom: 14 }}>
        {/* ── LEFT: DÉTAIL DES PARTICIPATIONS & ENGAGEMENT TABLE ── */}
        <div className="reporting-card-white" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", backgroundColor: "#ffffff" }}>
          <div
            style={{
              backgroundColor: "#0a0f1d",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 12,
              padding: "8px 12px",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            DÉTAIL DES PARTICIPATIONS & ENGAGEMENT
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 800, color: "#0f172a" }}>INDICATEURS</th>
                <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 800, color: "#0f172a", width: 50 }}>NOMBRE</th>
                <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 800, color: "#0f172a", width: 80 }}>
                  % SUR LE TOTAL ({data.nombre_total_membres})
                </th>
                <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 800, color: "#0f172a", width: 90 }}>
                  % SUR LA PARTICIPATION ({metrics.totalParticipation})
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Nombre total de membres", count: data.nombre_total_membres, pctTot: "100%", pctPart: "-" },
                { label: "Culte 1", count: data.culte_1, pctTot: `${metrics.pctTotalCulte1}%`, pctPart: `${metrics.pctPartCulte1}%` },
                { label: "Culte 2", count: data.culte_2, pctTot: `${metrics.pctTotalCulte2}%`, pctPart: `${metrics.pctPartCulte2}%` },
                { label: "Culte en ligne", count: data.culte_en_ligne, pctTot: `${metrics.pctTotalCulteEnLigne}%`, pctPart: `${metrics.pctPartCulteEnLigne}%` },
                { label: "Répartition Hommes", count: data.repartition_hommes, pctTot: `${metrics.pctTotalHommes}%`, pctPart: "-" },
                { label: "Répartition Femmes", count: data.repartition_femmes, pctTot: `${metrics.pctTotalFemmes}%`, pctPart: "-" },
              ].map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600, color: "#0f172a" }}>{row.label}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 800, color: "#0f172a" }}>{row.count}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, color: "#1e293b" }}>{row.pctTot}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, color: "#334155" }}>{row.pctPart}</td>
                </tr>
              ))}

              {/* HIGHLIGHTED ROW: TOTAL PARTICIPATION (LIGHT GREEN BACKGROUND) */}
              <tr style={{ backgroundColor: "#bbf7d0", borderTop: "2px solid #16a34a", borderBottom: "2px solid #16a34a" }}>
                <td style={{ padding: "6px 8px", fontWeight: 900, color: "#14532d", textTransform: "uppercase" }}>
                  TOTAL PARTICIPATION AU CULTE
                </td>
                <td style={{ textAlign: "center", padding: "6px 4px", fontWeight: 900, color: "#14532d" }}>
                  {metrics.totalParticipation}
                </td>
                <td style={{ textAlign: "center", padding: "6px 4px", fontWeight: 900, color: "#14532d" }}>
                  {metrics.tauxParticipationGlobale}%
                </td>
                <td style={{ textAlign: "center", padding: "6px 4px", fontWeight: 900, color: "#14532d" }}>
                  {metrics.totalParticipation > 0 ? "100%" : "-"}
                </td>
              </tr>

              {[
                { label: "Absence le dimanche", count: metrics.totalAbsences, pctTot: `${metrics.pctTotalAbsenceDimanche}%`, pctPart: "-" },
                { label: "Absences justifiées", count: data.absences_justifiees, pctTot: `${metrics.pctTotalAbsencesJustifiees}%`, pctPart: "-" },
                { label: "Absences non justifiées", count: data.absences_non_justifiees, pctTot: `${metrics.pctTotalAbsencesNonJustifiees}%`, pctPart: "-" },
                { label: "S.T.A.R en service", count: data.star_en_service, pctTot: `${metrics.pctTotalStarEnService}%`, pctPart: "-" },
                { label: "Nombre de S.T.A.R", count: data.nombre_total_star, pctTot: `${metrics.pctTotalStar}%`, pctPart: "-" },
                { label: "Participation aux sorties d'évangélisation", count: data.reunion_hebdomadaire, pctTot: `${metrics.pctTotalReunionHebdo}%`, pctPart: "-" },
                { label: "Nouveaux membres (depuis la semaine dernière)", count: data.nouveaux_membres, pctTot: `${metrics.pctTotalNouveauxMembres}%`, pctPart: "-" },
              ].map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "4.5px 8px", fontWeight: 600, color: "#0f172a" }}>{row.label}</td>
                  <td style={{ textAlign: "center", padding: "4.5px 4px", fontWeight: 800, color: "#0f172a" }}>{row.count}</td>
                  <td style={{ textAlign: "center", padding: "4.5px 4px", fontWeight: 700, color: "#1e293b" }}>{row.pctTot}</td>
                  <td style={{ textAlign: "center", padding: "4.5px 4px", fontWeight: 700, color: "#334155" }}>{row.pctPart}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── RIGHT: VISUAL PANELS (CHARTS, SILHOUETTES, DISCIPLES) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Top: RÉPARTITION PAR CULTE (PIE CHART) */}
          <div className="reporting-card-white" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", backgroundColor: "#ffffff" }}>
            <div
              style={{
                backgroundColor: "#0a0f1d",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 10.5,
                padding: "7px 12px",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              RÉPARTITION DES PARTICIPANTS PAR CULTE
            </div>

            <div className="reporting-card-white" style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "8px 12px", backgroundColor: "#ffffff" }}>
              {/* Pie SVG */}
              <div style={{ width: 145, height: 145, position: "relative" }}>
                <svg viewBox="0 0 190 190" width="100%" height="100%">
                  {piePaths.length === 0 && (
                    <g>
                      <circle cx="95" cy="95" r="75" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                      <text x="95" y="95" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle" dominantBaseline="central">
                        Aucun participant
                      </text>
                    </g>
                  )}
                  {piePaths.map((slice: any, idx) => (
                    <g key={idx}>
                      <path d={slice.pathData} fill={slice.color} stroke="#ffffff" strokeWidth="2" />
                      {slice.pct >= 5 && (
                        <text
                          x={slice.lx}
                          y={slice.ly}
                          fill="#ffffff"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {slice.pct}%
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              {/* Legend with colored squares */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 11, fontWeight: 600 }}>
                {pieSlices.map((slice, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, backgroundColor: slice.color, borderRadius: "2px" }} />
                    <span className="reporting-legend-text" style={{ color: "#1e293b" }}>
                      {slice.label} ({slice.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle: 2 Columns (VUE D'ENSEMBLE BAR CHART & RÉPARTITION HOMMES/FEMMES) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Bar Chart: Vue d'ensemble with Y-axis */}
            <div className="reporting-card-white" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
              <div
                style={{
                  backgroundColor: "#0a0f1d",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 10,
                  padding: "6px 8px",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                VUE D'ENSEMBLE
              </div>
              
              <div className="reporting-card-white" style={{ padding: "8px 6px 4px", display: "flex", flex: 1, alignItems: "flex-end", backgroundColor: "#ffffff" }}>
                {/* Y-axis labels */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: 88,
                    fontSize: 8,
                    color: "#334155",
                    fontWeight: 600,
                    paddingRight: 4,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    lineHeight: 1,
                  }}
                >
                  <span>100</span>
                  <span>80</span>
                  <span>60</span>
                  <span>40</span>
                  <span>20</span>
                  <span>0</span>
                </div>

                {/* Bars */}
                <div style={{ display: "flex", flex: 1, justifyContent: "space-around", alignItems: "flex-end", height: 100, paddingLeft: 4 }}>
                  {[
                    { label: "Membres\ntotaux", val: data.nombre_total_membres, color: "#2563eb" },
                    { label: "Participation\nculte", val: metrics.totalParticipation, color: "#16a34a" },
                    { label: "Absences\ntotales", val: metrics.totalAbsences, color: "#dc2626" },
                    { label: "Absences\nnon justifiées", val: data.absences_non_justifiees, color: "#ea580c" },
                    { label: "Absences\njustifiées", val: data.absences_justifiees, color: "#f59e0b" },
                  ].map((bar, idx) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "17%" }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>
                        {bar.val}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: getBarHeight(bar.val),
                          backgroundColor: bar.color,
                          borderRadius: "2px 2px 0 0",
                          minHeight: 4,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 6.5,
                          color: "#1e293b",
                          fontWeight: 700,
                          textAlign: "center",
                          marginTop: 3,
                          lineHeight: 1.1,
                          whiteSpace: "pre-line",
                          height: 18,
                        }}
                      >
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gender breakdown */}
            <div className="reporting-card-white" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
              <div
                style={{
                  backgroundColor: "#0a0f1d",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 10,
                  padding: "6px 8px",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                RÉPARTITION HOMMES/FEMMES
              </div>
              <div className="reporting-card-white" style={{ padding: "8px", flex: 1, display: "flex", alignItems: "center", justifyContent: "space-around", backgroundColor: "#ffffff" }}>
                {/* Man figure */}
                <div style={{ textAlign: "center" }}>
                  <svg viewBox="0 0 24 48" width="24" height="46">
                    <circle cx="12" cy="7" r="5" fill="#2563eb" />
                    <path d="M 4 15 C 4 13, 20 13, 20 15 L 18 30 L 15 30 L 15 46 L 9 46 L 9 30 L 6 30 Z" fill="#2563eb" />
                  </svg>
                  <div className="reporting-gender-num" style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginTop: 1 }}>
                    {data.repartition_hommes}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#2563eb" }}>
                    {metrics.pctTotalHommes}%
                  </div>
                </div>

                {/* Woman figure */}
                <div style={{ textAlign: "center" }}>
                  <svg viewBox="0 0 24 48" width="24" height="46">
                    <circle cx="12" cy="7" r="5" fill="#db2777" />
                    <path d="M 4 15 C 4 13, 20 13, 20 15 L 17 26 L 21 37 L 14 37 L 14 46 L 10 46 L 10 37 L 3 37 L 7 26 Z" fill="#db2777" />
                  </svg>
                  <div className="reporting-gender-num" style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginTop: 1 }}>
                    {data.repartition_femmes}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#db2777" }}>
                    {metrics.pctTotalFemmes}%
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#0a0f1d",
                  color: "#ffffff",
                  fontSize: 9.5,
                  fontWeight: 700,
                  textAlign: "center",
                  padding: "4px 0",
                  textTransform: "uppercase",
                }}
              >
                Total membres : {data.nombre_total_membres}
              </div>
            </div>
          </div>

          {/* Bottom Right: FAISEURS DE DISCIPLES & PARTICIPATION */}
          <div
            style={{
              backgroundColor: "#1e3a8a",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "9px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Users size={28} color="#ffffff" />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{data.nombre_disciples}</div>
                <div style={{ fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700, opacity: 0.9 }}>
                  FAISEURS DE DISCIPLES
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Target size={28} color="#facc15" />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: "#fef08a" }}>
                  {data.taux_participation_disciples || 0}%
                </div>
                <div style={{ fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700, opacity: 0.9, maxWidth: 140, lineHeight: 1.15 }}>
                  TAUX DE PARTICIPATION DES FDD AU CULTE EN PRÉSENTIEL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: POINTS CLÉS & ACTIONS SUGGÉRÉES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Left: POINTS CLÉS */}
        <div
          className="reporting-points-cles"
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                backgroundColor: "#15803d",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 800,
                padding: "3px 9px",
                borderRadius: "20px",
                letterSpacing: 0.5,
              }}
            >
              POINTS CLÉS
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#1e293b", lineHeight: 1.35 }}>
            {(data.points_cles && data.points_cles.filter(p => p && p.trim()).length > 0 
              ? data.points_cles.filter(p => p && p.trim()) 
              : getIntelligentKeyPoints(data, metrics)
            ).map((point, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <CheckCircle2 size={13} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: ACTIONS SUGGÉRÉES - ON PASSE À L'ACTION ! */}
        <div
          style={{
            backgroundColor: "#09090b",
            color: "#ffffff",
            borderRadius: "8px",
            padding: "10px 14px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>🎯</span>
            <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", color: "#ffffff" }}>
              PLAN D'ACTION — ON PASSE À L'ACTION !
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }}>
            {(() => {
              const actionsList = [
                data.action_1,
                data.action_2,
                data.action_3,
              ]
                .map((text) => (typeof text === "string" ? text.trim() : ""))
                .filter(Boolean);

              if (actionsList.length === 0) {
                return (
                  <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", padding: "6px 0" }}>
                    Aucune action définie pour cette semaine.
                  </div>
                );
              }

              return actionsList.map((text, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: "50%",
                      backgroundColor: "#ea580c",
                      color: "#ffffff",
                      fontSize: 10.5,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>
                    {text}
                  </span>
                </div>
              ));
            })()}
          </div>

          {/* Target graphic in background */}
          <div style={{ position: "absolute", right: -15, top: 0, opacity: 0.18, pointerEvents: "none" }}>
            <Target size={100} color="#10b981" />
          </div>
        </div>
      </div>

      {/* ── FOOTER BANNER: BIBLE VERSE & ICC LOGO ── */}
      <div
        style={{
          backgroundColor: "#080b18",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 3px 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* Bible & Quote */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: "78%" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <BookOpen size={18} color="#fbbf24" />
          </div>

          <div>
            <div style={{ fontSize: 11, fontStyle: "italic", color: "#f1f5f9", lineHeight: 1.35 }}>
              « {data.verset_texte || "Nous qui bâtissons le mur, nous avions tous notre épée à la main ; ainsi chacun travaillait d'une main, et de l'autre tenait son arme. Chacun bâtit à son endroit, et bâtit le mur."} »
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>
              {data.verset_ref || "Néhémie 4:11-12 (BDS)"}
            </div>
          </div>
        </div>

        {/* Right Logo */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <IccLogo customLogoUrl={data.logo_url} width={95} height={48} lightMode={false} />
        </div>
      </div>
    </div>
  );
}
