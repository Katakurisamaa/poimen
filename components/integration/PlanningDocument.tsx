"use client";

import React from "react";
import { PlanningIntegrationData } from "@/types/planning-integration";
import IccLogo from "@/components/reporting/IccLogo";

interface PlanningDocumentProps {
  data: PlanningIntegrationData;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  logoUrl?: string;
}

export default function PlanningDocument({
  data,
  containerRef,
  logoUrl
}: PlanningDocumentProps) {
  // Format Month Key (e.g. "2026-09" -> "SEPTEMBRE 2026")
  const formatMonthTitle = (monthKey: string) => {
    if (!monthKey) return "SEPTEMBRE 2026";
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  };

  const monthLabel = formatMonthTitle(data.month_key);

  // Helper to highlight observation names in any text
  const renderWithObservation = (text: string, obsList: string[]) => {
    if (!text || text.trim() === "/" || text.trim() === "") {
      return <span style={{ color: "#94a3b8" }}>/</span>;
    }
    if (!obsList || obsList.length === 0) {
      return <span>{text}</span>;
    }

    // Filter valid names and sort by length descending to match longest first
    const validObs = obsList
      .map(o => o.trim())
      .filter(o => o.length > 1)
      .sort((a, b) => b.length - a.length);

    if (validObs.length === 0) {
      return <span>{text}</span>;
    }

    // Regex to split by whole names (case insensitive)
    const escaped = validObs.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(\\b(?:${escaped.join("|")})\\b)`, "gi");
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = validObs.some(obs => obs.toUpperCase() === part.trim().toUpperCase());
          if (isMatch) {
            return (
              <span
                key={i}
                style={{
                  backgroundColor: "#fef08a",
                  color: "#854d0e",
                  fontWeight: 900,
                  padding: "1px 5px",
                  borderRadius: "3px",
                  border: "1px solid #facc15",
                  display: "inline-block",
                  margin: "0 1px",
                }}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div
      ref={containerRef as any}
      id="planning-integration-print-container"
      className="planning-print-document"
      style={{
        width: 1120,
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        padding: "26px 30px 22px",
        margin: "0 auto",
        boxSizing: "border-box",
        position: "relative",
        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        borderRadius: "4px",
      }}
    >
      {/* ── TOP HEADER (CHURCH BRANDING & TITLE) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 16,
          borderBottom: "2px solid #0f172a",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <IccLogo customLogoUrl={logoUrl} width={130} height={60} lightMode={true} />
          <div style={{ width: 2, height: 50, backgroundColor: "#cbd5e1" }} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, color: "#475569", textTransform: "uppercase" }}>
              IMPACT CENTRE CHRÉTIEN • {data.church_name || "ÉGLISE LOCALE"}
            </div>
            <h1
              style={{
                fontSize: 21,
                fontWeight: 900,
                color: "#0f172a",
                margin: "2px 0 0",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              PLANNING DU SERVICE — DÉPARTEMENT INTÉGRATION
            </h1>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 1 }}>
              Accueillir • Orienter • Intégrer • Bâtir des Disciples
            </div>
          </div>
        </div>

        {/* Month Badge */}
        <div
          style={{
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: "6px",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#fbbf24", fontWeight: 700 }}>
            PÉRIODE
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.5, marginTop: 1 }}>
            {monthLabel}
          </div>
        </div>
      </div>

      {/* ── MAIN TABLE (THE 5 CORE COLUMNS) ── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 10.5,
          tableLayout: "fixed",
          marginBottom: 16,
          border: "1.5px solid #0f172a",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
            <th
              style={{
                width: "12%",
                padding: "10px 8px",
                fontWeight: 800,
                letterSpacing: 0.8,
                textAlign: "center",
                borderRight: "1px solid #334155",
                fontSize: 11,
              }}
            >
              SEMAINES
            </th>
            <th
              style={{
                width: "20%",
                padding: "10px 8px",
                fontWeight: 800,
                letterSpacing: 0.5,
                textAlign: "center",
                borderRight: "1px solid #334155",
                fontSize: 10.5,
              }}
            >
              <div>JEÛNE ET PRIÈRE (LUNDI)</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#fbbf24", marginTop: 2 }}>
                05h-06h / 18h30-19h
              </div>
            </th>
            <th
              style={{
                width: "19%",
                padding: "10px 8px",
                fontWeight: 800,
                letterSpacing: 0.5,
                textAlign: "center",
                borderRight: "1px solid #334155",
                fontSize: 10.5,
              }}
            >
              <div>PRIÈRE (SAMEDI MATIN)</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#fbbf24", marginTop: 2 }}>
                05h-06h
              </div>
            </th>
            <th
              style={{
                width: "19%",
                padding: "10px 8px",
                fontWeight: 800,
                letterSpacing: 0.5,
                textAlign: "center",
                borderRight: "1px solid #334155",
                fontSize: 10.5,
              }}
            >
              <div>PRIÈRE DES MINISTÈRES</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#fbbf24", marginTop: 2 }}>
                (DIMANCHE MATIN) 04h-05h
              </div>
            </th>
            <th
              style={{
                width: "30%",
                padding: "10px 8px",
                fontWeight: 800,
                letterSpacing: 0.8,
                textAlign: "center",
                fontSize: 11,
              }}
            >
              SERVICE DU DIMANCHE
            </th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((week, idx) => {
            const isEven = idx % 2 === 1;
            const rowBg = isEven ? "#f8fafc" : "#ffffff";
            
            // Merge global and week-specific observation members
            const obsList = Array.from(new Set([
              ...(data.globalObservationMembers || []),
              ...(week.serviceDimanche.observationMembers || []),
            ]));

            return (
              <tr
                key={week.id || idx}
                style={{
                  backgroundColor: rowBg,
                  borderBottom: "1px solid #cbd5e1",
                }}
              >
                {/* 1. SEMAINES */}
                <td
                  style={{
                    padding: "12px 8px",
                    textAlign: "center",
                    verticalAlign: "middle",
                    fontWeight: 800,
                    fontSize: 10.5,
                    borderRight: "1px solid #cbd5e1",
                    color: "#0f172a",
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    SEMAINE {idx + 1}
                  </div>
                  <div style={{ marginTop: 3, fontWeight: 800 }}>
                    {week.periode || `Semaine ${idx + 1}`}
                  </div>
                </td>

                {/* 2. JEÛNE ET PRIÈRE (LUNDI) */}
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "middle",
                    borderRight: "1px solid #cbd5e1",
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 10.5 }}>LEAD :</span>
                    <span style={{ fontWeight: 700, color: "#1e3a8a" }}>
                      {week.jeuneEtPriere.lead || <span style={{ color: "#94a3b8" }}>/</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                    <span style={{ fontWeight: 600, color: "#475569", fontSize: 10 }}>Adjoint :</span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      {week.jeuneEtPriere.adjoint || <span style={{ color: "#94a3b8" }}>/</span>}
                    </span>
                  </div>
                </td>

                {/* 3. PRIÈRE (SAMEDI MATIN) */}
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "middle",
                    borderRight: "1px solid #cbd5e1",
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 10.5 }}>LEAD :</span>
                    <span style={{ fontWeight: 700, color: "#1e3a8a" }}>
                      {week.priereSamedi.lead || <span style={{ color: "#94a3b8" }}>/</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                    <span style={{ fontWeight: 600, color: "#475569", fontSize: 10 }}>Adjoint :</span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      {week.priereSamedi.adjoint || <span style={{ color: "#94a3b8" }}>/</span>}
                    </span>
                  </div>
                </td>

                {/* 4. PRIÈRE DES MINISTÈRES (DIMANCHE MATIN) */}
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "middle",
                    borderRight: "1px solid #cbd5e1",
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    {week.priereMinisteres.participants || "Tous"}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#475569", marginTop: 2 }}>
                    <strong>Conducteur :</strong> {week.priereMinisteres.conducteur || "En Attente du PD"}
                  </div>
                  {week.priereMinisteres.sousReserve && week.priereMinisteres.sousReserve !== "/" ? (
                    <div
                      style={{
                        marginTop: 4,
                        display: "inline-block",
                        backgroundColor: "#f1f5f9",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      {week.priereMinisteres.sousReserve}
                    </div>
                  ) : (
                    <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>/(Sous réserve)</div>
                  )}
                </td>

                {/* 5. SERVICE DU DIMANCHE */}
                <td
                  style={{
                    padding: "10px 14px",
                    verticalAlign: "middle",
                    lineHeight: 1.45,
                  }}
                >
                  {/* Special Event Banner */}
                  {week.serviceDimanche.specialEvent && (
                    <div
                      style={{
                        backgroundColor: "#fef3c7",
                        border: "1px solid #f59e0b",
                        color: "#92400e",
                        fontWeight: 900,
                        textAlign: "center",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: 11,
                        letterSpacing: 0.8,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      {week.serviceDimanche.specialEvent}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                    {/* Coordination */}
                    {week.serviceDimanche.coordination && (
                      <div style={{ fontSize: 10.5 }}>
                        <span style={{ fontWeight: 800, color: "#0f172a" }}>
                          {renderWithObservation(week.serviceDimanche.coordination, obsList)}
                        </span>
                      </div>
                    )}

                    {/* Fanion + Statistiques + Accueil */}
                    {week.serviceDimanche.fanionStatsAccueil && (
                      <div style={{ fontSize: 10.5 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>
                          {renderWithObservation(week.serviceDimanche.fanionStatsAccueil, obsList)}
                        </span>
                      </div>
                    )}

                    {/* Salon Lounge / Restauration */}
                    {week.serviceDimanche.salonLoungeRestauration && (
                      <div style={{ fontSize: 10.5 }}>
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          {renderWithObservation(week.serviceDimanche.salonLoungeRestauration, obsList)}
                        </span>
                      </div>
                    )}

                    {/* Conseiller Mobile */}
                    {week.serviceDimanche.conseillerMobile && week.serviceDimanche.conseillerMobile !== "/" && (
                      <div style={{ fontSize: 10.5 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>
                          {renderWithObservation(week.serviceDimanche.conseillerMobile, obsList)}
                        </span>
                      </div>
                    )}

                    {/* Accueil */}
                    {week.serviceDimanche.accueil && week.serviceDimanche.accueil !== "/" && (
                      <div style={{ fontSize: 10.5, marginTop: 2 }}>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>
                          {renderWithObservation(week.serviceDimanche.accueil, obsList)}
                        </span>
                      </div>
                    )}

                    {/* If no assignments yet */}
                    {!week.serviceDimanche.coordination &&
                      !week.serviceDimanche.fanionStatsAccueil &&
                      !week.serviceDimanche.salonLoungeRestauration &&
                      !week.serviceDimanche.specialEvent && (
                        <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 10 }}>
                          En cours d'affectation
                        </span>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── FOOTER: DATES CLÉS & DIRECTIVES OPÉRATIONNELLES (PAGE 2 CONTENT) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
        }}
      >
        {/* Row 1: Key Dates Bar */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1.5px solid #cbd5e1",
            borderRadius: "6px",
            padding: "9px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {/* Observation Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                backgroundColor: "#fef08a",
                color: "#854d0e",
                fontWeight: 900,
                fontSize: 9.5,
                padding: "2px 8px",
                borderRadius: "3px",
                border: "1px solid #facc15",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              CONSEILLERS EN JAUNE (EN OBS)
            </span>
            <span style={{ fontSize: 9.5, color: "#64748b", fontWeight: 600 }}>
              = Période d'observation
            </span>
          </div>

          {/* Formation */}
          {data.key_dates.formationDate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
              <span style={{ fontWeight: 900, color: "#b91c1c", textTransform: "uppercase" }}>
                FORMATION :
              </span>
              <span style={{ fontWeight: 800, color: "#0f172a" }}>
                {data.key_dates.formationDate}
              </span>
            </div>
          )}

          {/* Réunion mensuelle */}
          {data.key_dates.reunionMensuelleDate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
              <span style={{ fontWeight: 900, color: "#b91c1c", textTransform: "uppercase" }}>
                RÉUNION MENSUELLE :
              </span>
              <span style={{ fontWeight: 800, color: "#0f172a" }}>
                {data.key_dates.reunionMensuelleDate}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#b91c1c", fontStyle: "italic" }}>
                {data.key_dates.reunionMensuelleDetails || "APRÈS LA PRIÈRE DE CLÔTURE (AVEC PRÉSENCE OBLIGATOIRE)"}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Operational Directives (Backup & Cleaning) */}
        <div
          style={{
            backgroundColor: "#0f172a",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "10px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 9.5,
            lineHeight: 1.4,
          }}
        >
          {data.guidelines.backupNotice && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#fbbf24", fontWeight: 900, flexShrink: 0 }}>NB :</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
                {data.guidelines.backupNotice}
              </span>
            </div>
          )}

          {data.guidelines.cleaningNotice && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#ef4444", fontWeight: 900, flexShrink: 0 }}>ATTENTION :</span>
              <span style={{ color: "#f8fafc", fontWeight: 700 }}>
                {data.guidelines.cleaningNotice}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
