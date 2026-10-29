"use client";

import { useState } from "react";
import CounselorCrWhatsAppModal from "@/components/experience/CounselorCrWhatsAppModal";
import type { GuestCrSource } from "@/lib/cr-whatsapp";

const guests: GuestCrSource[] = [
  { id: "demo-1", firstName: "Sarah", lastName: "Martin", arrivalDate: "2026-10-25", appelAbouti: true, prevuRevenir: true, estRevenuCulte: false, groupeWhatsapp: true, pcnc: false, interetCDM: true, commentaireSuivi: "Souhaite découvrir une cellule près de chez elle. À recontacter jeudi." },
  { id: "demo-2", firstName: "David", lastName: "Moreau", arrivalDate: "2026-10-25", appelAbouti: false, motifRetrait: "ne_decroche_pas", prevuRevenir: null, estRevenuCulte: false, groupeWhatsapp: false },
  { id: "demo-3", firstName: "Esther", lastName: "Laurent", arrivalDate: "2026-10-18", appelAbouti: true, prevuRevenir: true, estRevenuCulte: true, groupeWhatsapp: true, pcnc: true, integreCDM: true, familleDisciple: "Espérance" },
  { id: "demo-4", firstName: "Samuel", lastName: "Bernard", arrivalDate: "2026-10-25" },
  { id: "demo-5", firstName: "Léa", lastName: "Petit", arrivalDate: "2026-10-18", appelAbouti: true, prevuRevenir: null, estRevenuCulte: false, groupeWhatsapp: false, interetFormation: true },
];

export default function Preview() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState("individual");
  return (
    <main style={{ padding: 48, minHeight: "100dvh", background: "var(--bg)", color: "var(--cream)" }}>
      <p style={{ color: "var(--gold)", fontSize: 12, letterSpacing: 2 }}>POIMÉN · APERÇU LOCAL</p>
      <h1 style={{ margin: "16px 0", fontFamily: "var(--font-display)", fontSize: 40 }}>Un suivi, un message.</h1>
      <p style={{ maxWidth: 540, lineHeight: 1.7, marginBottom: 24 }}>Données fictives pour explorer le parcours WhatsApp. Choisis un scénario pour ouvrir la fenêtre.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {[["individual", "Depuis une fiche"], ["group", "CR groupé"], ["empty", "Liste vide"]].map(([key, label]) => (
          <button key={key} className="btn btn-outline" type="button" onClick={() => { setScenario(key); setOpen(true); }}>{label}</button>
        ))}
      </div>
      <CounselorCrWhatsAppModal isOpen={open} onClose={() => setOpen(false)} initialGuest={scenario === "individual" ? guests[0] : null} counselorGuests={scenario === "empty" ? [] : guests} />
    </main>
  );
}
