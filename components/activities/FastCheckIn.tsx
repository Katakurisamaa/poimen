"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, Search,
  ShieldCheck, UserCheck, UserRoundX, Users, X
} from "lucide-react";
import { getAttendanceStatus, QuickAttendanceStatus } from "@/lib/attendance";

export interface FastCheckInMember {
  id: string;
  firstName: string;
  lastName: string;
  civility: string;
  attendance: Record<string, Record<string, any>>;
}

interface FastCheckInProps {
  activity: { id: string; name: string };
  date: string;
  members: FastCheckInMember[];
  onClose: () => void;
  onChange: (memberId: string, status: QuickAttendanceStatus, reason?: string, service?: string) => Promise<void>;
}

const JUSTIFICATION_REASONS = ["Maladie", "Travail", "Voyage", "Famille"];

function memberLabel(member: FastCheckInMember) {
  return `${member.firstName} ${member.lastName}`.trim();
}

export default function FastCheckIn({ activity, date, members, onClose, onChange }: FastCheckInProps) {
  const [step, setStep] = useState<"checkin" | "absences" | "summary">("checkin");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"unpointed" | "present" | "absent" | "all">("unpointed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [service, setService] = useState("culte_1");
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchState = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const isCulte = activity.id === "culte" || activity.name.toLowerCase().includes("culte");

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
    const timer = window.setTimeout(() => searchRef.current?.focus(), 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, []);

  const rows = useMemo(() => members.map(member => {
    const rawVal = member.attendance?.[activity.id]?.[date];
    let serviceLabel = "";
    if (isCulte) {
      if (rawVal === "culte_1" || rawVal === true) serviceLabel = "Culte 1";
      else if (rawVal === "culte_2") serviceLabel = "Culte 2";
      else if (rawVal === "culte_en_ligne") serviceLabel = "En ligne";
    }

    return {
      member,
      status: getAttendanceStatus(member.attendance, activity.id, date),
      reason: member.attendance?._comments?.[activity.id]?.[date] || "",
      serviceLabel,
    };
  }), [members, activity.id, date, isCulte]);

  const counts = useMemo(() => rows.reduce((acc, row) => {
    acc[row.status]++;
    return acc;
  }, { unpointed: 0, present: 0, justified: 0, unjustified: 0 }), [rows]);

  const qualified = members.length - counts.unpointed;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return rows.filter(row => {
      const matchesSearch = !query || memberLabel(row.member).toLocaleLowerCase("fr").includes(query);
      if (!matchesSearch) return false;
      if (filter === "present") return row.status === "present";
      if (filter === "absent") return row.status === "justified" || row.status === "unjustified";
      if (filter === "unpointed") return row.status === "unpointed";
      return true;
    }).sort((a, b) => memberLabel(a.member).localeCompare(memberLabel(b.member), "fr", { sensitivity: "base" }));
  }, [filter, rows, search]);

  const save = async (memberId: string, status: QuickAttendanceStatus, reason = "") => {
    if (savingIds.has(memberId)) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(35); } catch {}
    }
    setSavingIds(previous => new Set(previous).add(memberId));
    setSaveError("");
    try {
      await onChange(memberId, status, reason, status === "present" && isCulte ? service : undefined);
      setEditingId(null);
      setCustomReason("");
      if (search.trim()) {
        setSearch("");
        searchRef.current?.focus();
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Le pointage n'a pas pu être enregistré.");
    } finally {
      setSavingIds(previous => {
        const next = new Set(previous);
        next.delete(memberId);
        return next;
      });
    }
  };

  const startAbsence = (memberId: string) => {
    setEditingId(memberId);
    setCustomReason("");
  };

  const handleTouchStart = (memberId: string, e: React.TouchEvent) => {
    if (editingId === memberId) return;
    touchState.current = {
      id: memberId,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
    setSwipingId(memberId);
    setSwipeOffset(0);
  };

  const handleTouchMove = (memberId: string, e: React.TouchEvent) => {
    if (!touchState.current || touchState.current.id !== memberId || editingId === memberId) return;
    const deltaX = e.touches[0].clientX - touchState.current.startX;
    const deltaY = e.touches[0].clientY - touchState.current.startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 18) return;
    const clamped = Math.max(-120, Math.min(120, deltaX));
    setSwipeOffset(clamped);
  };

  const handleTouchEnd = (memberId: string) => {
    if (touchState.current?.id === memberId && editingId !== memberId) {
      const finalOffset = swipeOffset;
      touchState.current = null;
      setSwipingId(null);
      setSwipeOffset(0);
      if (finalOffset > 60) {
        void save(memberId, "present");
      } else if (finalOffset < -60) {
        startAbsence(memberId);
      }
    }
  };

  const goToStep = (next: "checkin" | "absences" | "summary") => {
    setStep(next);
    setFilter(next === "checkin" ? "unpointed" : next === "absences" ? "unpointed" : "all");
    setSearch("");
    setEditingId(null);
  };

  return (
    <div className="fast-checkin-overlay" role="dialog" aria-modal="true" aria-labelledby="fast-checkin-title">
      <header className="fast-checkin-header">
        <button className="fast-checkin-icon-btn" type="button" onClick={onClose} aria-label="Fermer le pointage rapide">
          <ArrowLeft size={21} />
        </button>
        <div className="fast-checkin-heading">
          <span className="fast-checkin-kicker">Pointage rapide</span>
          <h1 id="fast-checkin-title">{activity.name}</h1>
          <span>{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
        <button className="fast-checkin-icon-btn" type="button" onClick={onClose} aria-label="Fermer">
          <X size={21} />
        </button>
      </header>

      <main className="fast-checkin-main">
        {saveError && <div className="fast-checkin-error" role="alert">{saveError}</div>}
        <section className="fast-checkin-progress" aria-label={`${qualified} personnes traitées sur ${members.length}`}>
          <div className="fast-checkin-progress-copy">
            <span>{qualified} / {members.length} traités</span>
            <strong>{members.length ? Math.round((qualified / members.length) * 100) : 100}%</strong>
          </div>
          <div className="fast-checkin-progress-track"><span style={{ width: `${members.length ? (qualified / members.length) * 100 : 100}%` }} /></div>
          <div className="fast-checkin-counts">
            <span><UserCheck size={15} /> {counts.present} présents</span>
            <span><ShieldCheck size={15} /> {counts.justified} justifiées</span>
            <span><UserRoundX size={15} /> {counts.unjustified} non justifiées</span>
          </div>
        </section>

        <nav className="fast-checkin-steps" aria-label="Étapes du pointage">
          <button className={step === "checkin" ? "active" : ""} onClick={() => goToStep("checkin")}><span>1</span> Présences</button>
          <button className={step === "absences" ? "active" : ""} onClick={() => goToStep("absences")}><span>2</span> Absences</button>
          <button className={step === "summary" ? "active" : ""} onClick={() => goToStep("summary")}><span>3</span> Résumé</button>
        </nav>

        {isCulte && step !== "summary" && (
          <section className="fast-checkin-service" aria-label="Culte sélectionné">
            <span>Présence enregistrée dans :</span>
            <div>
              {[{ id: "culte_1", label: "Culte 1" }, { id: "culte_2", label: "Culte 2" }, { id: "culte_en_ligne", label: "En ligne" }].map(item => (
                <button key={item.id} type="button" className={service === item.id ? "active" : ""} onClick={() => setService(item.id)}>{item.label}</button>
              ))}
            </div>
          </section>
        )}

        {step === "summary" ? (
          <section className="fast-checkin-summary">
            <CheckCircle2 size={42} />
            <h2>{counts.unpointed ? "Pointage à compléter" : "Pointage complet"}</h2>
            <p>{counts.unpointed ? `${counts.unpointed} personne${counts.unpointed > 1 ? "s restent" : " reste"} à traiter.` : "Toutes les personnes ont un statut. Les informations restent modifiables à tout moment."}</p>
            <div className="fast-checkin-summary-grid">
              <div><strong>{counts.present}</strong><span>Présents</span></div>
              <div><strong>{counts.justified}</strong><span>Absences justifiées</span></div>
              <div><strong>{counts.unjustified}</strong><span>Non justifiées</span></div>
              <div><strong>{counts.unpointed}</strong><span>Non pointés</span></div>
            </div>
            {counts.unpointed > 0 && <button className="btn btn-primary" type="button" onClick={() => goToStep("absences")}>Qualifier les absences <ChevronRight size={17} /></button>}
            <button className="btn btn-outline" type="button" onClick={onClose}>{counts.unpointed ? "Enregistrer et quitter" : "Terminer le pointage"}</button>
          </section>
        ) : (
          <>
            <div className="fast-checkin-search">
              <Search size={19} />
              <input
                ref={searchRef}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher un membre…"
                aria-label="Rechercher un membre"
              />
              {search.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  style={{
                    border: "none",
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "var(--muted)",
                    padding: 0,
                    flexShrink: 0
                  }}
                  aria-label="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="fast-checkin-filters" role="group" aria-label="Filtrer les membres">
              <button className={filter === "unpointed" ? "active" : ""} onClick={() => setFilter("unpointed")}>À traiter <span>{counts.unpointed}</span></button>
              <button className={filter === "present" ? "active" : ""} onClick={() => setFilter("present")}>Présents <span>{counts.present}</span></button>
              <button className={filter === "absent" ? "active" : ""} onClick={() => setFilter("absent")}>Absents <span>{counts.justified + counts.unjustified}</span></button>
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tous</button>
            </div>

            <p className="fast-checkin-swipe-hint">Glissez à droite pour « Présent », à gauche pour qualifier une absence.</p>

            <section className="fast-checkin-list" aria-live="polite">
              {visibleRows.map(({ member, status, reason, serviceLabel }) => {
                const editing = editingId === member.id;
                const saving = savingIds.has(member.id);
                const isSwipingThis = swipingId === member.id;
                const swipeStyle = isSwipingThis && swipeOffset !== 0 ? {
                  transform: `translateX(${swipeOffset}px)`,
                  backgroundColor: swipeOffset > 25
                    ? `rgba(22, 163, 74, ${Math.min(0.25, Math.abs(swipeOffset) / 220)})`
                    : swipeOffset < -25
                    ? `rgba(220, 38, 38, ${Math.min(0.25, Math.abs(swipeOffset) / 220)})`
                    : undefined,
                  transition: "none",
                } : {
                  transition: "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), background-color 0.22s ease",
                };

                return (
                  <article
                    key={member.id}
                    className={`fast-checkin-card status-${status}`}
                    style={swipeStyle}
                    onTouchStart={e => handleTouchStart(member.id, e)}
                    onTouchMove={e => handleTouchMove(member.id, e)}
                    onTouchEnd={() => handleTouchEnd(member.id)}
                  >
                    <div
                      className="fast-checkin-member-row"
                      onClick={() => {
                        if (status === "unpointed" && !editing && !saving) {
                          void save(member.id, "present");
                        }
                      }}
                      style={{ cursor: status === "unpointed" ? "pointer" : "default" }}
                    >
                      <div className="fast-checkin-avatar">{member.firstName[0]}{member.lastName[0]}</div>
                      <div className="fast-checkin-member-name">
                        <strong>{memberLabel(member)}</strong>
                        <span className={`fast-checkin-status status-${status}`}>
                          {status === "present"
                            ? `Présent${serviceLabel ? ` · ${serviceLabel}` : ""}`
                            : status === "justified"
                            ? `Absence justifiée${reason ? ` · ${reason}` : ""}`
                            : status === "unjustified"
                            ? "Absence non justifiée"
                            : "Non pointé (Tap pour présent)"}
                        </span>
                      </div>
                      {status !== "unpointed" && !editing && (
                        <button type="button" className="fast-checkin-edit" onClick={(e) => { e.stopPropagation(); setEditingId(member.id); }}>
                          Modifier
                        </button>
                      )}
                    </div>

                    {(status === "unpointed" || editing) && (
                      <div className="fast-checkin-card-actions">
                        <button type="button" className="fast-checkin-present" disabled={saving} onClick={() => void save(member.id, "present")}><Check size={18} /> Présent</button>
                        <button type="button" className="fast-checkin-absent" disabled={saving} onClick={() => startAbsence(member.id)}><UserRoundX size={18} /> Absence</button>
                        {editing && <button type="button" className="fast-checkin-reset" disabled={saving} onClick={() => void save(member.id, "unpointed")}>Effacer</button>}
                      </div>
                    )}

                    {editing && (
                      <div className="fast-checkin-qualification">
                        <strong>Cette absence est-elle justifiée ?</strong>
                        <button type="button" className="fast-checkin-unjustified" disabled={saving} onClick={() => void save(member.id, "unjustified")}>Non justifiée</button>
                        <span>Justifiée :</span>
                        <div className="fast-checkin-reasons">
                          {JUSTIFICATION_REASONS.map(item => <button type="button" key={item} disabled={saving} onClick={() => void save(member.id, "justified", item)}>{item}</button>)}
                        </div>
                        <div className="fast-checkin-custom-reason">
                          <input value={customReason} onChange={event => setCustomReason(event.target.value)} placeholder="Autre motif…" aria-label="Autre motif d'absence" />
                          <button type="button" disabled={!customReason.trim() || saving} onClick={() => void save(member.id, "justified", customReason.trim())}>Valider</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {visibleRows.length === 0 && (
                <div className="fast-checkin-empty">
                  <Users size={34} />
                  <strong>{search ? "Aucun membre trouvé" : filter === "unpointed" ? "Tout le monde est traité" : "Aucun membre dans cette catégorie"}</strong>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {step !== "summary" && (
        <footer className="fast-checkin-footer">
          <button type="button" className="btn btn-primary" onClick={() => goToStep(step === "checkin" ? "absences" : "summary")}>
            {step === "checkin" ? <>Qualifier les absences <ChevronRight size={18} /></> : <>Voir le résumé <Clock3 size={18} /></>}
          </button>
        </footer>
      )}
    </div>
  );
}
