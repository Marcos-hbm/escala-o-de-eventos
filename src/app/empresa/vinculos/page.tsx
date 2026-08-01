import { requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trabalhadoresBloqueados } from "@/lib/bloqueio";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { convidarTrabalhador, responderVinculo, desvincular } from "@/server/actions/vinculos";
import { formatCPF } from "@/lib/utils";
import { Search } from "lucide-react";
import { Flash } from "@/components/ui/flash";

export const metadata = { title: "Vínculos — Escala" };

/**
 * **Este segmento não tem `loading.tsx` de propósito.** Com a fronteira de streaming,
 * 5 de 64 convites eram gravados no banco sem que a tela saísse do estado anterior;
 * sem ela, 0 de 64. Ver
 * [ADR 0004](../../../../docs/adr/0004-atualizacao-de-tela-apos-server-action.md) e a
 * guarda em `tests/unit/fronteiras-loading.test.ts`.
 */

export default async function VinculosEmpresa({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; aviso?: string; erro_op?: string }>;
}) {
  const s = await requireEmpresa();
  const sp = await searchParams;
  const { q } = sp;
  const podeGerenciar = sessaoPode(s, "vinculo:gerenciar");

  const vinculos = await prisma.vinculo.findMany({
    where: { empresaId: s.sub, status: { in: ["ATIVO", "PENDENTE"] } },
    include: { user: { select: { id: true, nome: true, cpf: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pedidosRecebidos = vinculos.filter((v) => v.status === "PENDENTE" && v.solicitadoPor === "TRABALHADOR");
  const convitesEnviados = vinculos.filter((v) => v.status === "PENDENTE" && v.solicitadoPor === "EMPRESA");
  const ativos = vinculos.filter((v) => v.status === "ATIVO");

  // v4 item 5: bloqueados não aparecem na busca de trabalhadores para convidar.
  const bloqueados = await trabalhadoresBloqueados(s.sub);
  const idsRelacionados = [...vinculos.map((v) => v.userId), ...bloqueados];
  const resultados = q
    ? await prisma.user.findMany({
        where: { ativo: true, nome: { startsWith: q, mode: "insensitive" }, id: { notIn: idsRelacionados } },
        select: { id: true, nome: true, cpf: true },
        take: 10,
      })
    : [];

  return (
    <div className="space-y-8">
      <Flash searchParams={sp} caminho="/empresa/vinculos" />
      <div>
        <h1 className="text-2xl font-bold">Vínculos</h1>
        <p className="text-sm text-muted">Trabalhadores habilitados a participar dos seus eventos.</p>
      </div>

      {podeGerenciar && (
      <Card>
        <h2 className="mb-3 font-semibold">Convidar trabalhador</h2>
        <form method="get" className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Início do nome do trabalhador" />
          <Button type="submit"><Search className="h-4 w-4" /> Buscar</Button>
        </form>
        <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
          {q && resultados.length === 0 && <p className="py-3 text-sm text-muted">Nenhum trabalhador encontrado.</p>}
          {resultados.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{u.nome}</span>
              <form action={convidarTrabalhador}>
                <input type="hidden" name="userId" value={u.id} />
                <SubmitButton size="sm" variant="outline" pendingLabel="...">Convidar</SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </Card>
      )}

      {podeGerenciar && pedidosRecebidos.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Pedidos recebidos</h2>
          <div className="space-y-2">
            {pedidosRecebidos.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.user.nome}</span>
                <div className="flex gap-2">
                  <form action={responderVinculo}>
                    <input type="hidden" name="vinculoId" value={v.id} />
                    <input type="hidden" name="acao" value="aceitar" />
                    <SubmitButton size="sm" pendingLabel="...">Aceitar</SubmitButton>
                  </form>
                  <form action={responderVinculo}>
                    <input type="hidden" name="vinculoId" value={v.id} />
                    <input type="hidden" name="acao" value="recusar" />
                    <SubmitButton size="sm" variant="outline" pendingLabel="...">Recusar</SubmitButton>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {convitesEnviados.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Convites enviados</h2>
          <div className="space-y-2">
            {convitesEnviados.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.user.nome}</span>
                <Badge tone="warning">Aguardando resposta</Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Vínculos ativos</h2>
        {ativos.length === 0 ? (
          <Card className="text-sm text-muted">Nenhum vínculo ativo ainda.</Card>
        ) : (
          <div className="space-y-2">
            {ativos.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{v.user.nome}</p>
                  <p className="text-xs text-muted">{formatCPF(v.user.cpf)}</p>
                </div>
                {podeGerenciar && (
                  <form action={desvincular}>
                    <input type="hidden" name="vinculoId" value={v.id} />
                    <SubmitButton size="sm" variant="danger" pendingLabel="...">Desvincular</SubmitButton>
                  </form>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
