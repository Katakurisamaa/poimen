"use client";

import { useId } from "react";
import styles from "./YesNoField.module.css";

interface Props {
  name: string;
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  required?: boolean;
  yesLabel?: string;
  noLabel?: string;
  error?: string;
}

export default function YesNoField({ name, label, value, onChange, required, yesLabel = "Oui", noLabel = "Non", error }: Props) {
  const id = useId();
  return <fieldset className={styles.field} data-field={name} data-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
    <legend className={styles.legend}>{label}</legend>
    <div className={styles.row}>
      <div className={styles.label} aria-hidden="true">{label}{required && <span> *</span>}</div>
      <div className={styles.choices}>
        {[true, false].map(answer => <label key={String(answer)} className={styles.choice}>
          <input type="radio" name={`${name}-${id}`} value={String(answer)} checked={value === answer}
            required={required} onChange={() => onChange(answer)} />
          <span>{answer ? yesLabel : noLabel}</span>
        </label>)}
      </div>
    </div>
    {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
  </fieldset>;
}
