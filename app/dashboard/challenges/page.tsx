"use client";

import { Plus, MessageSquare } from "lucide-react";
import type { ChallengeStatus } from "@/types";

interface C { id:string; member:string; desc:string; status:ChallengeStatus; date:string; notes:number }
const DATA:C[] = [];

const SC: Record<ChallengeStatus, { label:string; color:string; bg:string }> = {
  en_cours: { label:"En cours", color:"var(--orange)", bg:"var(--orange-glow)" },
  resolu: { label:"Résolu", color:"var(--green)", bg:"var(--green-glow)" },
  abandonne: { label:"Abandonné", color:"var(--muted)", bg:"rgba(138,133,120,0.1)" },
};

export default function ChallengesPage() {
  const cols:[ChallengeStatus, C[]][] = [
    ["en_cours", DATA.filter(c=>c.status==="en_cours")],
    ["resolu", DATA.filter(c=>c.status==="resolu")],
    ["abandonne", DATA.filter(c=>c.status==="abandonne")],
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div className="page-header">
        <div><h2 className="page-title">Challenges</h2><p style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>{DATA.filter(c=>c.status==="en_cours").length} en cours</p></div>
        <button className="btn btn-primary"><Plus size={14} /> Nouveau</button>
      </div>

      {/* Kanban — responsive: 3 cols desktop, stack on mobile */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:14 }}>
        {cols.map(([status, items]) => {
          const cfg = SC[status];
          return (
            <div key={status} className="kanban-col">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:cfg.color }} />
                <span style={{ fontSize:12, fontWeight:700, color:"var(--cream)" }}>{cfg.label}</span>
                <span style={{ fontSize:11, color:"var(--muted)", marginLeft:"auto" }}>{items.length}</span>
              </div>
              {items.map(c=>(
                <div key={c.id} className="glass glass-compact" style={{ borderLeft:`3px solid ${cfg.color}`, cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--gold-light)" }}>{c.member}</span>
                    <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, color:"var(--muted)" }}><MessageSquare size={10} />{c.notes}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--muted)", lineHeight:1.5 }}>{c.desc}</div>
                  <div style={{ fontSize:10, color:"var(--muted)", opacity:0.6, marginTop:6 }}>{c.date}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
