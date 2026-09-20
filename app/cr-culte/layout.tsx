import type { Metadata } from "next";
import { FeedbackProvider } from "@/components/experience/FeedbackProvider";

export const metadata: Metadata = {
  title: "Compte Rendu Global Culte — Poimén",
  description: "Rapport hebdomadaire des cultes du dimanche pour le département intégration.",
};

export default function CrCulteLayout({ children }: { children: React.ReactNode }) {
  return <FeedbackProvider>{children}</FeedbackProvider>;
}
