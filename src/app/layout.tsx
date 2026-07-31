import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { atributoTema, COOKIE_TEMA, temaOuPadrao } from "@/lib/tema";
import { MarcaHidratacao } from "@/components/marca-hidratacao";

export const metadata: Metadata = {
  title: "Escala — Sistema de Escalação de Freelancers",
  description:
    "Plataforma para escalação de freelancers em eventos culturais e corporativos: vínculos, propostas, escala e lista final.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema resolvido no servidor (cookie) para o primeiro paint já sair no tema
  // escolhido — sem o "flash" de tema errado típico de localStorage.
  const tema = temaOuPadrao((await cookies()).get(COOKIE_TEMA)?.value);
  const attr = atributoTema(tema);

  return (
    <html lang="pt-BR" {...(attr ? { "data-theme": attr } : {})}>
      <body className="min-h-screen">
        {children}
        <MarcaHidratacao />
      </body>
    </html>
  );
}
