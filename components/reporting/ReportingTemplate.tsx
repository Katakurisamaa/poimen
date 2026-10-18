"use client";

import React from "react";
import { FddReportingData, computeReportingMetrics } from "@/types/reporting";
import IccLogo from "./IccLogo";
import { BIBLE_GLOW_BASE64 } from "@/lib/bible-glow-base64";
import {
  Users,
  Church,
  TrendingUp,
  Home,
  Network,
  Calendar,
  Quote,
} from "lucide-react";

interface ReportingTemplateProps {
  data: FddReportingData;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function ReportingTemplate({ data, containerRef }: ReportingTemplateProps) {
  const metrics = computeReportingMetrics(data);

  const formatPct = (val: number) => {
    return val.toString().replace(".", ",");
  };

  const defaultSlogan = "BÂTIR • SAUVER • PEUPLER";
  const defaultVerse = "Ce qui arriva du temps de Noé arrivera de même à l'avènement du Fils de l'homme. Car, aux jours qui précédèrent le déluge, les hommes mangeaient et buvaient, jusqu'au jour où Noé entra dans l'arche.";
  const defaultRef = "Matthieu 24:37-38";

  const currentSlogan = (data.slogan && data.slogan !== "Suivi • Participation • Engagement • Croissance")
    ? data.slogan
    : defaultSlogan;

  const currentVerse = (data.verset_texte && !data.verset_texte.includes("Nous qui bâtissons") && !data.verset_texte.includes("Colossiens") && !data.verset_texte.includes("bon cœur"))
    ? data.verset_texte
    : defaultVerse;

  const currentRef = (data.verset_ref && !data.verset_ref.includes("Néhémie") && !data.verset_ref.includes("Colossiens"))
    ? data.verset_ref
    : defaultRef;

  const currentFamilyName = (data.nom_famille && data.nom_famille !== "Famille de Disciples")
    ? data.nom_famille
    : "Famille de Noé";

  return (
    <div
      ref={containerRef as any}
      id="reporting-print-container"
      className="reporting-print-document"
      style={{
        width: 820,
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "24px 26px 20px",
        margin: "0 auto",
        boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
        borderRadius: "8px",
        boxSizing: "border-box",
        position: "relative",
        background:
          "radial-gradient(ellipse at 100% 0%, rgba(56,189,248,0.10) 0%, transparent 45%), radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.10) 0%, transparent 45%), #ffffff",
      }}
    >
      {/* ── TOP HEADER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          paddingBottom: 4,
        }}
      >
        {/* Left: ICC Logo & Titles */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IccLogo customLogoUrl={data.logo_url} width={120} height={62} lightMode={true} />

          {/* Vertical divider */}
          <div style={{ width: 2.5, height: 60, backgroundColor: "#0c1527", opacity: 0.9 }} />

          <div>
            <h1
              className="reporting-title-text"
              style={{
                fontSize: 19.5,
                fontWeight: 900,
                letterSpacing: 0.4,
                margin: 0,
                color: "#0c1527",
                textTransform: "uppercase",
                lineHeight: 1.15,
              }}
            >
              REPORTING, PARTICIPATION & ENGAGEMENT
            </h1>
            <div
              className="reporting-family-name"
              style={{
                fontSize: 16.5,
                fontWeight: 800,
                color: "#0c1527",
                marginTop: 2,
              }}
            >
              {currentFamilyName}
            </div>
            <div
              className="reporting-berger-name"
              style={{
                fontSize: 13,
                color: "#334155",
                marginTop: 1,
                fontWeight: 600,
              }}
            >
              <strong>Berger :</strong>{" "}
              {data.nom_berger && data.nom_berger.trim().toLowerCase() !== "berger"
                ? data.nom_berger
                : "Christy Mponda"}
            </div>
            <div
              className="reporting-tagline"
              style={{
                fontSize: 11.5,
                color: "#0c1527",
                letterSpacing: 1.2,
                marginTop: 2,
                fontWeight: 800,
              }}
            >
              {currentSlogan}
            </div>
          </div>
        </div>

        {/* Right: Date Badge */}
        <div
          style={{
            backgroundColor: "#0b1028",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "9px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 3px 10px rgba(11, 16, 40, 0.25)",
          }}
        >
          <Calendar size={16} color="#ffffff" />
          <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>
            DATE : {data.date_libelle || data.date_rapport}
          </span>
        </div>
      </div>

      {/* ── 2 COLUMNS: MEMBRES & DISCIPLES (CULTE 1 & CULTE 2 DISTINCTS SÉPARÉMENT) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        {/* ── LEFT COLUMN: MEMBRES ── */}
        <div
          style={{
            borderRadius: "12px",
            border: "2px solid #22c55e",
            boxShadow: "0 2px 8px rgba(34,197,94,0.08)",
            overflow: "hidden",
            backgroundColor: "#ffffff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              backgroundColor: "#0c1527",
              color: "#ffffff",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Users size={24} color="#ffffff" />
            <div style={{ width: 1.5, height: 20, backgroundColor: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase" }}>
              MEMBRES
            </span>
          </div>

          {/* Cards Stack */}
          <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
            {/* 1. Effectif Total */}
            <div
              style={{
                backgroundColor: "#ede9fe",
                borderRadius: "10px",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Users size={30} color="#0c1527" />
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527" }}>
                  Effectif total
                </span>
              </div>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#0c1527", lineHeight: 1 }}>
                {data.nombre_total_membres}
              </span>
            </div>

            {/* 2. Culte 1 (Séparé) */}
            <div
              style={{
                backgroundColor: "#dcfce7",
                borderRadius: "10px",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Church size={28} color="#15803d" />
                <div>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", display: "block" }}>
                    Culte 1
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                    Taux : {formatPct(metrics.pctTotalCulte1)}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 34, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>
                {data.culte_1 || 0}
              </span>
            </div>

            {/* 3. Culte 2 (Séparé) */}
            <div
              style={{
                backgroundColor: "#dcfce7",
                borderRadius: "10px",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Church size={28} color="#15803d" />
                <div>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", display: "block" }}>
                    Culte 2
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                    Taux : {formatPct(metrics.pctTotalCulte2)}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 34, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>
                {data.culte_2 || 0}
              </span>
            </div>

            {/* Optional: Culte en ligne */}
            {(data.culte_en_ligne || 0) > 0 && (
              <div
                style={{
                  backgroundColor: "#dcfce7",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Church size={24} color="#15803d" />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0c1527", display: "block" }}>
                      Culte en ligne
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                      Taux : {formatPct(metrics.pctTotalCulteEnLigne)}%
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>
                  {data.culte_en_ligne}
                </span>
              </div>
            )}

            {/* 4. Taux de Participation */}
            <div
              style={{
                backgroundColor: "#dcfce7",
                borderRadius: "10px",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <TrendingUp size={28} color="#15803d" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", whiteSpace: "nowrap" }}>
                  Taux de participation
                </span>
              </div>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#15803d",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 3,
                }}
              >
                <span>{formatPct(metrics.tauxParticipationGlobale)}</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>%</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: DISCIPLES ── */}
        <div
          style={{
            borderRadius: "12px",
            border: "2px solid #0284c7",
            boxShadow: "0 2px 8px rgba(2,132,199,0.08)",
            overflow: "hidden",
            backgroundColor: "#ffffff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              backgroundColor: "#0c1527",
              color: "#ffffff",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Users size={24} color="#ffffff" />
            <div style={{ width: 1.5, height: 20, backgroundColor: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase" }}>
              DISCIPLES
            </span>
          </div>

          {/* Cards Stack */}
          <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
            {/* 1. Effectif Total */}
            <div
              style={{
                backgroundColor: "#e0f2fe",
                borderRadius: "10px",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Users size={30} color="#0369a1" />
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527" }}>
                  Effectif total
                </span>
              </div>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#0c1527", lineHeight: 1 }}>
                {metrics.disciplesTotal}
              </span>
            </div>

            {/* 2. Culte 1 (Séparé) */}
            <div
              style={{
                backgroundColor: "#ffedd5",
                borderRadius: "10px",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Church size={28} color="#ea580c" />
                <div>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", display: "block" }}>
                    Culte 1
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c2410c", whiteSpace: "nowrap" }}>
                    Taux : {formatPct(metrics.pctDisciplesCulte1)}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 34, fontWeight: 900, color: "#ea580c", lineHeight: 1 }}>
                {metrics.disciplesCulte1}
              </span>
            </div>

            {/* 3. Culte 2 (Séparé) */}
            <div
              style={{
                backgroundColor: "#ffedd5",
                borderRadius: "10px",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Church size={28} color="#ea580c" />
                <div>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", display: "block" }}>
                    Culte 2
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c2410c", whiteSpace: "nowrap" }}>
                    Taux : {formatPct(metrics.pctDisciplesCulte2)}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 34, fontWeight: 900, color: "#ea580c", lineHeight: 1 }}>
                {metrics.disciplesCulte2}
              </span>
            </div>

            {/* Optional: Disciples Culte en ligne */}
            {metrics.disciplesCulteEnLigne > 0 && (
              <div
                style={{
                  backgroundColor: "#ffedd5",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Church size={24} color="#ea580c" />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0c1527", display: "block" }}>
                      Culte en ligne
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", whiteSpace: "nowrap" }}>
                      Taux : {formatPct(metrics.pctDisciplesCulteEnLigne)}%
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#ea580c", lineHeight: 1 }}>
                  {metrics.disciplesCulteEnLigne}
                </span>
              </div>
            )}

            {/* 4. Taux de Participation */}
            <div
              style={{
                backgroundColor: "#ffedd5",
                borderRadius: "10px",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <TrendingUp size={28} color="#ea580c" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0c1527", whiteSpace: "nowrap" }}>
                  Taux de participation
                </span>
              </div>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#ea580c",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 3,
                }}
              >
                <span>{formatPct(metrics.tauxParticipationDisciples)}</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>%</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: 1/4 H DES FAMILLES (Agapé) ── */}
      <div
        style={{
          borderRadius: "12px",
          border: "1.5px solid #c4b5fd",
          overflow: "hidden",
          marginBottom: 14,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#0c1527",
            color: "#ffffff",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <Home size={22} color="#ffffff" />
          <div style={{ width: 1.5, height: 18, backgroundColor: "rgba(255,255,255,0.4)" }} />
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>
            1/4 H DES FAMILLES
          </span>
        </div>

        {/* Content Box */}
        <div
          style={{
            backgroundColor: "#ede9fe",
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          {/* Tenue */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Home size={28} color="#0c1527" />
            <span style={{ fontSize: 16.5, fontWeight: 800, color: "#0c1527" }}>
              Tenue :
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                backgroundColor: metrics.quartHeureTenue ? "#bbf7d0" : "#fee2e2",
                color: metrics.quartHeureTenue ? "#166534" : "#991b1b",
                padding: "3px 18px",
                borderRadius: "20px",
                border: metrics.quartHeureTenue ? "1px solid #86efac" : "1px solid #fca5a5",
              }}
            >
              {metrics.quartHeureTenue ? "Oui" : "Non"}
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1.5, height: 38, backgroundColor: "#c4b5fd" }} />

          {/* Membres présents */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Users size={28} color="#0c1527" />
            <span style={{ fontSize: 16.5, fontWeight: 800, color: "#0c1527" }}>
              Membres présents :
            </span>
            <span style={{ fontSize: 38, fontWeight: 900, color: "#0c1527", lineHeight: 1 }}>
              {metrics.quartHeurePresents}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION: FAISEURS DE DISCIPLES ── */}
      <div
        style={{
          borderRadius: "12px",
          border: "1.5px solid #c4b5fd",
          overflow: "hidden",
          marginBottom: 14,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#0c1527",
            color: "#ffffff",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <Network size={22} color="#ffffff" />
          <div style={{ width: 1.5, height: 18, backgroundColor: "rgba(255,255,255,0.4)" }} />
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>
            FAISEURS DE DISCIPLES
          </span>
        </div>

        {/* Content Box */}
        <div
          style={{
            backgroundColor: "#ede9fe",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 900, color: "#0c1527", lineHeight: 1 }}>
            {metrics.faiseursDeDisciples}
          </span>
        </div>
      </div>

      {/* ── FOOTER BANNER: GLOWING BIBLE, MATTHIEU 24 VERSE & ICC LOGO ── */}
      <div
        style={{
          backgroundColor: "#050814",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        }}
      >
        {/* Left: Glowing Bible image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 140,
            height: 60,
            overflow: "hidden",
          }}
        >
          <img
            src={BIBLE_GLOW_BASE64}
            alt="Sainte Bible lumineuse"
            style={{
              height: 56,
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 10px rgba(251,191,36,0.35))",
            }}
          />
        </div>

        {/* Center: Verse */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 14px",
            flex: 1,
            gap: 10,
          }}
        >
          <Quote
            size={22}
            color="#38bdf8"
            style={{ transform: "rotate(180deg)", flexShrink: 0, opacity: 0.8 }}
          />
          <div>
            <div
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: "#ffffff",
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              &ldquo;{currentVerse}&rdquo;
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#facc15",
                marginTop: 2,
                letterSpacing: 0.3,
              }}
            >
              {currentRef}
            </div>
          </div>
          <Quote size={22} color="#38bdf8" style={{ flexShrink: 0, opacity: 0.8 }} />
        </div>

        {/* Right: ICC Logo */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 110, justifyContent: "flex-end" }}>
          <IccLogo customLogoUrl={data.logo_url} width={96} height={50} lightMode={false} />
        </div>
      </div>
    </div>
  );
}
