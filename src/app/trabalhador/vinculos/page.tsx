import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { solicitarVinculo, responderVinculo, desvincular, alternarFavorito } from "@/server/actions/vinculos";
import { Star, Search } from "lucide-react";

export const metadata = { title: "Vínculos — Escala" };

export default async function VinculosTrabalhador({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const s = await requireTrabalhador();
  const { q } = await searchParams;

  const vinculos = await prisma.vinculo.findMany({
    where: { userId: s.sub, status: { in: ["ATIVO", "PENDENTE"] } },
    include: { empresa: { select: { id: true, nome: true, cnpj: true } } },
    orderBy: [{ favorito: "desc" }, { createdAt: "desc" }],
  });

  const convitesRecebidos = vinculos.filter((v) => v.status === "PENDENTE" && v.solicitadoPor === "EMPRESA");
  const pedidosEnviados = vinculos.filter((v) => v.status === "PENDENTE" && v.solicitadoPor === "TRABALHADOR");
  const ativos = vinculos.filter((v) => v.status === "ATIVO");

  // Busca de empresas (RF: campo "Buscar" — início do nome).
  const idsJaRelacionados = vinculos.map((v) => v.empresaId);
  const resultados = q
    ? await prisma.empresa.findMany({
        where: {
          ativo: true,
          nome: { startsWith: q, mode: "insensitive" },
          id: { notIn: idsJaRelacionados },
        },
        select: { id: true, nome: true, cnpj: true },
        take: 10,
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vínculos</h1>
        <p className="text-sm text-muted">Conecte-se a empresas para ver e aceitar propostas de eventos.</p>
      </div>

      {/* Buscar empresas */}
      <Card>
        <h2 className="mb-3 font-semibold">Buscar empresas</h2>
        <form method="get" className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Digite o início do nome da empresa" />
          <Button type="submit"><Search className="h-4 w-4" /> Buscar</Button>
        </form>
        <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
          {q && resultados.length === 0 && <p className="py-3 text-sm text-muted">Nenhuma empresa encontrada.</p>}
          {resultados.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{e.nome}</span>
              <form action={solicitarVinculo}>
                <input type="hidden" name="empresaId" value={e.id} />
                <SubmitButton size="sm" variant="outline" pendingLabel="...">Solicitar vínculo</SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </Card>

      {convitesRecebidos.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Convites recebidos</h2>
          <div className="space-y-2">
            {convitesRecebidos.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.empresa.nome}</span>
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

      {pedidosEnviados.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Pedidos enviados</h2>
          <div className="space-y-2">
            {pedidosEnviados.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.empresa.nome}</span>
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
                <span className="flex items-center gap-2 text-sm font-medium">
                  {v.favorito && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  {v.empresa.nome}
                </span>
                <div className="flex gap-2">
                  <form action={alternarFavorito}>
                    <input type="hidden" name="vinculoId" value={v.id} />
                    <SubmitButton size="sm" variant="ghost" pendingLabel="...">
                      {v.favorito ? "Desfavoritar" : "Favoritar"}
                    </SubmitButton>
                  </form>
                  <form action={desvincular}>
                    <input type="hidden" name="vinculoId" value={v.id} />
                    <SubmitButton size="sm" variant="danger" pendingLabel="...">Desvincular</SubmitButton>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
