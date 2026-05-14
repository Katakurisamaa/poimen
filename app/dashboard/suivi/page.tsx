"use client";

import { useState } from "react";
import { Save, ChevronDown, ChevronUp, History } from "lucide-react";

function Toggle({ label, value, onChange }: { label:string; value:boolean; onChange:()=>void }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:13, color:"var(--cream)" }}>{label}</span>
      <button className={`toggle ${value?"on":""}`} onClick={onChange} type="button" />
    </div>
  );
}

function Section({ title, children, open:init=true }: { title:string; children:React.ReactNode; open?:boolean }) {
  const [open, setOpen] = useState(init);
  return (
    <div className="glass glass-flush">
      <button onClick={()=>setOpen(!open)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"none", border:"none", cursor:"pointer", borderBottom:open?"1px solid var(--border)":"none" }}>
        <span style={{ fontSize:11, fontWeight:700, color:"var(--gold-light)", textTransform:"uppercase", letterSpacing:1.5 }}>{title}</span>
        {open ? <ChevronUp size={16} style={{ color:"var(--muted)" }} /> : <ChevronDown size={16} style={{ color:"var(--muted)" }} />}
      </button>
      {open && <div style={{ padding:"4px 18px 14px" }}>{children}</div>}
    </div>
  );
}

export default function SuiviPage() {
  const [f, setF] = useState({
    appel_abouti:false, groupe_whatsapp:true, dans_fdd:true,
    prevu_revenir:true, revenu_culte:true, rencontre:true,
    visite:false, interesse_cdm:true, presence_cdm:true,
    priere_eglise:true, priere_partage:false, interet_events:true,
    event_ok:false, cocktail:true, interet_formation:true,
    p001:true, p101:true, p201:false, p301:false,
    pcnc:false, veut_servir:true, star:false,
  });
  const [comment, setComment] = useState("Membre engagé, signes de croissance.");
  const t = (k:keyof typeof f) => setF(p=>({...p,[k]:!p[k]}));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18, maxWidth:700 }}>
      <div className="page-header">
        <div><h2 className="page-title">Fiche de suivi</h2><p style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>Grâce Mukendi · Resp: Sarah K.</p></div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn btn-ghost btn-sm"><History size={14} /> Historique</button>
          <button className="btn btn-primary btn-sm"><Save size={14} /> Enregistrer</button>
        </div>
      </div>

      {/* Info glass */}
      <div className="glass">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:"10px 20px" }}>
          {[["Nom","Grâce Mukendi"],["Civilité","Mme."],["Âge","26-30"],["E-mail","grace@email.com"],["Tél","+32 470 123 456"],["Adresse","Rue de la Station 15"],["Responsable","Sarah K."],["Église locale","Oui"]].map(([l,v])=>(
            <div key={l}><div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{l}</div><div style={{ fontSize:13, fontWeight:500 }}>{v}</div></div>
          ))}
        </div>
      </div>

      <Section title="Contact initial">
        <div style={{ padding:"10px 0" }}><label className="form-label">Événement d&apos;entrée</label><select className="input"><option>Culte</option><option>Évangélisation</option><option>Baptême</option><option>Séminaire</option></select></div>
        <Toggle label="Appel abouti" value={f.appel_abouti} onChange={()=>t("appel_abouti")} />
        <Toggle label="Groupe WhatsApp" value={f.groupe_whatsapp} onChange={()=>t("groupe_whatsapp")} />
        <Toggle label="Dans une FDD" value={f.dans_fdd} onChange={()=>t("dans_fdd")} />
      </Section>

      <Section title="Engagement & Présence">
        <Toggle label="Prévu revenir" value={f.prevu_revenir} onChange={()=>t("prevu_revenir")} />
        <Toggle label="Revenu au culte" value={f.revenu_culte} onChange={()=>t("revenu_culte")} />
        <Toggle label="Rencontre effectuée" value={f.rencontre} onChange={()=>t("rencontre")} />
        <Toggle label="Visite domicile" value={f.visite} onChange={()=>t("visite")} />
        <Toggle label="Intéressé CDM" value={f.interesse_cdm} onChange={()=>t("interesse_cdm")} />
        <Toggle label="Présence CDM" value={f.presence_cdm} onChange={()=>t("presence_cdm")} />
      </Section>

      <Section title="Vie spirituelle">
        <Toggle label="Prière à l'église" value={f.priere_eglise} onChange={()=>t("priere_eglise")} />
        <Toggle label="Prière/partage" value={f.priere_partage} onChange={()=>t("priere_partage")} />
        <Toggle label="Intérêt événements" value={f.interet_events} onChange={()=>t("interet_events")} />
        <Toggle label="Événement OK" value={f.event_ok} onChange={()=>t("event_ok")} />
        <Toggle label="Cocktail bienvenue" value={f.cocktail} onChange={()=>t("cocktail")} />
      </Section>

      <Section title="PCNC & Parcours">
        <Toggle label="Intérêt PCNC" value={f.interet_formation} onChange={()=>t("interet_formation")} />
        <Toggle label="Participation 001" value={f.p001} onChange={()=>t("p001")} />
        <Toggle label="Participation 101" value={f.p101} onChange={()=>t("p101")} />
        <Toggle label="Participation 201" value={f.p201} onChange={()=>t("p201")} />
        <Toggle label="Participation 301" value={f.p301} onChange={()=>t("p301")} />
        <Toggle label="Parcours PCNC terminé" value={f.pcnc} onChange={()=>t("pcnc")} />
        <Toggle label="Veut servir" value={f.veut_servir} onChange={()=>t("veut_servir")} />
        <Toggle label="Devenu S.T.A.R" value={f.star} onChange={()=>t("star")} />
      </Section>

      <Section title="Commentaire">
        <div style={{ padding:"10px 0" }}><textarea className="input" rows={4} value={comment} onChange={e=>setComment(e.target.value)} style={{ resize:"vertical" }} /></div>
      </Section>
    </div>
  );
}
