"use client";

import React from "react";
import { MeditationPlan, FIXED_MEDITATION_HOURS, MEDITATION_DAYS } from "@/types/meditation";
import { FAMILLE_NOE_LOGO_BASE64 } from "@/lib/famille-noe-logo-base64";
import { Sunrise, Sun, Sunset, Moon, BookOpen } from "lucide-react";

interface MeditationPosterProps {
  plan: MeditationPlan;
  id?: string;
  themeStyle?: "obsidian" | "parchment";
}

const hourIcons = [Sunrise, Sun, Sunset, Moon];

export default function MeditationPoster({
  plan,
  id = "meditation-poster-container",
  themeStyle = "obsidian",
}: MeditationPosterProps) {
  const isDark = themeStyle === "obsidian";

  // Palette tuned to match the two reference designs exactly
  const colors = isDark
    ? {
        headerBg: "#07192A",
        headerTitle: "#FFFFFF",
        headerSubtitle: "#AEC0CB",
        headerGold: "#E3C784",
        headerBorder: "#C9AC6B",
        
        bodyBg: "#07192A",
        livreTitle: "#FFFFFF",
        versetLabel: "#AEC0CB",
        versetBold: "#E3C784",
        thJour: "#AEC0CB",
        hourLabel: "#E3C784",
        hourTime: "#FFFFFF",
        
        rowBg: "#0D263B",
        rowBorder: "rgba(255, 255, 255, 0.08)",
        rowAccent: "#E3C784",
        rowDay: "#FFFFFF",
        rowPerson: "#FFFFFF",
        rowVerse: "#E3C784",
        goldAccent: "#E3C784",
        mutedText: "#AEC0CB",
        
        divider: "#284154",
        footerQuote: "#F5F1E8",
        footerSubtext: "#AEC0CB",
      }
    : {
        headerBg: "#081D30",
        headerTitle: "#F5F1E8",
        headerSubtitle: "#AEC0CB",
        headerGold: "#E3C784",
        headerBorder: "#C9AC6B",
        
        bodyBg: "#FAF7F0",
        livreTitle: "#102B42",
        versetLabel: "#5C6E79",
        versetBold: "#806022",
        thJour: "#5C6E79",
        hourLabel: "#806022",
        hourTime: "#102B42",
        
        rowBg: "#FFFFFF",
        rowBorder: "#E2DED3",
        rowAccent: "#C9AC6B",
        rowDay: "#102B42",
        rowPerson: "#102B42",
        rowVerse: "#806022",
        goldAccent: "#806022",
        mutedText: "#5C6E79",
        
        divider: "#E2DED3",
        footerQuote: "#102B42",
        footerSubtext: "#5C6E79",
      };

  return (
    <article
      id={id}
      data-poster-theme={themeStyle}
      aria-label={`Planning de méditation — ${plan.week_label}`}
      style={{
        width: 1000,
        flexShrink: 0,
        margin: "0 auto",
        backgroundColor: colors.bodyBg,
        background: colors.bodyBg,
        color: colors.livreTitle,
        fontFamily: isDark
          ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          : "Georgia, 'Times New Roman', serif",
        boxSizing: "border-box",
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${colors.divider}`,
        boxShadow: isDark
          ? "0 18px 48px rgba(0, 0, 0, 0.45)"
          : "0 18px 48px rgba(0, 0, 0, 0.12)",
      }}
    >
      {/* ── HEADER (Identical deep navy background in both styles) ── */}
      <header
        data-element="poster-header"
        style={{
          padding: "30px 38px 32px",
          backgroundColor: colors.headerBg,
          background: colors.headerBg,
          color: colors.headerTitle,
          borderBottom: `3px solid ${colors.headerBorder}`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo with base64 embedded so export to image/pdf always preserves it */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FAMILLE_NOE_LOGO_BASE64}
            alt="Famille de Noé"
            width={78}
            height={78}
            style={{
              display: "block",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              data-element="header-brand-name"
              style={{
                fontSize: 21,
                fontWeight: 600,
                letterSpacing: "0.3px",
                color: "#F5F1E8",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              Famille de Noé
            </div>
            <div
              data-element="header-brand-slogan"
              style={{
                marginTop: 6,
                fontSize: 10,
                letterSpacing: "2.5px",
                color: colors.headerGold,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontWeight: 600,
              }}
            >
              BÂTIR · SAUVER · PEUPLER
            </div>
          </div>
          <div
            data-element="header-subtext"
            style={{
              marginLeft: "auto",
              textAlign: "right",
              color: colors.headerSubtitle,
              fontSize: 11,
              letterSpacing: "1.5px",
              lineHeight: 1.8,
              textTransform: "uppercase",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Impact Centre Chrétien<br />Planning hebdomadaire
          </div>
        </div>

        <div style={{ marginTop: 28, display: "flex", alignItems: "flex-end", gap: 28 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              role="heading"
              aria-level={1}
              data-element="header-title"
              style={{
                fontFamily: isDark
                  ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  : "Georgia, 'Times New Roman', serif",
                fontSize: 49,
                fontWeight: isDark ? 700 : 400,
                lineHeight: 1.1,
                letterSpacing: isDark ? "-1px" : "-1.5px",
                margin: 0,
                color: colors.headerTitle,
              }}
            >
              Un temps dans la Parole
            </div>
            <p
              data-element="header-subtitle"
              style={{
                margin: "12px 0 0",
                color: colors.headerSubtitle,
                fontSize: 14,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              Notre rendez-vous de méditation en famille
            </p>
          </div>

          <div
            style={{
              width: 220,
              flexShrink: 0,
              paddingLeft: 22,
              borderLeft: "1px solid #3A4B5A",
            }}
          >
            <div
              data-element="header-kicker"
              style={{
                fontSize: 10,
                color: colors.headerGold,
                letterSpacing: "2px",
                marginBottom: 8,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontWeight: 600,
              }}
            >
              CETTE SEMAINE
            </div>
            <div
              data-element="header-week-label"
              style={{
                fontSize: 17,
                lineHeight: 1.5,
                fontWeight: 600,
                color: "#F5F1E8",
                overflowWrap: "anywhere",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {plan.week_label || "Semaine en cours"}
            </div>
          </div>
        </div>
      </header>

      {/* ── LOWER SECTION (Parchment cream in Claire, Midnight navy in Sombre) ── */}
      <div
        data-element="poster-body"
        style={{
          padding: "26px 32px 24px",
          backgroundColor: colors.bodyBg,
          background: colors.bodyBg,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BookOpen size={24} color={isDark ? colors.headerGold : colors.goldAccent} style={{ flexShrink: 0 }} />
            <div
              role="heading"
              aria-level={2}
              data-element="livre-title"
              style={{
                margin: 0,
                fontFamily: isDark
                  ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  : "Georgia, 'Times New Roman', serif",
                fontSize: 27,
                fontWeight: isDark ? 700 : 400,
                color: colors.livreTitle,
                overflowWrap: "anywhere",
              }}
            >
              {plan.livre_theme || "Livre de Jean"}
            </div>
          </div>

          {plan.verset_cle && (
            <div
              data-element="verset-cle"
              style={{
                maxWidth: "40%",
                fontSize: 13,
                color: colors.versetLabel,
                textAlign: "right",
                overflowWrap: "anywhere",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              Verset clé{" "}
              <strong
                data-element="verset-cle-bold"
                style={{ color: colors.versetBold, marginLeft: 7 }}
              >
                {plan.verset_cle}
              </strong>
            </div>
          )}
        </div>

        <table
          aria-label="Répartition des méditations du lundi au vendredi"
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "separate",
            borderSpacing: "0 8px",
          }}
        >
          <colgroup>
            <col style={{ width: 120 }} />
            {FIXED_MEDITATION_HOURS.map((hour) => (
              <col key={hour.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                data-element="th-jour"
                style={{
                  textAlign: "left",
                  padding: "0 16px 14px",
                  color: colors.thJour,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "1.8px",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                JOUR
              </th>
              {FIXED_MEDITATION_HOURS.map((hour, index) => {
                const Icon = hourIcons[index];
                return (
                  <th
                    key={hour.id}
                    scope="col"
                    style={{ padding: "0 10px 14px", textAlign: "center" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 7,
                        color: colors.hourLabel,
                        marginBottom: 7,
                      }}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      <span
                        data-element="hour-label"
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "1.5px",
                          color: colors.hourLabel,
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        {hour.name}
                      </span>
                    </div>
                    <div
                      data-element="hour-time"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: colors.hourTime,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      }}
                    >
                      {hour.label}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {MEDITATION_DAYS.map((day) => (
              <tr key={day.id} style={{ background: colors.rowBg }}>
                <th
                  scope="row"
                  data-element="row-day"
                  style={{
                    padding: "21px 16px",
                    textAlign: "left",
                    borderRadius: "8px 0 0 8px",
                    borderLeft: `3px solid ${colors.rowAccent}`,
                    borderTop: `1px solid ${colors.rowBorder}`,
                    borderBottom: `1px solid ${colors.rowBorder}`,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.rowDay,
                    backgroundColor: colors.rowBg,
                    background: colors.rowBg,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {day.label}
                </th>
                {FIXED_MEDITATION_HOURS.map((hour, index) => {
                  const slot = plan.schedule[day.id]?.[hour.id];
                  const person = slot?.person?.trim();
                  const verse = slot?.verse?.trim();
                  const isLastCol = index === 3;
                  return (
                    <td
                      key={hour.id}
                      style={{
                        padding: "20px 12px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        borderRadius: isLastCol ? "0 8px 8px 0" : undefined,
                        borderTop: `1px solid ${colors.rowBorder}`,
                        borderBottom: `1px solid ${colors.rowBorder}`,
                        borderRight: isLastCol ? `1px solid ${colors.rowBorder}` : undefined,
                        backgroundColor: colors.rowBg,
                        background: colors.rowBg,
                        overflowWrap: "anywhere",
                      }}
                    >
                      <div
                        data-element="person-name"
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          lineHeight: 1.35,
                          color: person ? colors.rowPerson : colors.mutedText,
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        {person || "À attribuer"}
                      </div>
                      <div
                        data-element="verse-text"
                        style={{
                          marginTop: 7,
                          fontSize: 14,
                          lineHeight: 1.4,
                          color: colors.rowVerse,
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        {verse || "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <footer
          style={{
            marginTop: 24,
            paddingTop: 22,
            borderTop: `1px solid ${colors.divider}`,
          }}
        >
          <p
            data-element="footer-quote"
            style={{
              margin: "0 auto",
              maxWidth: 780,
              textAlign: "center",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 18,
              lineHeight: 1.6,
              fontStyle: "italic",
              color: colors.footerQuote,
              overflowWrap: "anywhere",
            }}
          >
            {plan.exhortation ||
              "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105"}
          </p>
          <div
            data-element="footer-subtext"
            style={{
              textAlign: "center",
              marginTop: 18,
              color: colors.footerSubtext,
              fontSize: 9,
              letterSpacing: "2.3px",
              textTransform: "uppercase",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Une famille · Une même foi · Un même rendez-vous
          </div>
        </footer>
      </div>
    </article>
  );
}
