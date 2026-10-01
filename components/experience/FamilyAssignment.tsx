"use client";
import { useState, useMemo } from "react";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import styles from "./FamilyAssignment.module.css";

type Props = { 
  value?: string; 
  families: string[]; 
  disabled?: boolean; 
  person: string; 
  onChange: (value: string) => Promise<void> 
};

export default function FamilyAssignment({ value, families, disabled, person, onChange }: Props) {
  const [pending, setPending] = useState(false);
  const selected = value || "AUCUNE";

  const options: CustomSelectOption[] = useMemo(() => {
    const uniqueFamilies = [...new Set([...families, ...(selected !== "AUCUNE" ? [selected] : [])])];
    return [
      { value: "AUCUNE", label: "Non affecté(e) — choisir une famille" },
      ...uniqueFamilies.filter(f => f !== "AUCUNE").map(f => ({
        value: f,
        label: f
      }))
    ];
  }, [families, selected]);

  return (
    <div className={styles.assignment}>
      <label>Famille de disciples</label>
      <CustomSelect
        value={selected}
        disabled={disabled || pending}
        options={options}
        placeholder="Non affecté(e) — choisir une famille"
        ariaLabel={`Famille de disciples de ${person}`}
        searchable={options.length >= 6}
        onChange={async (newVal) => {
          setPending(true);
          try {
            await onChange(newVal);
          } finally {
            setPending(false);
          }
        }}
      />
      {pending && <small role="status" style={{ color: "var(--gold)" }}>Enregistrement…</small>}
      {disabled && <small>Affectation modifiable par le responsable autorisé.</small>}
    </div>
  );
}
