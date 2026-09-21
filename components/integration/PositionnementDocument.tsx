"use client";

import React from "react";
import { PositionnementPlanData, SeatAssignment } from "@/types/positionnement-integration";
import IccLogo from "@/components/reporting/IccLogo";

interface PositionnementDocumentProps {
  data: PositionnementPlanData;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  logoUrl?: string;
}

export default function PositionnementDocument({
  data,
  containerRef,
  logoUrl
}: PositionnementDocumentProps) {
  // Format French Date (e.g. "2026-09-20" -> "20/09/2026")
  const formatFrenchDate = (dateStr: string) => {
    if (!dateStr) return "20/09/2026";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatFrenchDate(data.date_culte);

  // Map seats by seatId for easy lookup
  const seatMap = new Map<string, SeatAssignment>();
  (data.seats || []).forEach(s => {
    seatMap.set(s.seatId, s);
  });

  // Helper to render seat badge on the map
  const renderMapSeat = (seatId: string, labelOverride?: string) => {
    const assignment = seatMap.get(seatId);
    const obsAssignment = seatMap.get(`${seatId}'`);
    const memberName = assignment?.member?.trim();
    const obsMemberName = obsAssignment?.member?.trim();
    const isObs = assignment?.isObservation || false;

    return (
      <div
        data-seat-box="true"
        data-seat-box-obs={isObs ? "true" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isObs ? "#fef08a" : "#ffffff",
          border: `1.5px solid ${isObs ? "#ca8a04" : "#0f172a"}`,
          borderRadius: "6px",
          padding: "3px 8px",
          minWidth: 54,
          minHeight: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        <div data-seat-code="true" style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5 }}>
          {labelOverride || seatId}
        </div>
        {memberName && (
          <div
            data-seat-name="true"
            data-seat-name-obs={isObs ? "true" : undefined}
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: isObs ? "#854d0e" : "#0f172a",
              whiteSpace: "nowrap",
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 1,
            }}
          >
            {memberName}
          </div>
        )}
        {obsMemberName && (
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              backgroundColor: "#fef08a",
              color: "#854d0e",
              borderRadius: "3px",
              padding: "0 3px",
              marginTop: 1,
              whiteSpace: "nowrap",
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            + {obsMemberName} (obs)
          </div>
        )}
      </div>
    );
  };

  // Group seats for the 2-columns text list
  const activeSeats = (data.seats || []).filter(s => (s.member && s.member.trim() !== "") || (s.role && s.role.trim() !== ""));
  const midPoint = Math.ceil(activeSeats.length / 2);
  const leftColSeats = activeSeats.slice(0, midPoint);
  const rightColSeats = activeSeats.slice(midPoint);

  return (
    <div
      ref={containerRef as any}
      id="positionnement-integration-print-container"
      className="positionnement-print-document"
      style={{
        width: 1120,
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        padding: "24px 30px 22px",
        margin: "0 auto",
        boxSizing: "border-box",
        position: "relative",
        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        borderRadius: "4px",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 14,
          borderBottom: "2px solid #0f172a",
          marginBottom: 16,
          backgroundColor: "#ffffff",
        }}
      >
        {/* Left: ICC Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IccLogo customLogoUrl={logoUrl} width={110} height={50} lightMode={true} />
          <div style={{ width: 1.5, height: 40, backgroundColor: "#cbd5e1" }} />
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase" }}>
              IMPACT CENTRE CHRÉTIEN • {data.church_name || "ÉGLISE LOCALE"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5, textTransform: "uppercase" }}>
              SERVICE DU CULTE
            </div>
          </div>
        </div>

        {/* Center: Title */}
        <div style={{ textAlign: "center" }}>
          <div
            data-document-title="true"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: 1.2,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            PLAN DE POSITIONNEMENT
          </div>
          <div
            data-document-subtitle="true"
            style={{ fontSize: 11, fontWeight: 600, color: "#b45309", letterSpacing: 0.5, marginTop: 2 }}
          >
            SERVICE DU DIMANCHE {formattedDate}
          </div>
        </div>

        {/* Right: Clean motto badge */}
        <div
          style={{
            border: "1.5px solid #d97706",
            borderRadius: "6px",
            backgroundColor: "#fffbeb",
            color: "#92400e",
            padding: "6px 14px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#b45309" }}>
            CONSEILLERS EN SERVICE
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 500, color: "#78350f", marginTop: 1 }}>
            Accueillir • Orienter • Accompagner
          </div>
        </div>
      </div>

      {/* ── ROLES LIST (2 COLUMNS) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 24,
          rowGap: 4,
          fontSize: 11.5,
          marginBottom: 14,
          padding: "10px 14px",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {leftColSeats.map((seat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 900, color: "#1e3a8a", minWidth: 26 }}>
                {seat.seatId}
              </span>
              <span style={{ fontStyle: "italic", color: "#334155" }}>
                ({seat.role || "Accueil"}) :
              </span>
              {seat.isObservation ? (
                <span
                  style={{
                    backgroundColor: "#fef08a",
                    color: "#854d0e",
                    fontWeight: 900,
                    padding: "0 5px",
                    borderRadius: "3px",
                    border: "1px solid #facc15",
                  }}
                >
                  {seat.member} {seat.mentorName ? `(en obs avec ${seat.mentorName})` : "(en observation)"}
                </span>
              ) : (
                <span style={{ fontWeight: 800, color: "#0f172a" }}>
                  {seat.member || "/"}
                </span>
              )}
            </div>
          ))}
          {leftColSeats.length === 0 && (
            <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>Aucune affectation</span>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {rightColSeats.map((seat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 900, color: "#1e3a8a", minWidth: 26 }}>
                {seat.seatId}
              </span>
              <span style={{ fontStyle: "italic", color: "#334155" }}>
                ({seat.role || "Accueil"}) :
              </span>
              {seat.isObservation ? (
                <span
                  style={{
                    backgroundColor: "#fef08a",
                    color: "#854d0e",
                    fontWeight: 900,
                    padding: "0 5px",
                    borderRadius: "3px",
                    border: "1px solid #facc15",
                  }}
                >
                  {seat.member} {seat.mentorName ? `(en obs avec ${seat.mentorName})` : "(en observation)"}
                </span>
              ) : (
                <span style={{ fontWeight: 800, color: "#0f172a" }}>
                  {seat.member || "/"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── RED CLEANING NOTICE ── */}
      <div
        style={{
          color: "#dc2626",
          fontSize: 11,
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 16,
          padding: "4px 10px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "4px",
        }}
      >
        {data.cleaning_notice || "ATTENTION : TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE"}
      </div>

      {/* ── SANCTUARY SEATING MAP (HIGH FIDELITY VECTOR & CSS) ── */}
      <div
        style={{
          border: "2px solid #334155",
          borderRadius: "8px",
          padding: "16px 20px 14px",
          backgroundColor: "#fafbfc",
          position: "relative",
          marginBottom: 14,
        }}
      >
        {/* Row Labels Above Stage */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "150px 1fr 1fr 1fr",
            textAlign: "center",
            fontSize: 11.5,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#1e293b",
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          <div>{/* Empty space for Couloir */}</div>
          <div>RANGÉE A</div>
          <div>RANGÉE B</div>
          <div>RANGÉE C</div>
        </div>

        {/* ESTRADE (Center top) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div
            style={{
              width: 320,
              padding: "6px 0",
              border: "2px solid #0f172a",
              backgroundColor: "#f1f5f9",
              borderRadius: "4px",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 3,
              color: "#0f172a",
              textTransform: "uppercase",
            }}
          >
            ESTRADE
          </div>
        </div>

        {/* MAIN SANCTUARY GRID: [COULOIR / EXITS] + [RANGEES A, B, C] */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}>
          
          {/* ── LEFT AISLE: Poly 1, Sortie 1, Sortie 2, Couloir ── */}
          <div
            style={{
              border: "2px solid #d97706",
              borderRadius: "8px",
              backgroundColor: "#fffbeb",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            {/* Poly 1 */}
            <div
              style={{
                border: "1.5px solid #b45309",
                borderRadius: "4px",
                backgroundColor: "#ffffff",
                padding: "4px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#b45309",
                marginBottom: 6,
              }}
            >
              Poly 1
            </div>

            {/* Sortie 1 */}
            <div
              style={{
                border: "1.5px solid #475569",
                borderRadius: "4px",
                backgroundColor: "#ffffff",
                padding: "4px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#334155",
                marginBottom: 12,
              }}
            >
              Sortie 1
            </div>

            {/* Couloir Label & Arrows */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 0",
              }}
            >
              <span style={{ fontSize: 13, color: "#2563eb" }}>▲</span>
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 3,
                  color: "#1e3a8a",
                }}
              >
                COULOIR
              </span>
              <span style={{ fontSize: 13, color: "#2563eb" }}>▼</span>
            </div>

            {/* Sortie 2 */}
            <div
              style={{
                border: "1.5px solid #475569",
                borderRadius: "4px",
                backgroundColor: "#ffffff",
                padding: "4px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#334155",
                marginTop: 12,
              }}
            >
              Sortie 2
            </div>
          </div>

          {/* ── RIGHT MAIN SEATING BLOCKS (RANGEES A, B, C & REAR) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {/* Front Stage Rows (Rangées A, B, C) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.35fr", gap: 16 }}>
              
              {/* RANGÉE A */}
              <div
                style={{
                  border: "2px dashed #475569",
                  borderRadius: "10px",
                  padding: "12px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 140,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  {renderMapSeat("C1")}
                </div>
                <div style={{ display: "flex", justifyContent: "center", color: "#2563eb", fontSize: 12 }}>
                  ▼
                </div>
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  {renderMapSeat("C2")}
                </div>
              </div>

              {/* RANGÉE B */}
              <div
                style={{
                  border: "2px dashed #475569",
                  borderRadius: "10px",
                  padding: "12px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 140,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  {renderMapSeat("C3")}
                </div>
                <div style={{ display: "flex", justifyContent: "center", color: "#2563eb", fontSize: 12 }}>
                  ▼
                </div>
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  {renderMapSeat("C4")}
                </div>
              </div>

              {/* RANGÉE C (Double row C5/C7 and C6/C8) */}
              <div
                style={{
                  border: "2px dashed #475569",
                  borderRadius: "10px",
                  padding: "12px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 140,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {renderMapSeat("C5")}
                  {renderMapSeat("C7")}
                </div>
                <div style={{ display: "flex", justifyContent: "space-around", color: "#2563eb", fontSize: 12 }}>
                  <span>▼</span>
                  <span>▼</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {renderMapSeat("C6")}
                  {renderMapSeat("C8")}
                </div>
              </div>

            </div>

            {/* Rear Rows (C9, C10, C11) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.35fr", gap: 16 }}>
              {/* C9 */}
              <div
                style={{
                  border: "2px dashed #64748b",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {renderMapSeat("C9")}
              </div>

              {/* C10 */}
              <div
                style={{
                  border: "2px dashed #64748b",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {renderMapSeat("C10")}
              </div>

              {/* C11 */}
              <div
                style={{
                  border: "2px dashed #64748b",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {renderMapSeat("C11")}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── FOOTER METADATA ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11.5,
          fontWeight: 700,
          color: "#334155",
          paddingTop: 8,
          borderTop: "1.5px solid #e2e8f0",
        }}
      >
        <div>
          Organisation du service du <strong>{formattedDate}</strong>
        </div>
        <div>
          Coordination générale : <strong style={{ color: "#0f172a", textTransform: "uppercase" }}>{data.coordination_generale || "Non spécifié"}</strong>
        </div>
      </div>
    </div>
  );
}
