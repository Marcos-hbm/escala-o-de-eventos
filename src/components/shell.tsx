import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { sair } from "@/server/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { type Tema } from "@/lib/tema";
import { LogOut } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function Badge({ n }: { n?: number }) {
  if (!n || n <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Shell({
  nome,
  papel,
  itens,
  tema,
  children,
}: {
  nome: string;
  /** Linha de contexto no rodapé do menu: "Trabalhador" ou "Empresa · Papel". */
  papel: string;
  itens: NavItem[];
  /** Tema atual (cookie), para o toggle iniciar no estado correto. */
  tema: Tema;
  children: React.ReactNode;
}) {
  return (
    // O provider de toasts fica aqui, e não no layout raiz: envolver todo o
    // <body> num client component transformava a árvore inteira em subárvore de
    // cliente, o que atrapalhava a atualização das telas após server actions.
    <ToastProvider>
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-surface bg-surface p-4 md:flex">
        <Link href="/" className="mb-6 px-2 text-xl font-bold text-brand-600">Escala</Link>
        <nav className="flex flex-1 flex-col gap-1">
          {itens.map((i) => (
            <NavLink key={i.href} href={i.href}>
              {i.icon}
              {i.label}
              <Badge n={i.badge} />
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-surface pt-4">
          <p className="px-2 text-xs text-muted">{papel}</p>
          <p className="truncate px-2 text-sm font-medium">{nome}</p>
          <div className="mt-2">
            <ThemeToggle inicial={tema} />
          </div>
          <form action={sair} className="mt-1">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        {/* Barra superior mobile */}
        <header className="flex items-center justify-between border-b border-surface bg-surface p-4 md:hidden">
          <Link href="/" className="text-lg font-bold text-brand-600">Escala</Link>
          <div className="flex items-center gap-1">
            <ThemeToggle inicial={tema} />
            <form action={sair}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
            </form>
          </div>
        </header>
        {/* Nav mobile */}
        <nav className="flex gap-1 overflow-x-auto border-b border-surface bg-surface px-2 py-2 md:hidden">
          {itens.map((i) => (
            <NavLink key={i.href} href={i.href}>{i.label}</NavLink>
          ))}
        </nav>

        <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
