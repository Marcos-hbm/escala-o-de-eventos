"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa } from "@/lib/auth";
import { assinaturaDaEmpresa, usoDaEmpresa } from "@/lib/assinatura";
import { limitesDoPlano, rotuloLimite, rotuloPlano, type RecursoContavel } from "@/lib/planos";
import { registrarAuditoria } from "@/lib/audit";
import { planoSchema } from "@/lib/validations";
import { type ActionState } from "@/lib/actions";
import { voltarComSucesso } from "@/server/actions/navegacao";

/**
 * v3 (SaaS) — Troca de plano.
 *
 * Não há cobrança: a assinatura guarda os ganchos `provedor`/`provedorRef` para
 * quando um provedor real (Stripe/pagar.me) for integrado — aqui a troca é
 * aplicada direto, como numa conta de demonstração/comercial. O que **é** regra
 * de verdade: um downgrade não pode deixar a conta acima dos limites do plano
 * destino, senão a empresa ficaria em estado inconsistente (ex.: 5 membros num
 * plano de 2).
 */

const NOMES_USO: Record<RecursoContavel, string> = {
  maxMembros: "membros ativos",
  maxEventosAtivos: "eventos ativos",
  maxVinculosAtivos: "vínculos ativos/pendentes",
};

export async function trocarPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "plano:gerenciar");
  if (negado) return { ok: false, message: negado };

  const parsed = planoSchema.safeParse({ plano: formData.get("plano") });
  if (!parsed.success) return { ok: false, message: "Plano inválido." };
  const destino = parsed.data.plano;

  const atual = await assinaturaDaEmpresa(s.sub);
  if (atual.plano === destino) {
    return { ok: false, message: `A conta já está no plano ${rotuloPlano(destino)}.` };
  }

  // Downgrade só passa se o uso atual couber nos limites do plano destino.
  const uso = await usoDaEmpresa(s.sub);
  const limites = limitesDoPlano(destino);
  const excedidos = (Object.keys(NOMES_USO) as RecursoContavel[])
    .filter((r) => limites[r] !== null && uso[r] > (limites[r] as number))
    .map((r) => `${uso[r]} ${NOMES_USO[r]} (limite ${rotuloLimite(limites[r])})`);
  if (excedidos.length > 0) {
    return {
      ok: false,
      message: `Não é possível migrar para ${rotuloPlano(destino)}: a conta está acima do limite em ${excedidos.join(", ")}. Reduza o uso antes de trocar.`,
    };
  }

  const assinatura = await prisma.assinatura.upsert({
    where: { empresaId: s.sub },
    create: { empresaId: s.sub, plano: destino, status: "ATIVA" },
    // Sai do TRIAL ao escolher um plano explicitamente.
    update: { plano: destino, status: "ATIVA" },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "PLANO_ALTERADO",
    entidade: "Assinatura",
    entidadeId: assinatura.id,
    detalhe: `${atual.plano} → ${destino}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  revalidatePath("/empresa/plano");
  revalidatePath("/empresa/equipe");
  return voltarComSucesso("/empresa/plano", `Plano alterado para ${rotuloPlano(destino)}.`);
}
