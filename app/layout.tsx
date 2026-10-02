import type { Metadata, Viewport } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";
import "./design-system.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
    { media: "(prefers-color-scheme: light)", color: "#f8f9fa" },
  ],
};

export const metadata: Metadata = {
  title: "Poimén — Gestion des Familles de Disciples",
  description:
    "Plateforme de suivi et gestion des Familles de Disciples pour les églises ICC.",
  applicationName: "Poimén",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Poimén",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("poimen_theme")==="dark"?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;document.documentElement.classList.toggle("dark",t==="dark");document.addEventListener("DOMContentLoaded",function(){document.body.dataset.theme=t;document.body.style.colorScheme=t;document.body.classList.toggle("dark",t==="dark");});}catch(e){document.documentElement.dataset.theme="light";document.addEventListener("DOMContentLoaded",function(){document.body.dataset.theme="light";});}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ThemeToggle />
        <PwaRegister />
      </body>
    </html>
  );
}
