import type { Metadata } from "next";
import "./globals.css";
import { AppNavigation } from "./components/app-navigation";
import { AuthGuard } from "./components/auth-guard";

export const metadata: Metadata = {
  title: "RUNLAB — Trener Biegania AI",
  description:
    "Osobisty trener biegania AI: analiza treningów, celów i regeneracji.",
  openGraph: { title: "RUNLAB — Trener Biegania AI", description: "Biegaj mądrzej. Docieraj dalej.", images: ["/opengraph-image"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body>
        <AuthGuard>
          <AppNavigation />
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
