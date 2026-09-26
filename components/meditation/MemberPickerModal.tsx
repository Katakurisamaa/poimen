"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, UserX, Check } from "lucide-react";
import styles from "./Meditation.module.css";

export interface FamilyMemberItem {
  id: string;
  firstName: string;
  lastName?: string;
  status?: string;
  civility?: string;
}

interface MemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (firstName: string) => void;
  currentName?: string;
  dayLabel: string;
  hourLabel: string;
  members: FamilyMemberItem[];
}

export default function MemberPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentName = "",
  dayLabel,
  hourLabel,
  members,
}: MemberPickerModalProps) {
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.firstName.toLowerCase().includes(q) ||
      (m.lastName && m.lastName.toLowerCase().includes(q))
    );
  });

  const getInitials = (fn: string, ln?: string) => {
    const f = fn ? fn[0] : "";
    const l = ln ? ln[0] : "";
    return `${f}${l}`.toUpperCase() || "M";
  };

  const modalContent = (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modalCard} role="dialog" aria-modal="true">
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalEyebrow}>Famille de Noé • Membres</span>
            <h2 className={styles.modalTitle}>
              Choisir pour {dayLabel} ({hourLabel})
            </h2>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className={styles.modalSearchWrapper}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              className={styles.modalSearchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par prénom ou nom…"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Member List */}
        <div className={styles.modalList}>
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => {
              const cleanCurrent = currentName.trim().toLowerCase();
              const cleanFirst = member.firstName.trim().toLowerCase();
              const isSelected = cleanCurrent === cleanFirst;

              return (
                <div
                  key={member.id}
                  className={styles.memberItem}
                  onClick={() => {
                    onSelect(member.firstName);
                    onClose();
                  }}
                  style={{
                    borderColor: isSelected ? "var(--gold)" : undefined,
                    background: isSelected
                      ? "rgba(212, 175, 55, 0.15)"
                      : undefined,
                  }}
                >
                  <div className={styles.memberItemLeft}>
                    <div className={styles.memberAvatar}>
                      {getInitials(member.firstName, member.lastName)}
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                      >
                        <span className={styles.memberItemName}>
                          {member.firstName}
                        </span>
                        {member.lastName && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              fontWeight: 500,
                            }}
                          >
                            {member.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelected && (
                      <Check
                        size={16}
                        style={{ color: "var(--gold, #D4AF37)" }}
                      />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              Aucun membre trouvé pour « {search} ».
              {search.trim() && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      onSelect(search.trim());
                      onClose();
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Utiliser le prénom « {search.trim()} »
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={() => {
              onSelect("");
              onClose();
            }}
            className={styles.btnSecondary}
            style={{ fontSize: 12, color: "#EF4444" }}
          >
            <UserX size={14} />
            <span>Retirer l&apos;attribution</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={styles.btnSecondary}
            style={{ fontSize: 12 }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
