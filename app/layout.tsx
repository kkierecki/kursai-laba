import type { Metadata } from "next";
import "./globals.css";
import { AppNavigation } from "./components/app-navigation";

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
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
