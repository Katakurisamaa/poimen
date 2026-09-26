"use client";

import React from "react";
import Image from "next/image";
import {
  MeditationPlan,
  FIXED_MEDITATION_HOURS,
  MEDITATION_DAYS,
} from "@/types/meditation";
import {
  Sunrise,
  Sun,
  Sunset,
  Moon,
  BookOpen,
  Calendar,
  Sparkles,
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

  // Palette tokens based on theme
  const bg = isDark
    ? "linear-gradient(145deg, #05020c 0%, #0d0722 45%, #05020c 100%)"
    : "linear-gradient(145deg, #ffffff 0%, #fbf9f4 50%, #f4f0e6 100%)";

  const borderColor = isDark ? "rgba(212, 175, 55, 0.35)" : "rgba(180, 140, 50, 0.4)";
  const innerCardBg = isDark ? "rgba(20, 12, 45, 0.65)" : "rgba(255, 255, 255, 0.85)";
  const innerCardBorder = isDark ? "rgba(212, 175, 55, 0.2)" : "rgba(200, 160, 60, 0.3)";
  const textColor = isDark ? "#F8F5EE" : "#1A1528";
  const textMuted = isDark ? "#B8B1C8" : "#5A5468";
  const goldPrimary = isDark ? "#E6CA65" : "#996515";
  const goldLight = isDark ? "#FDF3D0" : "#7A4F0B";
  const slotHeaderBg = isDark
    ? "linear-gradient(135deg, rgba(212, 175, 55, 0.22) 0%, rgba(139, 92, 246, 0.18) 100%)"
    : "linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)";
  const verseBg = isDark
    ? "rgba(56, 189, 248, 0.12)"
    : "rgba(14, 116, 144, 0.08)";
  const verseBorder = isDark
    ? "rgba(56, 189, 248, 0.3)"
    : "rgba(14, 116, 144, 0.25)";
  const verseColor = isDark ? "#7DD3FC" : "#0E7490";

  const hourIcons = [
    <Sunrise key="0" size={17} style={{ color: isDark ? "#FBBF24" : "#D97706" }} />,
    <Sun key="1" size={17} style={{ color: isDark ? "#FDE047" : "#CA8A04" }} />,
    <Sunset key="2" size={17} style={{ color: isDark ? "#FB923C" : "#EA580C" }} />,
    <Moon key="3" size={17} style={{ color: isDark ? "#A78BFA" : "#7C3AED" }} />,
  ];

  return (
    <div
      id={id}
      style={{
        width: 960,
        maxWidth: "100%",
        margin: "0 auto",
        background: bg,
        borderRadius: 24,
        border: `2px solid ${borderColor}`,
        boxShadow: isDark
          ? "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(212, 175, 55, 0.15)"
          : "0 20px 50px rgba(0, 0, 0, 0.1), 0 0 30px rgba(212, 175, 55, 0.1)",
        padding: "36px 36px 32px",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        color: textColor,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Celestial Glow in background */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 500,
          height: 300,
          background: isDark
            ? "radial-gradient(circle, rgba(212, 175, 55, 0.18) 0%, rgba(139, 92, 246, 0.08) 45%, transparent 70%)"
            : "radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, transparent 65%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* ── TOP HEADER WITH LOGO & TITLE ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1.5px solid ${borderColor}`,
          paddingBottom: 24,
          marginBottom: 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Official Famille de Noé Emblem Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              position: "relative",
              width: 105,
              height: 105,
              borderRadius: "50%",
              overflow: "hidden",
              border: `2.5px solid ${goldPrimary}`,
              boxShadow: isDark
                ? "0 0 20px rgba(212, 175, 55, 0.4), 0 8px 16px rgba(0,0,0,0.6)"
                : "0 4px 14px rgba(180, 140, 50, 0.25)",
              flexShrink: 0,
              background: "#050614",
            }}
          >
            <Image
              src="/brand/famille-de-noe.png"
              alt="Logo Famille de Noé"
              width={105}
              height={105}
              style={{ objectFit: "cover" }}
              priority
              unoptimized
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: goldPrimary,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Impact Centre Chrétien • Famille de Noé
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "0.5px",
                lineHeight: 1.15,
                color: goldLight,
                textShadow: isDark ? "0 2px 8px rgba(0,0,0,0.8)" : "none",
              }}
            >
              PLANNING HEBDOMADAIRE DE MÉDITATION
            </h1>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: textMuted,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>BÂTIR</span>
              <span>•</span>
              <span>SAUVER</span>
              <span>•</span>
              <span>PEUPLER</span>
            </div>
          </div>
        </div>

        {/* Weekly Badges Box (Week + Book) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Week Label Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 30,
              background: slotHeaderBg,
              border: `1.5px solid ${goldPrimary}`,
              color: goldLight,
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <Calendar size={16} style={{ color: goldPrimary }} />
            <span>{plan.week_label || "Semaine en cours"}</span>
          </div>

          {/* Book / Theme Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 30,
              background: innerCardBg,
              border: `1px solid ${innerCardBorder}`,
              color: textColor,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <BookOpen size={15} style={{ color: goldPrimary }} />
            <span>{plan.livre_theme || "Méditation de la Parole"}</span>
          </div>

          {plan.verset_cle && (
            <div
              style={{
                fontSize: 11,
                color: textMuted,
                fontWeight: 500,
                fontStyle: "italic",
              }}
            >
              Verset clé : <span style={{ color: goldPrimary, fontWeight: 700 }}>{plan.verset_cle}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SCHEDULE GRID TABLE ── */}
      <div
        style={{
          borderRadius: 18,
          border: `1.5px solid ${innerCardBorder}`,
          background: innerCardBg,
          overflow: "hidden",
          boxShadow: isDark
            ? "0 10px 30px rgba(0, 0, 0, 0.5)"
            : "0 8px 24px rgba(0, 0, 0, 0.05)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Table Header: Hours */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px repeat(4, 1fr)",
            background: slotHeaderBg,
            borderBottom: `1.5px solid ${innerCardBorder}`,
            padding: "12px 10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: goldPrimary,
              paddingLeft: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={14} />
            <span>JOURS</span>
          </div>

          {FIXED_MEDITATION_HOURS.map((hour, idx) => (
            <div
              key={hour.id}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                borderLeft: idx > 0 ? `1px solid ${innerCardBorder}` : undefined,
                padding: "2px 6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {hourIcons[idx]}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: goldLight,
                    letterSpacing: "0.5px",
                  }}
                >
                  {hour.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: textMuted,
                  fontWeight: 600,
                }}
              >
                {hour.name}
              </span>
            </div>
          ))}
        </div>

        {/* Table Body: Days */}
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
                    ? `1px solid ${innerCardBorder}`
                    : "none",
                background: isEven
                  ? isDark
                    ? "rgba(255, 255, 255, 0.015)"
                    : "rgba(0, 0, 0, 0.015)"
                  : "transparent",
                minHeight: 64,
                alignItems: "center",
              }}
            >
              {/* Day Cell */}
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    background: isDark ? "rgba(212, 175, 55, 0.15)" : "rgba(212, 175, 55, 0.12)",
                    border: `1px solid ${goldPrimary}`,
                    color: goldLight,
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    width: "100%",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {day.label}
                </div>
              </div>

              {/* 4 Hour Slots */}
              {FIXED_MEDITATION_HOURS.map((hour, hIdx) => {
                const slot = daySchedule[hour.id];
                const person = slot?.person?.trim();
                const verse = slot?.verse?.trim();

                return (
                  <div
                    key={hour.id}
                    style={{
                      padding: "10px 10px",
                      borderLeft: `1px solid ${innerCardBorder}`,
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
                          fontSize: 13.5,
                          fontWeight: 700,
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
                          opacity: 0.6,
                        }}
                      >
                        — Non assigné —
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
                          fontSize: 11.5,
                          fontWeight: 700,
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

      {/* ── CARD FOOTER WITH EXHORTATION & SIGNATURE ── */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: `1.5px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: 680,
            fontSize: 12.5,
            fontStyle: "italic",
            color: textMuted,
            lineHeight: 1.4,
          }}
        >
          {plan.exhortation ||
            "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105"}
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 11,
            color: goldPrimary,
            fontWeight: 700,
            letterSpacing: "0.5px",
          }}
        >
          <div>COMMUNAUTÉ DE DISCIPLES</div>
          <div style={{ color: textMuted, fontWeight: 500, fontSize: 10, marginTop: 2 }}>
            Partagé avec amour dans la Famille de Noé 🕊️
          </div>
        </div>
      </div>
    </div>
  );
}
