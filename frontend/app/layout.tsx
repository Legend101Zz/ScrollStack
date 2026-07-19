import type { Metadata } from "next";
import { IBM_Plex_Sans, Reggae_One } from "next/font/google";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";

import "./globals.css";

const reggaeOne = Reggae_One({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
});

const ibmPlexSans = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "ScrollStack",
    template: "%s | ScrollStack",
  },
  description: "Turn the next pages of a book into a continuous manga series.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${reggaeOne.variable} ${ibmPlexSans.variable}`}>
        <AppShell />
        {children}
      </body>
    </html>
  );
}
