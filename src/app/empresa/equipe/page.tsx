import Link from "next/link";
import { papelDaSessao, requirePermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assinaturaDaEmpresa, usoDaEmpresa } from "@/lib/assinatura";
import { cabeMais, limitesDoPlano, pctUso, rotuloLimite, rotuloPlano } from "@/lib/planos";
import { DESCRICOES_PAPEL, ORDEM_PAPEIS, papeisAtribuiveis, rotuloPapel } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Bar } from "@/components/ui/stat";
import { Flash } from "@/components/ui/flash";
import { MembroLinha, NovoMembroForm, type MembroView } from "./equipe-forms";

export const metadata = { title: "Equipe — Escala" };

/**
 * v3 (SaaS) — Equipe da empresa: usuários da conta e seus papéis (RBAC), com o
 * consumo da cota de usuários do plano.
 */
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; erro_op?: string }>;
}) {
  const sp = await searchParams;
  const s = await requirePermissao("equipe:gerenciar");
  const meuPapel = papelDaSessao(s);

  const [membros, assinatura, uso] = await Promise.all([
    prisma.membro.findMany({
      where: { empresaId: s.sub },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    }),
    assinaturaDaEmpresa(s.sub),
    usoDaEmpresa(s.sub),
  ]);

  const limite = limitesDoPlano(assinatura.plano).maxMembros;
  const temVaga = cabeMais(uso.maxMembros, limite);
  const atribuiveis = papeisAtribuiveis(meuPapel);

  const lista: MembroView[] = membros
    .map((m) => ({ ...m, souEu: m.id === s.membroId }))
    .sort((a, b) => ORDEM_PAPEIS.indexOf(a.papel) - ORDEM_PAPEIS.indexOf(b.papel) || a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho="/empresa/equipe" />
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-sm text-muted">
          Usuários com acesso à conta da empresa e o que cada papel pode fazer.
        </p>
      </div>

      <Card>
        <Bar
          label={`Usuários no plano ${rotuloPlano(assinatura.plano)}`}
          pct={pctUso(uso.maxMembros, limite)}
          right={`${uso.maxMembros} de ${rotuloLimite(limite)} ativos`}
        />
        {!temVaga && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            Cota de usuários esgotada. Revogue o acesso de alguém ou{" "}
            <Link href="/empresa/plano" className="underline">mude de plano</Link>.
          </p>
        )}
      </Card>

      {temVaga ? (
        <NovoMembroForm papeis={atribuiveis} />
      ) : (
        <Card className="text-sm text-muted">
          Para adicionar mais usuários, libere uma vaga na equipe ou faça upgrade em{" "}
          <Link href="/empresa/plano" className="text-brand-600 hover:underline">Plano</Link>.
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Membros ({lista.length})</h2>
        {lista.map((m) => (
          <MembroLinha key={m.id} membro={m} papeis={atribuiveis} />
        ))}
      </section>

      <Card>
        <h2 className="mb-3 font-semibold">O que cada papel pode fazer</h2>
        <dl className="space-y-2 text-sm">
          {ORDEM_PAPEIS.map((p) => (
            <div key={p} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-40 shrink-0 font-medium">{rotuloPapel(p)}</dt>
              <dd className="text-muted">{DESCRICOES_PAPEL[p]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
