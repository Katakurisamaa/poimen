"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, Check, Globe } from "lucide-react";

export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  // --- Fréquents & Europe de l'Ouest ---
  { name: "Belgique", code: "BE", flag: "🇧🇪" },
  { name: "France", code: "FR", flag: "🇫🇷" },
  { name: "Luxembourg", code: "LU", flag: "🇱🇺" },
  { name: "Suisse", code: "CH", flag: "🇨🇭" },
  { name: "RD Congo", code: "CD", flag: "🇨🇩" },
  { name: "Cameroun", code: "CM", flag: "🇨🇲" },
  { name: "Côte d'Ivoire", code: "CI", flag: "🇨🇮" },
  { name: "Congo (Brazzaville)", code: "CG", flag: "🇨🇬" },
  { name: "Gabon", code: "GA", flag: "🇬🇦" },
  { name: "Sénégal", code: "SN", flag: "🇸🇳" },
  { name: "Togo", code: "TG", flag: "🇹🇬" },
  { name: "Bénin", code: "BJ", flag: "🇧🇯" },
  { name: "Guinée", code: "GN", flag: "🇬🇳" },
  { name: "Mali", code: "ML", flag: "🇲🇱" },
  { name: "Burkina Faso", code: "BF", flag: "🇧🇫" },
  { name: "Rwanda", code: "RW", flag: "🇷🇼" },
  { name: "Burundi", code: "BI", flag: "🇧🇮" },
  { name: "Centrafrique", code: "CF", flag: "🇨🇫" },
  { name: "Tchad", code: "TD", flag: "🇹🇩" },
  { name: "Madagascar", code: "MG", flag: "🇲🇬" },
  { name: "Haïti", code: "HT", flag: "🇭🇹" },
  { name: "Canada", code: "CA", flag: "🇨🇦" },

  // --- Tous les pays du monde (ordre alphabétique complet) ---
  { name: "Afghanistan", code: "AF", flag: "🇦🇫" },
  { name: "Afrique du Sud", code: "ZA", flag: "🇿🇦" },
  { name: "Albanie", code: "AL", flag: "🇦🇱" },
  { name: "Algérie", code: "DZ", flag: "🇩🇿" },
  { name: "Allemagne", code: "DE", flag: "🇩🇪" },
  { name: "Andorre", code: "AD", flag: "🇦🇩" },
  { name: "Angola", code: "AO", flag: "🇦🇴" },
  { name: "Antigua-et-Barbuda", code: "AG", flag: "🇦🇬" },
  { name: "Arabie Saoudite", code: "SA", flag: "🇸🇦" },
  { name: "Argentine", code: "AR", flag: "🇦🇷" },
  { name: "Arménie", code: "AM", flag: "🇦🇲" },
  { name: "Australie", code: "AU", flag: "🇦🇺" },
  { name: "Autriche", code: "AT", flag: "🇦🇹" },
  { name: "Azerbaïdjan", code: "AZ", flag: "🇦🇿" },
  { name: "Bahamas", code: "BS", flag: "🇧🇸" },
  { name: "Bahreïn", code: "BH", flag: "🇧🇭" },
  { name: "Bangladesh", code: "BD", flag: "🇧🇩" },
  { name: "Barbade", code: "BB", flag: "🇧🇧" },
  { name: "Belize", code: "BZ", flag: "🇧🇿" },
  { name: "Bhoutan", code: "BT", flag: "🇧🇹" },
  { name: "Biélorussie", code: "BY", flag: "🇧🇾" },
  { name: "Birmanie (Myanmar)", code: "MM", flag: "🇲🇲" },
  { name: "Bolivie", code: "BO", flag: "🇧🇴" },
  { name: "Bosnie-Herzégovine", code: "BA", flag: "🇧🇦" },
  { name: "Botswana", code: "BW", flag: "🇧🇼" },
  { name: "Brésil", code: "BR", flag: "🇧🇷" },
  { name: "Brunei", code: "BN", flag: "🇧🇳" },
  { name: "Bulgarie", code: "BG", flag: "🇧🇬" },
  { name: "Cap-Vert", code: "CV", flag: "🇨🇻" },
  { name: "Chili", code: "CL", flag: "🇨🇱" },
  { name: "Chine", code: "CN", flag: "🇨🇳" },
  { name: "Chypre", code: "CY", flag: "🇨🇾" },
  { name: "Colombie", code: "CO", flag: "🇨🇴" },
  { name: "Comores", code: "KM", flag: "🇰🇲" },
  { name: "Corée du Nord", code: "KP", flag: "🇰🇵" },
  { name: "Corée du Sud", code: "KR", flag: "🇰🇷" },
  { name: "Costa Rica", code: "CR", flag: "🇨🇷" },
  { name: "Croatie", code: "HR", flag: "🇭🇷" },
  { name: "Cuba", code: "CU", flag: "🇨🇺" },
  { name: "Danemark", code: "DK", flag: "🇩🇰" },
  { name: "Djibouti", code: "DJ", flag: "🇩🇯" },
  { name: "Dominique", code: "DM", flag: "🇩🇲" },
  { name: "Égypte", code: "EG", flag: "🇪🇬" },
  { name: "Émirats Arabes Unis", code: "AE", flag: "🇦🇪" },
  { name: "Équateur", code: "EC", flag: "🇪🇨" },
  { name: "Érythrée", code: "ER", flag: "🇪🇷" },
  { name: "Espagne", code: "ES", flag: "🇪🇸" },
  { name: "Estonie", code: "EE", flag: "🇪🇪" },
  { name: "Eswatini (Swaziland)", code: "SZ", flag: "🇸🇿" },
  { name: "États-Unis", code: "US", flag: "🇺🇸" },
  { name: "Éthiopie", code: "ET", flag: "🇪🇹" },
  { name: "Fidji", code: "FJ", flag: "🇫🇯" },
  { name: "Finlande", code: "FI", flag: "🇫🇮" },
  { name: "Gambie", code: "GM", flag: "🇬🇲" },
  { name: "Géorgie", code: "GE", flag: "🇬🇪" },
  { name: "Ghana", code: "GH", flag: "🇬🇭" },
  { name: "Grèce", code: "GR", flag: "🇬🇷" },
  { name: "Grenade", code: "GD", flag: "🇬🇩" },
  { name: "Guatemala", code: "GT", flag: "🇬🇹" },
  { name: "Guinée équatoriale", code: "GQ", flag: "🇬🇶" },
  { name: "Guinée-Bissau", code: "GW", flag: "🇬🇼" },
  { name: "Guyana", code: "GY", flag: "🇬🇾" },
  { name: "Honduras", code: "HN", flag: "🇭🇳" },
  { name: "Hongrie", code: "HU", flag: "🇭🇺" },
  { name: "Inde", code: "IN", flag: "🇮🇳" },
  { name: "Indonésie", code: "ID", flag: "🇮🇩" },
  { name: "Irak", code: "IQ", flag: "🇮🇶" },
  { name: "Iran", code: "IR", flag: "🇮🇷" },
  { name: "Irlande", code: "IE", flag: "🇮🇪" },
  { name: "Islande", code: "IS", flag: "🇮🇸" },
  { name: "Israël", code: "IL", flag: "🇮🇱" },
  { name: "Italie", code: "IT", flag: "🇮🇹" },
  { name: "Jamaïque", code: "JM", flag: "🇯🇲" },
  { name: "Japon", code: "JP", flag: "🇯🇵" },
  { name: "Jordanie", code: "JO", flag: "🇯🇴" },
  { name: "Kazakhstan", code: "KZ", flag: "🇰🇿" },
  { name: "Kenya", code: "KE", flag: "🇰🇪" },
  { name: "Kirghizistan", code: "KG", flag: "🇰🇬" },
  { name: "Kiribati", code: "KI", flag: "🇰🇮" },
  { name: "Koweït", code: "KW", flag: "🇰🇼" },
  { name: "Laos", code: "LA", flag: "🇱🇦" },
  { name: "Lesotho", code: "LS", flag: "🇱🇸" },
  { name: "Lettonie", code: "LV", flag: "🇱🇻" },
  { name: "Liban", code: "LB", flag: "🇱🇧" },
  { name: "Liberia", code: "LR", flag: "🇱🇷" },
  { name: "Libye", code: "LY", flag: "🇱🇾" },
  { name: "Liechtenstein", code: "LI", flag: "🇱🇮" },
  { name: "Lituanie", code: "LT", flag: "🇱🇹" },
  { name: "Macédoine du Nord", code: "MK", flag: "🇲🇰" },
  { name: "Malaisie", code: "MY", flag: "🇲🇾" },
  { name: "Malawi", code: "MW", flag: "🇲🇼" },
  { name: "Maldives", code: "MV", flag: "🇲🇻" },
  { name: "Malte", code: "MT", flag: "🇲🇹" },
  { name: "Maroc", code: "MA", flag: "🇲🇦" },
  { name: "Maurice", code: "MU", flag: "🇲🇺" },
  { name: "Mauritanie", code: "MR", flag: "🇲🇷" },
  { name: "Mexique", code: "MX", flag: "🇲🇽" },
  { name: "Micronésie", code: "FM", flag: "🇫🇲" },
  { name: "Moldavie", code: "MD", flag: "🇲🇩" },
  { name: "Monaco", code: "MC", flag: "🇲🇨" },
  { name: "Mongolie", code: "MN", flag: "🇲🇳" },
  { name: "Monténégro", code: "ME", flag: "🇲🇪" },
  { name: "Mozambique", code: "MZ", flag: "🇲🇿" },
  { name: "Namibie", code: "NA", flag: "🇳🇦" },
  { name: "Nauru", code: "NR", flag: "🇳🇷" },
  { name: "Népal", code: "NP", flag: "🇳🇵" },
  { name: "Nicaragua", code: "NI", flag: "🇳🇮" },
  { name: "Niger", code: "NE", flag: "🇳🇪" },
  { name: "Nigeria", code: "NG", flag: "🇳🇬" },
  { name: "Norvège", code: "NO", flag: "🇳🇴" },
  { name: "Nouvelle-Zélande", code: "NZ", flag: "🇳🇿" },
  { name: "Oman", code: "OM", flag: "🇴🇲" },
  { name: "Ouganda", code: "UG", flag: "🇺🇬" },
  { name: "Ouzbékistan", code: "UZ", flag: "🇺🇿" },
  { name: "Pakistan", code: "PK", flag: "🇵🇰" },
  { name: "Palaos", code: "PW", flag: "🇵🇼" },
  { name: "Palestine", code: "PS", flag: "🇵🇸" },
  { name: "Panama", code: "PA", flag: "🇵🇦" },
  { name: "Papouasie-Nouvelle-Guinée", code: "PG", flag: "🇵🇬" },
  { name: "Paraguay", code: "PY", flag: "🇵🇾" },
  { name: "Pays-Bas", code: "NL", flag: "🇳🇱" },
  { name: "Pérou", code: "PE", flag: "🇵🇪" },
  { name: "Philippines", code: "PH", flag: "🇵🇭" },
  { name: "Pologne", code: "PL", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", flag: "🇵🇹" },
  { name: "Qatar", code: "QA", flag: "🇶🇦" },
  { name: "République Dominicaine", code: "DO", flag: "🇩🇴" },
  { name: "République Tchèque", code: "CZ", flag: "🇨🇿" },
  { name: "Roumanie", code: "RO", flag: "🇷🇴" },
  { name: "Royaume-Uni", code: "GB", flag: "🇬🇧" },
  { name: "Russie", code: "RU", flag: "🇷🇺" },
  { name: "Saint-Christophe-et-Niévès", code: "KN", flag: "🇰🇳" },
  { name: "Saint-Marin", code: "SM", flag: "🇸🇲" },
  { name: "Saint-Vincent-et-les-Grenadines", code: "VC", flag: "🇻🇨" },
  { name: "Sainte-Lucie", code: "LC", flag: "🇱🇨" },
  { name: "Salomon", code: "SB", flag: "🇸🇧" },
  { name: "Salvador", code: "SV", flag: "🇸🇻" },
  { name: "Samoa", code: "WS", flag: "🇼🇸" },
  { name: "Sao Tomé-et-Principe", code: "ST", flag: "🇸🇹" },
  { name: "Serbie", code: "RS", flag: "🇷🇸" },
  { name: "Seychelles", code: "SC", flag: "🇸🇨" },
  { name: "Sierra Leone", code: "SL", flag: "🇸🇱" },
  { name: "Singapour", code: "SG", flag: "🇸🇬" },
  { name: "Slovaquie", code: "SK", flag: "🇸🇰" },
  { name: "Slovénie", code: "SI", flag: "🇸🇮" },
  { name: "Somalie", code: "SO", flag: "🇸🇴" },
  { name: "Soudan", code: "SD", flag: "🇸🇩" },
  { name: "Soudan du Sud", code: "SS", flag: "🇸🇸" },
  { name: "Sri Lanka", code: "LK", flag: "🇱🇰" },
  { name: "Suède", code: "SE", flag: "🇸🇪" },
  { name: "Suriname", code: "SR", flag: "🇸🇷" },
  { name: "Syrie", code: "SY", flag: "🇸🇾" },
  { name: "Tadjikistan", code: "TJ", flag: "🇹🇯" },
  { name: "Taïwan", code: "TW", flag: "🇹🇼" },
  { name: "Tanzanie", code: "TZ", flag: "🇹🇿" },
  { name: "Timor oriental", code: "TL", flag: "🇹🇱" },
  { name: "Tonga", code: "TO", flag: "🇹🇴" },
  { name: "Trinité-et-Tobago", code: "TT", flag: "🇹🇹" },
  { name: "Tunisie", code: "TN", flag: "🇹🇳" },
  { name: "Turkménistan", code: "TM", flag: "🇹🇲" },
  { name: "Turquie", code: "TR", flag: "🇹🇷" },
  { name: "Tuvalu", code: "TV", flag: "🇹🇻" },
  { name: "Ukraine", code: "UA", flag: "🇺🇦" },
  { name: "Uruguay", code: "UY", flag: "🇺🇾" },
  { name: "Vanuatu", code: "VU", flag: "🇻🇺" },
  { name: "Vatican", code: "VA", flag: "🇻🇦" },
  { name: "Venezuela", code: "VE", flag: "🇻🇪" },
  { name: "Vietnam", code: "VN", flag: "🇻🇳" },
  { name: "Yémen", code: "YE", flag: "🇾🇪" },
  { name: "Zambie", code: "ZM", flag: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", flag: "🇿🇼" },

  // --- Territoires d'Outre-mer & Communautés francophones fréquentes ---
  { name: "Guadeloupe", code: "GP", flag: "🇬🇵" },
  { name: "Martinique", code: "MQ", flag: "🇲🇶" },
  { name: "Guyane Française", code: "GF", flag: "🇬🇫" },
  { name: "La Réunion", code: "RE", flag: "🇷🇪" },
  { name: "Mayotte", code: "YT", flag: "🇾🇹" },
  { name: "Polynésie française", code: "PF", flag: "🇵🇫" },
  { name: "Nouvelle-Calédonie", code: "NC", flag: "🇳🇨" },

  { name: "Autre pays", code: "XX", flag: "🌍" }
];

// Liste dédupliquée et triée pour la recherche complète
const ALL_UNIQUE_COUNTRIES: Country[] = Array.from(
  new Map(COUNTRIES.map(c => [c.name.toLowerCase(), c])).values()
).sort((a, b) => {
  if (a.name === "Autre pays") return 1;
  if (b.name === "Autre pays") return -1;
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
});

// Suggestions rapides (pays les plus fréquents en église locale)
const FREQUENT_NAMES = [
  "Belgique",
  "France",
  "Luxembourg",
  "Suisse",
  "RD Congo",
  "Cameroun",
  "Côte d'Ivoire",
  "Congo (Brazzaville)",
  "Gabon",
  "Sénégal",
  "Togo",
  "Bénin",
  "Rwanda",
  "Burundi",
  "Haïti",
  "Canada"
];

interface CountryPickerModalProps {
  value: string;
  onChange: (country: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CountryPickerModal({
  value,
  onChange,
  isOpen,
  onClose,
}: CountryPickerModalProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSearch("");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const frequentList = useMemo(() => {
    return FREQUENT_NAMES.map(name => ALL_UNIQUE_COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase())!).filter(Boolean);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_UNIQUE_COUNTRIES;
    return ALL_UNIQUE_COUNTRIES.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isOpen || typeof window === "undefined") return null;

  return createPortal(
    <div 
      className="modal-overlay fade-in" 
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div 
        className="custom-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          background: "var(--bg-surface, #14171f)",
          border: "1px solid rgba(212, 175, 55, 0.35)",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--cream, #fff)"
        }}
      >
        {/* Mobile Drag Handle */}
        <div style={{
          width: 44,
          height: 5,
          borderRadius: 999,
          background: "var(--muted, #8b949e)",
          opacity: 0.35,
          margin: "12px auto 0",
        }} />

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(212, 175, 55, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold, #d4af37)" }}>
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--gold-light, #f3e5ab)" }}>
                Pays de résidence
              </h3>
              <p style={{ fontSize: 11, color: "var(--muted, #94a3b8)", margin: "2px 0 0" }}>
                {ALL_UNIQUE_COUNTRIES.length} pays et territoires disponibles
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ color: "var(--muted, #94a3b8)", padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: "14px 20px 12px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "10px 14px",
            background: "color-mix(in srgb, var(--cream, #fff) 4%, var(--bg-deep, #0f131a))",
            border: "1px solid var(--ux-line, rgba(212, 175, 55, 0.25))",
            borderRadius: 14,
            boxSizing: "border-box",
            transition: "all 0.2s ease"
          }}>
            <Search size={16} style={{ color: "var(--gold, #d4af37)", flexShrink: 0, opacity: 0.9 }} />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un pays (ex: Canada, France, Gabon...)"
              autoFocus
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                boxShadow: "none",
                padding: 0,
                margin: 0,
                color: "var(--cream, #fff)",
                fontFamily: "inherit",
                fontSize: 14,
                width: "100%",
                lineHeight: 1.5
              }}
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch("")}
                style={{
                  background: "color-mix(in srgb, var(--cream, #fff) 8%, transparent)",
                  border: "none",
                  color: "var(--muted, #94a3b8)",
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                aria-label="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions rapides si pas de recherche */}
        {!search && (
          <div style={{ padding: "0 20px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              Fréquemment choisis
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 100, overflowY: "auto" }}>
              {frequentList.map(c => {
                const isSelected = value?.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={`freq-${c.code}`}
                    type="button"
                    onClick={() => {
                      onChange(c.name);
                      onClose();
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      background: isSelected ? "var(--gold-glow, rgba(212, 175, 55, 0.25))" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isSelected ? "var(--gold)" : "rgba(255,255,255,0.1)"}`,
                      color: isSelected ? "var(--gold-light, #f3e5ab)" : "var(--cream, #fff)",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
          {filteredCountries.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--muted)" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>Aucun pays répertorié sous "{search}"</p>
              <button 
                type="button" 
                className="btn btn-outline"
                style={{ fontSize: 12, padding: "8px 16px", margin: "0 auto", borderColor: "var(--gold)", color: "var(--gold-light)" }}
                onClick={() => {
                  onChange(search.trim());
                  onClose();
                }}
              >
                Utiliser "{search}" comme pays de résidence
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", padding: "6px 10px 4px" }}>
                {search ? `Résultats (${filteredCountries.length})` : "Tous les pays (A-Z)"}
              </div>
              {filteredCountries.map(c => {
                const isSelected = value?.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.code + c.name}
                    type="button"
                    onClick={() => {
                      onChange(c.name);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: isSelected ? "rgba(212, 175, 55, 0.15)" : "transparent",
                      border: isSelected ? "1px solid rgba(212, 175, 55, 0.35)" : "1px solid transparent",
                      color: isSelected ? "var(--gold-light, #f3e5ab)" : "var(--cream, #fff)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s"
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{c.flag}</span>
                      <span style={{ fontSize: 13.5, fontWeight: isSelected ? 600 : 400 }}>{c.name}</span>
                    </div>
                    {isSelected && (
                      <Check size={16} style={{ color: "var(--gold)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .custom-modal {
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            border-bottom: none !important;
            max-height: 85vh !important;
            animation: slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
        }
        @keyframes slideUpModal {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
