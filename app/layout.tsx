import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme-2.css";
import "./design-kit.css";
import "./shell-kit.css";
import "./staff-kit.css";
import { TableLabels } from "@/components/table-labels";
import { BrandSplash } from "@/components/brand";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#155F65",
};

export const metadata: Metadata = {
  title: { default: "Sheplates", template: "%s · Sheplates" },
  description: "Local food and essentials, planned around you.",
  applicationName: "Sheplates",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sheplates",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><BrandSplash />{children}<TableLabels /></body>
    </html>
  );
}
