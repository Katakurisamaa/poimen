"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";
import styles from "./CustomSelect.module.css";

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  icon,
  searchable,
  disabled = false,
  className,
  style,
  ariaLabel,
  size = "md",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile viewport for bottom sheet rendering
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate dropdown positioning relative to trigger
  const updatePosition = () => {
    if (wrapperRef.current && !isMobile) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const minW = Math.max(rect.width, size === "sm" ? 170 : 220);
      let left = rect.left;
      if (left + minW > window.innerWidth - 12) {
        left = window.innerWidth - minW - 12;
      }
      setDropdownPos({
        top: rect.bottom + 6,
        left: Math.max(12, left),
        width: minW,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, isMobile]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    // CRITICAL: NEVER auto-focus searchInputRef on open so the on-screen keyboard
    // is never triggered unintentionally on mobile devices.

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Find active option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Should show search input? (only if explicitly set or if list is large >= 8)
  const shouldShowSearch = searchable !== undefined ? searchable : options.length >= 8;

  // Filtered options based on query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={`${styles.wrapper} ${className || ""}`} style={style} ref={wrapperRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${styles.trigger} ${size === "sm" ? styles.triggerSm : ""} ${open ? styles.triggerActive : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
      >
        <div className={styles.triggerContent}>
          {icon && <span className={styles.triggerIcon}>{icon}</span>}
          <span className={`${styles.triggerText} ${!selectedOption ? styles.placeholder : ""}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={size === "sm" ? 12 : 16} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>

      {/* Popover / Mobile Sheet rendered via Portal to prevent any parent overflow clipping */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* Backdrop for mobile */}
          {isMobile && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

          <div
            ref={dropdownRef}
            className={`${styles.dropdown} ${isMobile ? styles.dropdownMobile : ""}`}
            style={!isMobile ? {
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999,
            } : { zIndex: 99999 }}
            role="listbox"
          >
            {isMobile && <div className={styles.dragHandle} />}

            {/* Search Input */}
            {shouldShowSearch && (
              <div className={styles.searchHeader}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className={styles.clearSearch}
                    aria-label="Effacer la recherche"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            {/* List of Options */}
            <div className={styles.optionsList}>
              {filteredOptions.length === 0 ? (
                <div className={styles.noResults}>Aucun résultat</div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`${styles.optionItem} ${isSelected ? styles.optionItemActive : ""}`}
                    >
                      <div className={styles.optionContent}>
                        <span className={styles.optionLabel}>{opt.label}</span>
                        {opt.sublabel && (
                          <span className={styles.optionSublabel}>{opt.sublabel}</span>
                        )}
                      </div>
                      {opt.badge && <span className={styles.optionBadge}>{opt.badge}</span>}
                      {isSelected && <Check size={16} className={styles.checkIcon} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
