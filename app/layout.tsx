import type { Metadata } from "next";
import "./globals.css";
import { AppNavigation } from "./components/app-navigation";
import { AuthGuard } from "./components/auth-guard";
import { LegacyHeadingIcons } from "./components/legacy-heading-icons";

export const metadata: Metadata = {
  title: "Trener Biegania AI",
  description:
    "Osobisty trener biegania AI: analiza treningów, celów i regeneracji.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthGuard>
          <AppNavigation />
          <LegacyHeadingIcons />
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
