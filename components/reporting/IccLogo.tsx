"use client";

import React from "react";
import { ICC_OFFICIAL_LOGO_BASE64 } from "@/lib/icc-logo-base64";
import { ICC_OFFICIAL_LOGO_DARK_BASE64 } from "@/lib/icc-logo-dark-base64";

interface IccLogoProps {
  customLogoUrl?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  lightMode?: boolean; // if false, for dark backgrounds
}

export default function IccLogo({
  customLogoUrl,
  width = 135,
  height = 68,
  className,
  lightMode = true,
}: IccLogoProps) {
  // If custom logo is provided, use it directly.
  // Otherwise, use the official vector/asset tuned for light or dark backgrounds.
  const logoSrc = customLogoUrl
    ? customLogoUrl
    : lightMode
    ? ICC_OFFICIAL_LOGO_BASE64
    : ICC_OFFICIAL_LOGO_DARK_BASE64;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      className={className}
    >
      <img
        src={logoSrc}
        alt="Logo Impact Centre Chrétien"
        style={{
          width,
          height,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
