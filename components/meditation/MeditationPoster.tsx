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
  const dark = themeStyle === "obsidian";
  const colors = {
    background: dark ? "#0B2135" : "#FAF7F0",
    row: dark ? "#102B42" : "#FFFFFF",
    text: dark ? "#F5F1E8" : "#102B42",
    muted: dark ? "#AEC0CB" : "#5C6E79",
    gold: dark ? "#E3C784" : "#806022",
    line: dark ? "#284154" : "#E2DED3",
  };

  return (
    <article id={id} aria-label={`Planning de méditation — ${plan.week_label}`}
      style={{ width: 1000, flexShrink: 0, margin: "0 auto", background: colors.background,
        color: colors.text, fontFamily: "'Segoe UI', Arial, sans-serif", boxSizing: "border-box",
        borderRadius: 16, overflow: "hidden", border: `1px solid ${colors.line}` }}>
      <header style={{ padding: "30px 38px 32px", background: "#081D30", color: "#F5F1E8",
        borderBottom: "3px solid #C9AC6B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Embedded image keeps the logo available in the exported PNG and PDF. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FAMILLE_NOE_LOGO_BASE64} alt="Famille de Noé" width={78} height={78}
            style={{ display: "block", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "0.3px" }}>Famille de Noé</div>
            <div style={{ marginTop: 6, fontSize: 10, letterSpacing: "2.5px", color: "#E3C784" }}>
              BÂTIR · SAUVER · PEUPLER
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", color: "#AEC0CB", fontSize: 11,
            letterSpacing: "1.5px", lineHeight: 1.8, textTransform: "uppercase" }}>
            Impact Centre Chrétien<br />Planning hebdomadaire
          </div>
        </div>
        <div style={{ marginTop: 28, display: "flex", alignItems: "flex-end", gap: 28 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 49,
              fontWeight: 400, lineHeight: 1.1, letterSpacing: "-1.5px", margin: 0 }}>
              Un temps dans la Parole
            </h1>
            <p style={{ margin: "12px 0 0", color: "#AEC0CB", fontSize: 14 }}>
              Notre rendez-vous de méditation en famille
            </p>
          </div>
          <div style={{ width: 220, flexShrink: 0, paddingLeft: 22, borderLeft: "1px solid #526052" }}>
            <div style={{ fontSize: 10, color: "#E3C784", letterSpacing: "2px", marginBottom: 8 }}>CETTE SEMAINE</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 600, overflowWrap: "anywhere" }}>
              {plan.week_label || "Semaine en cours"}
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: "26px 32px 24px" }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BookOpen size={24} color={colors.gold} style={{ flexShrink: 0 }} />
            <h2 style={{ margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 27,
              fontWeight: 400, overflowWrap: "anywhere" }}>{plan.livre_theme || "Méditation biblique"}</h2>
          </div>
          {plan.verset_cle && <div style={{ maxWidth: "40%", fontSize: 13, color: colors.muted, textAlign: "right", overflowWrap: "anywhere" }}>
            Verset clé <strong style={{ color: colors.gold, marginLeft: 7 }}>{plan.verset_cle}</strong>
          </div>}
        </div>

        <table aria-label="Répartition des méditations du lundi au vendredi"
          style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0 7px" }}>
          <colgroup><col style={{ width: 120 }} />{FIXED_MEDITATION_HOURS.map(hour => <col key={hour.id} />)}</colgroup>
          <thead><tr>
            <th scope="col" style={{ textAlign: "left", padding: "0 16px 14px", color: colors.muted,
              fontSize: 10, fontWeight: 500, letterSpacing: "1.8px" }}>JOUR</th>
            {FIXED_MEDITATION_HOURS.map((hour, index) => {
              const Icon = hourIcons[index];
              return <th key={hour.id} scope="col" style={{ padding: "0 10px 14px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7,
                  color: colors.gold, marginBottom: 7 }}>
                  <Icon size={16} strokeWidth={1.5} /><span style={{ fontSize: 10, fontWeight: 500,
                    textTransform: "uppercase", letterSpacing: "1.5px" }}>{hour.name}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>{hour.label}</div>
              </th>;
            })}
          </tr></thead>
          <tbody>{MEDITATION_DAYS.map((day) => <tr key={day.id} style={{ background: colors.row }}>
            <th scope="row" style={{ padding: "23px 16px", textAlign: "left", borderRadius: "8px 0 0 8px",
              borderLeft: `3px solid ${colors.gold}`, fontSize: 14, fontWeight: 600 }}>{day.label}</th>
            {FIXED_MEDITATION_HOURS.map((hour, index) => {
              const slot = plan.schedule[day.id]?.[hour.id];
              const person = slot?.person?.trim();
              const verse = slot?.verse?.trim();
              return <td key={hour.id} style={{ padding: "21px 12px", textAlign: "center", verticalAlign: "middle",
                borderRadius: index === 3 ? "0 8px 8px 0" : undefined, overflowWrap: "anywhere" }}>
                <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, color: person ? colors.text : colors.muted }}>
                  {person || "À attribuer"}
                </div>
                <div style={{ marginTop: 7, fontSize: 15, lineHeight: 1.4, color: colors.gold }}>
                  {verse || "—"}
                </div>
              </td>;
            })}
          </tr>)}</tbody>
        </table>

        <footer style={{ marginTop: 24, paddingTop: 22, borderTop: `1px solid ${colors.line}` }}>
          <p style={{ margin: "0 auto", maxWidth: 780, textAlign: "center", fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 18, lineHeight: 1.6, fontStyle: "italic", color: colors.text, overflowWrap: "anywhere" }}>
            {plan.exhortation || "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105"}
          </p>
          <div style={{ textAlign: "center", marginTop: 18, color: colors.muted, fontSize: 9,
            letterSpacing: "2.3px", textTransform: "uppercase" }}>Une famille · Une même foi · Un même rendez-vous</div>
        </footer>
      </div>
    </article>
  );
}
