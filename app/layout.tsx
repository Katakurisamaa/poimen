import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Poimén — Gestion des Familles de Disciples",
  description:
    "Plateforme de suivi et gestion des Familles de Disciples pour les églises ICC.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${jakarta.variable} ${cormorant.variable}`} data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("poimen_theme")==="dark"?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;document.documentElement.classList.toggle("dark",t==="dark");document.addEventListener("DOMContentLoaded",function(){document.body.dataset.theme=t;document.body.style.colorScheme=t;document.body.classList.toggle("dark",t==="dark");});}catch(e){document.documentElement.dataset.theme="light";document.addEventListener("DOMContentLoaded",function(){document.body.dataset.theme="light";});}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
