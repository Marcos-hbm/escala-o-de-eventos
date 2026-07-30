import Link from "next/link";
import { requirePermissao } from "@/lib/auth";
import { criarEvento } from "@/server/actions/eventos";
import { EventoForm } from "@/components/evento-form";

export const metadata = { title: "Novo evento — Escala" };

export default async function NovoEvento() {
  // RBAC também na URL direta (não só escondendo o botão na listagem).
  await requirePermissao("evento:criar");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <h1 className="mb-1 mt-3 text-2xl font-bold">Criar evento</h1>
      <p className="mb-6 text-sm text-muted">Ao salvar, o evento é publicado e os trabalhadores vinculados são notificados.</p>
      <EventoForm action={criarEvento} textoBotao="Salvar evento" />
    </div>
  );
}
