"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, User, UserX, Check } from "lucide-react";
import styles from "./Meditation.module.css";

export interface FamilyMemberItem {
  id: string;
  name: string;
  status?: string;
  civility?: string;
}

interface MemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
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
      m.name.toLowerCase().includes(q) ||
      (m.status && m.status.toLowerCase().includes(q))
    );
  });

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return (name.slice(0, 2) || "MD").toUpperCase();
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
            <span className={styles.modalEyebrow}>Famille de Noé • Méditation</span>
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
              placeholder="Rechercher un membre par nom ou prénom…"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Member List */}
        <div className={styles.modalList}>
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => {
              const isSelected =
                currentName.trim().toLowerCase() ===
                member.name.trim().toLowerCase();

              return (
                <div
                  key={member.id}
                  className={styles.memberItem}
                  onClick={() => {
                    onSelect(member.name);
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
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <div className={styles.memberItemName}>{member.name}</div>
                      {member.status && (
                        <div className={styles.memberItemStatus}>
                          {member.status}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelected && (
                      <Check
                        size={16}
                        style={{ color: "var(--gold, #D4AF37)" }}
                      />
                    )}
                    {member.status && (
                      <span className={styles.memberRoleBadge}>
                        {member.status}
                      </span>
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
                    Utiliser « {search.trim()} »
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
