"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  User, Check, X, Plus, Sparkles, MapPin, 
  ChevronRight, Edit2, RotateCcw, AlertCircle
} from "lucide-react";
import { 
  PositionnementPlanData, 
  SeatAssignment, 
  COMMON_ROLES, 
  getSeatLocation 
} from "@/types/positionnement-integration";
import styles from "./Positionnement.module.css";

interface InteractiveSanctuaryMapProps {
  planData: PositionnementPlanData;
  activeSeatId?: string | null;
  onSelectSeat?: (seatId: string) => void;
  onQuickAssign?: (seatId: string, memberName: string, role?: string) => void;
  availableMembers: string[];
}

export default function InteractiveSanctuaryMap({
  planData,
  activeSeatId,
  onSelectSeat,
  onQuickAssign,
  availableMembers = []
}: InteractiveSanctuaryMapProps) {
  const [popoverSeatId, setPopoverSeatId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Map seats by seatId
  const seatMap = new Map<string, SeatAssignment>();
  (planData.seats || []).forEach(s => {
    seatMap.set(s.seatId, s);
  });

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverSeatId(null);
      }
    }
    if (popoverSeatId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverSeatId]);

  // Statistics
  const totalBaseSeats = 11;
  const assignedCount = (planData.seats || []).filter(s => !s.seatId.endsWith("'") && s.member && s.member.trim() !== "").length;
  const missingCount = totalBaseSeats - assignedCount;

  const handleSeatClick = (seatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectSeat) onSelectSeat(seatId);
    setPopoverSeatId(seatId === popoverSeatId ? null : seatId);
  };

  const currentPopoverSeat = popoverSeatId ? seatMap.get(popoverSeatId) : null;
  const currentPopoverLoc = popoverSeatId ? getSeatLocation(popoverSeatId) : null;

  // Render individual seat button
  const renderSeatButton = (seatId: string) => {
    const assignment = seatMap.get(seatId);
    const obsAssignment = seatMap.get(`${seatId}'`);
    const memberName = assignment?.member?.trim();
    const obsName = obsAssignment?.member?.trim();
    const isAssigned = Boolean(memberName);
    const isObs = assignment?.isObservation || false;
    const isCurrentActive = activeSeatId === seatId || popoverSeatId === seatId;
    const loc = getSeatLocation(seatId);

    return (
      <div key={seatId} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={(e) => handleSeatClick(seatId, e)}
          className={`${styles.interactiveSeatBtn} ${isCurrentActive ? styles.interactiveSeatBtnActive : ""} ${isAssigned ? styles.interactiveSeatBtnAssigned : styles.interactiveSeatBtnVacant} ${isObs ? styles.interactiveSeatBtnObs : ""}`}
          title={`${seatId} : ${loc.label}${memberName ? ` — ${memberName}` : " (Vacant - Cliquez pour affecter)"}`}
          aria-label={`${seatId} ${loc.shortDesc}`}
        >
          <div className={styles.interactiveSeatHeader}>
            <span className={styles.interactiveSeatCode}>{seatId}</span>
            {isAssigned ? (
              <span className={styles.interactiveSeatStatusDot} style={{ background: "#10b981" }} />
            ) : (
              <span className={styles.interactiveSeatStatusDot} style={{ background: "#f59e0b" }} />
            )}
          </div>

          <div className={styles.interactiveSeatName}>
            {memberName ? (
              <strong>{memberName}</strong>
            ) : (
              <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 9.5 }}>+ Libre</span>
            )}
          </div>

          {obsName && (
            <div className={styles.interactiveSeatObsBadge}>
              +{obsName} (obs)
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.interactiveMapCard}>
      {/* ── MAP HEADER & LEGEND ── */}
      <div className={styles.interactiveMapHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className={styles.interactiveMapBadge}>
            <MapPin size={12} />
            <span>Plan du Sanctuaire en direct</span>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Cliquez sur un siège pour lui attribuer un conseiller
          </span>
        </div>

        {/* Counter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={styles.statPill} style={{ backgroundColor: assignedCount === totalBaseSeats ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: assignedCount === totalBaseSeats ? "var(--green)" : "var(--gold)" }}>
            <strong>{assignedCount}/{totalBaseSeats}</strong> pourvus
          </span>
          {missingCount > 0 && (
            <span className={styles.statPill} style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
              <strong>{missingCount}</strong> à pourvoir
            </span>
          )}
        </div>
      </div>

      {/* ── THE SANCTUARY STAGE & SEATING BLOCKS ── */}
      <div className={styles.sanctuaryGridContainer}>
        {/* Row Identifiers Header */}
        <div className={styles.rowLabelsHeader}>
          <div style={{ width: 90 }} />
          <div className={styles.rowLabelCell}>RANGÉE A (Gauche)</div>
          <div className={styles.rowLabelCell}>RANGÉE B (Centre)</div>
          <div className={styles.rowLabelCell}>RANGÉE C (Droite)</div>
        </div>

        {/* ESTRADE (Stage at top) */}
        <div className={styles.estradeBar}>
          <span>ESTRADE / CHAIRE DU CULTE</span>
        </div>

        {/* MAIN BODY: [COULOIR] + [SEATING ROWS A, B, C] */}
        <div className={styles.sanctuaryMainArea}>
          {/* Left Couloir & Exits */}
          <div className={styles.couloirColumn}>
            <div className={styles.polyBadge}>Poly 1</div>
            <div className={styles.sortieBadge}>Sortie 1</div>
            
            <div className={styles.couloirLabelBlock}>
              <span style={{ fontSize: 11, color: "var(--sky)" }}>▲</span>
              <span className={styles.verticalCouloirText}>COULOIR</span>
              <span style={{ fontSize: 11, color: "var(--sky)" }}>▼</span>
            </div>

            <div className={styles.sortieBadge}>Sortie 2</div>
          </div>

          {/* Seating Grid (Rows A, B, C & Rear) */}
          <div className={styles.rowsGridArea}>
            {/* FRONT STAGE SECTION */}
            <div className={styles.frontRowsGrid}>
              {/* RANGÉE A (C1, C2) */}
              <div className={styles.rowBlock}>
                <div className={styles.rowBlockTag}>Rangée A</div>
                <div className={styles.seatsPairVertical}>
                  {renderSeatButton("C1")}
                  <span className={styles.rowDirectionArrow}>▼</span>
                  {renderSeatButton("C2")}
                </div>
              </div>

              {/* RANGÉE B (C3, C4) */}
              <div className={styles.rowBlock}>
                <div className={styles.rowBlockTag}>Rangée B</div>
                <div className={styles.seatsPairVertical}>
                  {renderSeatButton("C3")}
                  <span className={styles.rowDirectionArrow}>▼</span>
                  {renderSeatButton("C4")}
                </div>
              </div>

              {/* RANGÉE C (C5, C7, C6, C8) */}
              <div className={styles.rowBlock} style={{ flex: 1.3 }}>
                <div className={styles.rowBlockTag}>Rangée C (Quadruple)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    {renderSeatButton("C5")}
                    {renderSeatButton("C7")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-around", color: "var(--sky)", fontSize: 10 }}>
                    <span>▼</span>
                    <span>▼</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    {renderSeatButton("C6")}
                    {renderSeatButton("C8")}
                  </div>
                </div>
              </div>
            </div>

            {/* REAR SECTION (C9, C10, C11) */}
            <div className={styles.rearSectionCard}>
              <div className={styles.rearSectionHeader}>
                <span>FOND DE SALLE & CONSEILLERS MOBILES</span>
              </div>
              <div className={styles.rearSeatsRow}>
                <div className={styles.rearSeatCol}>
                  <span className={styles.rearSubLabel}>Côté Gauche</span>
                  {renderSeatButton("C9")}
                </div>
                <div className={styles.rearSeatCol}>
                  <span className={styles.rearSubLabel}>Centre / Allée</span>
                  {renderSeatButton("C10")}
                </div>
                <div className={styles.rearSeatCol}>
                  <span className={styles.rearSubLabel}>Côté Droit</span>
                  {renderSeatButton("C11")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ASSIGN POPOVER (WHEN A SEAT IS CLICKED) ── */}
      {popoverSeatId && currentPopoverLoc && (
        <div ref={popoverRef} className={styles.quickAssignPopover}>
          <div className={styles.popoverHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={styles.popoverBadge}>{popoverSeatId}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)" }}>
                  {currentPopoverLoc.label}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                  Rôle : {currentPopoverSeat?.role || "Accueil"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPopoverSeatId(null)}
              className={styles.popoverCloseBtn}
              title="Fermer"
            >
              <X size={13} />
            </button>
          </div>

          <div className={styles.popoverBody}>
            {/* Quick action: Clear seat */}
            {currentPopoverSeat?.member && (
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--foreground)" }}>
                  Actuellement : <strong>{currentPopoverSeat.member}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onQuickAssign) onQuickAssign(popoverSeatId, "", currentPopoverSeat.role);
                    setPopoverSeatId(null);
                  }}
                  className={styles.popoverClearBtn}
                >
                  <RotateCcw size={11} /> Libérer ce siège
                </button>
              </div>
            )}

            {/* Counselors Chips */}
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Sélectionner un conseiller :
            </div>
            <div className={styles.popoverMembersGrid}>
              {availableMembers.map((name, idx) => {
                const isCurrent = currentPopoverSeat?.member?.toUpperCase() === name.toUpperCase();
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (onQuickAssign) onQuickAssign(popoverSeatId, isCurrent ? "" : name, currentPopoverSeat?.role);
                      setPopoverSeatId(null);
                    }}
                    className={`${styles.popoverMemberBtn} ${isCurrent ? styles.popoverMemberBtnActive : ""}`}
                  >
                    {isCurrent && <Check size={11} />}
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick role change */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Changer le rôle :
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {COMMON_ROLES.map((r, ri) => (
                  <button
                    key={ri}
                    type="button"
                    onClick={() => {
                      if (onQuickAssign) onQuickAssign(popoverSeatId, currentPopoverSeat?.member || "", r);
                    }}
                    className={`${styles.popoverRoleBtn} ${currentPopoverSeat?.role === r ? styles.popoverRoleBtnActive : ""}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Jump to full card */}
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => {
                  if (onSelectSeat) onSelectSeat(popoverSeatId);
                  setPopoverSeatId(null);
                }}
                className={styles.popoverJumpBtn}
              >
                <span>Aller à la fiche détaillée</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
