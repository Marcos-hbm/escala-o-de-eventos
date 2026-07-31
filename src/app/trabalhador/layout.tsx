import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell, type NavItem } from "@/components/shell";
import { cookies } from "next/headers";
import { COOKIE_TEMA, temaOuPadrao } from "@/lib/tema";
import { LayoutDashboard, CalendarSearch, Link2, History, Bell, UserRound, Wallet } from "lucide-react";

export default async function TrabalhadorLayout({ children }: { children: React.ReactNode }) {
  const s = await requireTrabalhador();
  const tema = temaOuPadrao((await cookies()).get(COOKIE_TEMA)?.value);
  const naoLidas = await prisma.notificacao.count({ where: { userId: s.sub, lida: false } });
  const itens: NavItem[] = [
    { href: "/trabalhador/dashboard", label: "Painel", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/trabalhador/eventos", label: "Descobrir eventos", icon: <CalendarSearch className="h-4 w-4" /> },
    { href: "/trabalhador/vinculos", label: "Vínculos", icon: <Link2 className="h-4 w-4" /> },
    { href: "/trabalhador/historico", label: "Histórico", icon: <History className="h-4 w-4" /> },
    { href: "/trabalhador/financeiro", label: "Meus pagamentos", icon: <Wallet className="h-4 w-4" /> },
    { href: "/trabalhador/notificacoes", label: "Notificações", icon: <Bell className="h-4 w-4" />, badge: naoLidas },
    { href: "/trabalhador/perfil", label: "Perfil", icon: <UserRound className="h-4 w-4" /> },
  ];
  return <Shell nome={s.nome} papel="Trabalhador" itens={itens} tema={tema}>{children}</Shell>;
}
