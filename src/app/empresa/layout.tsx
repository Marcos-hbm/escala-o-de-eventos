import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { rotuloPapel } from "@/lib/rbac";
import { Shell, type NavItem } from "@/components/shell";
import { cookies } from "next/headers";
import { COOKIE_TEMA, temaOuPadrao } from "@/lib/tema";
import { LayoutDashboard, CalendarDays, Link2, UserRound, Users, CreditCard } from "lucide-react";

export default async function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const s = await requireEmpresa();
  const tema = temaOuPadrao((await cookies()).get(COOKIE_TEMA)?.value);
  const itens: NavItem[] = [
    { href: "/empresa/dashboard", label: "Painel", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/empresa/eventos", label: "Meus eventos", icon: <CalendarDays className="h-4 w-4" /> },
    { href: "/empresa/vinculos", label: "Vínculos", icon: <Link2 className="h-4 w-4" /> },
    // v3 (SaaS): Equipe só para quem gerencia a equipe; Plano é visível a todos
    // (a troca de plano é que exige papel de Proprietário).
    ...(sessaoPode(s, "equipe:gerenciar")
      ? [{ href: "/empresa/equipe", label: "Equipe", icon: <Users className="h-4 w-4" /> }]
      : []),
    { href: "/empresa/plano", label: "Plano", icon: <CreditCard className="h-4 w-4" /> },
    { href: "/empresa/perfil", label: "Perfil", icon: <UserRound className="h-4 w-4" /> },
  ];
  // Rodapé do menu mostra quem está logado e com qual papel (multiusuário).
  return (
    <Shell
      nome={s.membroNome ?? s.nome}
      papel={`${s.nome} · ${rotuloPapel(papelDaSessao(s))}`}
      itens={itens}
      tema={tema}
    >
      {children}
    </Shell>
  );
}
