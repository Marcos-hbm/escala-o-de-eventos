"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Item do menu lateral.
 *
 * `prefetch={false}` é deliberado. Todas as telas internas são dinâmicas (leem
 * cookie de sessão), então o prefetch não pode ser reaproveitado por muito tempo
 * e, com 6–7 itens no menu, cada visita disparava 6–7 requisições RSC extras.
 * Medido: essas requisições concorriam com a resposta das server actions e, em
 * ~2 de 8 execuções, o cliente descartava a atualização — a mutação era gravada
 * no banco e a tela continuava mostrando o estado anterior.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-600 text-white"
          : "text-muted hover:bg-slate-100 dark:hover:bg-slate-800",
      )}
    >
      {children}
    </Link>
  );
}
