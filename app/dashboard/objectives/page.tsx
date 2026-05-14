"use client";

import { Plus } from "lucide-react";
import type { ObjectiveStatus, ObjectiveCategory } from "@/types";

interface O { id:string; title:string; cat:ObjectiveCategory; cur:number; target:number; unit:string; end:string; status:ObjectiveStatus }
const DATA:O[] = [];

const CC: Record<ObjectiveCategory, { label:string; color:string }> = { evangelisation:{ label:"Évangélisation", color:"var(--green)" }, presence:{ label:"Présence", color:"var(--sky)" }, croissance:{ label:"Croissance", color:"var(--violet)" }, autre:{ label:"Autre", color:"var(--muted)" } };
const SL: Record<ObjectiveStatus, { label:string; cls:string }> = { not_started:{ label:"Non démarré", cls:"badge-sky" }, in_progress:{ label:"En cours", cls:"badge-gold" }, achieved:{ label:"Atteint", cls:"badge-green" }, not_achieved:{ label:"Non atteint", cls:"badge-red" } };

export default function ObjectivesPage() {
  const active = DATA.filter(o=>o.status==="in_progress");
  const past = DATA.filter(o=>o.status!=="in_progress");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div className="page-header">
        <div><h2 className="page-title">Objectifs</h2><p style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>Suivez la progression</p></div>
        <button className="btn btn-primary"><Plus size={14} /> Nouvel objectif</button>
      </div>

      <div className="section-header"><span className="section-title" style={{ fontSize:16 }}>En cours</span></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
        {active.map(o=>{
          const pct = Math.round((o.cur/o.target)*100);
          const cc = CC[o.cat];
          return (
            <div key={o.id} className="glass" style={{ cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--cream)", marginBottom:4 }}>{o.title}</div>
                  <span className="badge" style={{ background:`color-mix(in srgb, ${cc.color} 15%, transparent)`, color:cc.color }}>{cc.label}</span>
                </div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:800, color:cc.color }}>{pct}%</div>
              </div>
              <div className="progress progress-thick" style={{ marginBottom:8 }}><div className="progress-fill" style={{ width:`${pct}%`, background:cc.color }} /></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)" }}>
                <span>{o.cur}/{o.target} {o.unit}</span>
                <span>Échéance: {new Date(o.end).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-header"><span className="section-title" style={{ fontSize:16 }}>Historique</span></div>
      <div className="glass glass-flush">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Objectif</th><th>Catégorie</th><th className="hide-mobile">Résultat</th><th>Statut</th></tr></thead>
            <tbody>
              {past.map(o=>{
                const s=SL[o.status]; const cc=CC[o.cat]; const pct=Math.round((o.cur/o.target)*100);
                return (<tr key={o.id}><td style={{ fontWeight:600 }}>{o.title}</td><td><span className="badge" style={{ background:`color-mix(in srgb, ${cc.color} 15%, transparent)`, color:cc.color }}>{cc.label}</span></td><td className="hide-mobile" style={{ color:"var(--muted)" }}>{o.cur}/{o.target} ({pct}%)</td><td><span className={`badge ${s.cls}`}>{s.label}</span></td></tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
