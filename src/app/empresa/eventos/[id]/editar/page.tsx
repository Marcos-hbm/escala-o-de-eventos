import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editarEvento } from "@/server/actions/eventos";
import { EventoForm } from "@/components/evento-form";

export const metadata = { title: "Editar evento — Escala" };

export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermissao("evento:editar");
  const { id } = await params;
  const evento = await prisma.evento.findUnique({ where: { id: Number(id) } });
  if (!evento || evento.empresaId !== s.sub) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold">Editar evento</h1>
      <EventoForm
        action={editarEvento}
        textoBotao="Salvar alterações"
        inicial={{
          id: evento.id,
          nome: evento.nome,
          descricao: evento.descricao,
          dataEvento: evento.dataEvento.toISOString().slice(0, 10),
          local: evento.local,
          horaInicio: evento.horaInicio,
          vagas: evento.vagas,
          funcoes: evento.funcoes,
          valorCache: Number(evento.valorCache),
          observacoes: evento.observacoes,
        }}
      />
    </div>
  );
}
