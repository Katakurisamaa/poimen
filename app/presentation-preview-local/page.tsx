"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Presentation = dynamic(() => import("../dashboard/bilan-integration/IntegrationPresentation"), { ssr: false });

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const MOCK_MONTHLY_DATA: Record<number, { received: number; fidelized: number; reached: number; returned: number; cdm: number }> = {
  1: { received: 18, fidelized: 3, reached: 11, returned: 4, cdm: 2 },
  2: { received: 24, fidelized: 4, reached: 15, returned: 5, cdm: 3 },
  3: { received: 17, fidelized: 2, reached: 10, returned: 3, cdm: 1 },
  4: { received: 30, fidelized: 5, reached: 19, returned: 7, cdm: 4 },
  5: { received: 21, fidelized: 6, reached: 14, returned: 5, cdm: 3 },
  6: { received: 36, fidelized: 8, reached: 23, returned: 9, cdm: 5 },
  7: { received: 23, fidelized: 2, reached: 15, returned: 4, cdm: 2 },
  8: { received: 29, fidelized: 3, reached: 18, returned: 6, cdm: 3 },
  9: { received: 26, fidelized: 4, reached: 16, returned: 5, cdm: 3 },
  10: { received: 12, fidelized: 2, reached: 8, returned: 3, cdm: 2 },
  11: { received: 0, fidelized: 0, reached: 0, returned: 0, cdm: 0 },
  12: { received: 0, fidelized: 0, reached: 0, returned: 0, cdm: 0 },
};

export default function Preview() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState("standard");
  const [selectedMonths, setSelectedMonths] = useState<number[]>([8, 9, 10]);
  const [initialMonths] = useState<number[]>([8, 9, 10]);

  const empty = scenario === "empty";

  // Calculate dynamic totals based on selected months
  const selectedAgg = selectedMonths.reduce(
    (acc, m) => {
      const data = MOCK_MONTHLY_DATA[m] || { received: 0, fidelized: 0, reached: 0, returned: 0, cdm: 0 };
      acc.received += data.received;
      acc.fidelized += data.fidelized;
      acc.reached += data.reached;
      acc.returned += data.returned;
      acc.cdm += data.cdm;
      return acc;
    },
    { received: 0, fidelized: 0, reached: 0, returned: 0, cdm: 0 }
  );

  const guestsReceived = empty ? 0 : selectedAgg.received;
  const callsReached = empty ? 0 : selectedAgg.reached;
  const guestsWithPhone = empty ? 0 : Math.round(guestsReceived * 0.85);
  const withoutLocalChurch = empty ? 0 : Math.round(guestsReceived * 0.35);
  const withLocalChurch = empty ? 0 : guestsReceived - withoutLocalChurch;
  const returnedToChurch = empty ? 0 : selectedAgg.returned;
  const integratedCdm = empty ? 0 : selectedAgg.cdm;
  const fidelized = empty ? 0 : selectedAgg.fidelized;

  const families = [
    "FAMILLE DE DAVID", "FAMILLE IT’S TIME", "FAMILLE DE NOÉ",
    "FAMILLE CHARIS", "FAMILLE GÉNÉRATION JOSUÉ", "FAMILLE DE MOÏSE",
    ...(scenario === "many" ? ["FAMILLE SUPPLÉMENTAIRE · APERÇU", "UNE FAMILLE AU NOM BEAUCOUP PLUS LONG POUR L’APERÇU"] : [])
  ].map((name, index) => ({
    name,
    count: empty ? 0 : Math.max(0, Math.round(([5, 4, 3, 2, 1, 0, 0, 0][index] || 0) * (selectedMonths.length / 3)))
  }));

  const periodLabel = empty
    ? "Période vide · Aperçu fictif"
    : selectedMonths.length === 1
      ? `${MONTH_NAMES[selectedMonths[0] - 1]} 2026`
      : selectedMonths.length === 12
        ? "Année 2026 complète"
        : `${selectedMonths.map(m => MONTH_NAMES[m - 1]).join(", ")} 2026`;

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Aperçu local · Bilan & Présentation Intégration</h1>
      <p style={{ color: "#666" }}>
        Test du filtre flottant en direct dans la présentation : touche <strong>M</strong> ou clic sur la période.
      </p>
      <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
        <select
          aria-label="Scénario"
          value={scenario}
          onChange={event => setScenario(event.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}
        >
          <option value="standard">Standard (Août, Septembre, Octobre 2026)</option>
          <option value="empty">Aucune donnée</option>
          <option value="many">Familles supplémentaires</option>
          <option value="long">Notes longues</option>
          <option value="error">Plan indisponible</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 18px",
            background: "#916719",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Lancer la présentation
        </button>
      </div>

      {open && (
        <Presentation
          periodLabel={periodLabel}
          year={2026}
          totals={{
            guestsReceived,
            guestsWithoutFamily: Math.max(0, Math.round(guestsReceived * 0.45)),
            guestsWithPhone,
            wrongNumbers: 0,
            callsReached,
            withLocalChurch,
            withoutLocalChurch,
            salvationPrayer: empty ? 0 : 1,
            integratedCdm,
            pcnc: empty ? 0 : Math.round(guestsReceived * 0.15),
            returnedToChurch,
            fidelizedWithoutLocalChurch: fidelized,
            uninitiatedCalls: empty ? 0 : Math.max(0, Math.round(guestsReceived * 0.2)),
            awaitingAssignment: empty ? 0 : Math.max(0, Math.round(guestsReceived * 0.08)),
            awaitingContact: empty ? 0 : Math.max(0, Math.round(guestsReceived * 0.12)),
            guestsWithoutNextStep: empty ? 0 : Math.max(0, Math.round(guestsReceived * 0.2)),
          }}
          families={families}
          monthlyTrend={Array.from({ length: 12 }, (_, i) => {
            const data = MOCK_MONTHLY_DATA[i + 1] || { received: 0, fidelized: 0 };
            const withoutChurch = Math.round(data.received * 0.35);
            const rate = withoutChurch > 0 && data.fidelized > 0 ? Math.min(100, Math.round((data.fidelized / withoutChurch) * 100)) : data.received > 0 ? 0 : null;
            return {
              month: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"][i],
              monthNumber: i + 1,
              received: empty ? 0 : data.received,
              fidelized: empty ? 0 : data.fidelized,
              withoutLocalChurch: empty ? 0 : withoutChurch,
              fidelityRate: empty ? null : rate,
              selected: selectedMonths.includes(i + 1),
            };
          })}
          targetTotal={empty ? null : 30 * selectedMonths.length}
          plan={{
            monthlyGuestTarget: "30",
            observation: empty ? "" : "La majorité des invités fréquente déjà une église locale. Les retours au culte confirment l’importance d’un premier contact attentif.".repeat(scenario === "long" ? 12 : 1),
            challenge: empty ? "" : "Proposer une prochaine étape adaptée à chaque personne sans église locale.",
            action: empty ? "" : "Organiser un temps d’accueil et inviter les personnes intéressées à rencontrer leur famille de disciples.",
            owner: empty ? "" : "Équipe Intégration",
            dueDate: empty ? "" : "2026-09-15",
          }}
          planLoading={false}
          planError={scenario === "error" ? "Indisponible" : undefined}
          selectedMonths={selectedMonths}
          onSelectMonths={setSelectedMonths}
          initialMonths={initialMonths}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
