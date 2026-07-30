import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escala — Sistema de Escalação de Freelancers",
  description:
    "Plataforma para escalação de freelancers em eventos culturais e corporativos: vínculos, propostas, escala e lista final.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
