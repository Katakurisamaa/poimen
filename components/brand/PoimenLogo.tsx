import { POIMEN_P_MARK, POIMEN_P_VIEWBOX } from "@/lib/brand";
import styles from "./PoimenLogo.module.css";

type Props = { 
  compact?: boolean; 
  size?: "navigation" | "hero" | "sm" | "md" | "lg"; 
  signature?: boolean; 
  decorative?: boolean;
  monochrome?: boolean;
  className?: string;
};

export default function PoimenLogo({ 
  compact = false, 
  size = "navigation", 
  signature = false, 
  decorative = false,
  monochrome = false,
  className = ""
}: Props) {
  // La signature est strictement réservée aux grands formats hero
  const showSignature = signature && !compact && size === "hero";

  return (
    <span 
      className={`${styles.logoContainer} ${styles[size] || styles.navigation} ${compact ? styles.compact : ""} ${monochrome ? styles.monochrome : ""} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Poimén"}
      aria-hidden={decorative || undefined}
    >
      <span className={styles.wordmark}>
        {/* Le P stylisé en doré : première lettre du mot */}
        <svg 
          className={styles.pMark} 
          viewBox={POIMEN_P_VIEWBOX} 
          fill="none" 
          focusable="false"
          aria-hidden="true"
        >
          <path 
            d={POIMEN_P_MARK} 
            strokeWidth="3.6" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>

        {/* Le reste du mot « oimén » dans la même couleur sombre que le reste du texte */}
        {!compact && (
          <span className={styles.suffix}>oimén</span>
        )}
      </span>

      {showSignature && (
        <span className={styles.signature}>Prendre soin. Avancer ensemble.</span>
      )}
    </span>
  );
}

