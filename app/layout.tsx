import type { Metadata } from "next";
import "./globals.css";
import { AppNavigation } from "./components/app-navigation";
import { AuthGuard } from "./components/auth-guard";

export const metadata: Metadata = {
  title: "Centrum agenta AI",
  description:
    "Profesjonalny agent AI od żeglugi tradycyjnej i pracy pokładowej.",
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
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
