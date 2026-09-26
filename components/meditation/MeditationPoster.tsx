"use client";

import React from "react";
import {
  MeditationPlan,
  FIXED_MEDITATION_HOURS,
  MEDITATION_DAYS,
} from "@/types/meditation";
import { FAMILLE_NOE_LOGO_BASE64 } from "@/lib/famille-noe-logo-base64";
import {
  Sunrise,
  Sun,
  Sunset,
  Moon,
  BookOpen,
  Calendar,
} from "lucide-react";

interface MeditationPosterProps {
  plan: MeditationPlan;
  id?: string;
  themeStyle?: "obsidian" | "parchment";
}

export default function MeditationPoster({
  plan,
  id = "meditation-poster-container",
  themeStyle = "obsidian",
}: MeditationPosterProps) {
  const isDark = themeStyle === "obsidian";

  // High-contrast, authentic church color palette
  const bg = isDark ? "#0C081D" : "#FFFFFF";
  const borderColor = isDark ? "#D4AF37" : "#B45309";
  const tableHeaderBg = isDark ? "#1A1138" : "#F1F5F9";
  const tableBorderColor = isDark ? "#2D1F5A" : "#CBD5E1";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textMuted = isDark ? "#E2E8F0" : "#475569";
  const goldHeading = isDark ? "#FACC15" : "#92400E";
  const dayBadgeBg = isDark ? "#24154B" : "#FEF3C7";
  const dayBadgeBorder = isDark ? "#D4AF37" : "#B45309";
  const dayBadgeText = isDark ? "#FFFFFF" : "#92400E";
  const verseBg = isDark ? "#172554" : "#EFF6FF";
  const verseBorder = isDark ? "#38BDF8" : "#93C5FD";
  const verseColor = isDark ? "#93C5FD" : "#1D4ED8";
  const rowEvenBg = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)";

  const hourIcons = [
    <Sunrise key="0" size={16} style={{ color: isDark ? "#FBBF24" : "#D97706" }} />,
    <Sun key="1" size={16} style={{ color: isDark ? "#FDE047" : "#B45309" }} />,
    <Sunset key="2" size={16} style={{ color: isDark ? "#FB923C" : "#EA580C" }} />,
    <Moon key="3" size={16} style={{ color: isDark ? "#C084FC" : "#7C3AED" }} />,
  ];

  return (
    <div
      id={id}
      style={{
        width: 920,
        margin: "0 auto",
        background: bg,
        borderRadius: 20,
        border: `3px solid ${borderColor}`,
        boxShadow: isDark
          ? "0 20px 50px rgba(0, 0, 0, 0.9)"
          : "0 16px 40px rgba(0, 0, 0, 0.12)",
        padding: "32px 32px 28px",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        color: textColor,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ── HEADER : LOGO & INSTITUTIONAL TITLE ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `2px solid ${borderColor}`,
          paddingBottom: 22,
          marginBottom: 24,
        }}
      >
        {/* Left: Official Circular Logo & Church Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              overflow: "hidden",
              border: `3px solid ${borderColor}`,
              background: "#050614",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            {/* Direct Base64 Image to guarantee instant loading without network/caching bugs */}
            <img
              src={FAMILLE_NOE_LOGO_BASE64}
              alt="Logo Famille de Noé"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: goldHeading,
                fontWeight: 800,
                marginBottom: 3,
              }}
            >
              Impact Centre Chrétien • Famille de Noé
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: "0.2px",
                color: textColor,
                lineHeight: 1.2,
              }}
            >
              PLANNING HEBDOMADAIRE DE MÉDITATION
            </h1>
            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: textMuted,
                fontWeight: 700,
              }}
            >
              BÂTIR • SAUVER • PEUPLER
            </div>
          </div>
        </div>

        {/* Right: Week & Theme Pills */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Week Label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 8,
              background: dayBadgeBg,
              border: `1.5px solid ${dayBadgeBorder}`,
              color: dayBadgeText,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <Calendar size={16} />
            <span>{plan.week_label || "Semaine en cours"}</span>
          </div>

          {/* Book / Theme */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 8,
              background: isDark ? "#181135" : "#F8FAFC",
              border: `1px solid ${tableBorderColor}`,
              color: textColor,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <BookOpen size={15} style={{ color: goldHeading }} />
            <span>{plan.livre_theme || "Méditation biblique"}</span>
          </div>

          {plan.verset_cle && (
            <div
              style={{
                fontSize: 11.5,
                color: textMuted,
                fontWeight: 600,
              }}
            >
              Verset clé :{" "}
              <strong style={{ color: goldHeading }}>{plan.verset_cle}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── SCHEDULE TABLE ── */}
      <div
        style={{
          borderRadius: 12,
          border: `2px solid ${tableBorderColor}`,
          overflow: "hidden",
          background: isDark ? "#120B27" : "#FFFFFF",
        }}
      >
        {/* Table Header: Fixed Hours */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px repeat(4, 1fr)",
            background: tableHeaderBg,
            borderBottom: `2px solid ${tableBorderColor}`,
            padding: "12px 10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: goldHeading,
              paddingLeft: 12,
            }}
          >
            JOURS
          </div>

          {FIXED_MEDITATION_HOURS.map((hour, idx) => (
            <div
              key={hour.id}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                borderLeft: idx > 0 ? `1px solid ${tableBorderColor}` : undefined,
                padding: "2px 6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {hourIcons[idx]}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: textColor,
                    letterSpacing: "0.5px",
                  }}
                >
                  {hour.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: textMuted,
                  fontWeight: 700,
                }}
              >
                {hour.name}
              </span>
            </div>
          ))}
        </div>

        {/* Table Rows: Monday to Friday */}
        {MEDITATION_DAYS.map((day, dIdx) => {
          const daySchedule = plan.schedule[day.id] || {};
          const isEven = dIdx % 2 === 0;

          return (
            <div
              key={day.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px repeat(4, 1fr)",
                borderBottom:
                  dIdx < MEDITATION_DAYS.length - 1
                    ? `1px solid ${tableBorderColor}`
                    : "none",
                background: isEven ? rowEvenBg : "transparent",
                minHeight: 64,
                alignItems: "center",
              }}
            >
              {/* Day Cell */}
              <div style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    background: dayBadgeBg,
                    border: `1.5px solid ${dayBadgeBorder}`,
                    color: dayBadgeText,
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {day.label}
                </div>
              </div>

              {/* 4 Slots */}
              {FIXED_MEDITATION_HOURS.map((hour) => {
                const slot = daySchedule[hour.id];
                const person = slot?.person?.trim();
                const verse = slot?.verse?.trim();

                return (
                  <div
                    key={hour.id}
                    style={{
                      padding: "10px 10px",
                      borderLeft: `1px solid ${tableBorderColor}`,
                      minHeight: 64,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 4,
                    }}
                  >
                    {person ? (
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: textColor,
                          lineHeight: 1.25,
                        }}
                      >
                        {person}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: textMuted,
                          fontStyle: "italic",
                        }}
                      >
                        —
                      </div>
                    )}

                    {verse && (
                      <div
                        style={{
                          background: verseBg,
                          border: `1px solid ${verseBorder}`,
                          color: verseColor,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: "0.2px",
                          display: "inline-block",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {verse}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── FOOTER : EXHORTATION SCRIPTURE & SIGNATURE ── */}
      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: `2px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            maxWidth: 650,
            fontSize: 13,
            fontStyle: "italic",
            color: textMuted,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {plan.exhortation ||
            "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105"}
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 11.5,
            color: goldHeading,
            fontWeight: 800,
            letterSpacing: "0.5px",
          }}
        >
          <div>FAMILLE DE NOÉ</div>
          <div style={{ color: textMuted, fontWeight: 600, fontSize: 10.5, marginTop: 2 }}>
            Temps de méditations communautaires
          </div>
        </div>
      </div>
    </div>
  );
}
