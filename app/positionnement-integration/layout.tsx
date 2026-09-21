import type { Metadata } from "next";
import { FeedbackProvider } from "@/components/experience/FeedbackProvider";

export const metadata: Metadata = {
  title: "Plan de Positionnement des Conseillers — Poimén",
  description: "Plan de positionnement des sièges et des postes pour le culte du dimanche.",
};

export default function PositionnementLayout({ children }: { children: React.ReactNode }) {
  return <FeedbackProvider>{children}</FeedbackProvider>;
}
