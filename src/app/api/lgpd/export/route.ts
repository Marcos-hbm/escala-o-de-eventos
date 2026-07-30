import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exportarDadosTrabalhador, exportarDadosEmpresa } from "@/lib/lgpd";
import { registrarAuditoria } from "@/lib/audit";

/**
 * LGPD Art. 18 (II/V) — Portabilidade e acesso aos dados.
 * Exporta em JSON todos os dados pessoais do titular autenticado.
 */
export async function GET() {
  const s = await getSession();
  if (!s) return new NextResponse("Não autorizado", { status: 401 });

  const dados =
    s.tipo === "TRABALHADOR"
      ? await exportarDadosTrabalhador(s.sub)
      : await exportarDadosEmpresa(s.sub);

  if (!dados) return new NextResponse("Não encontrado", { status: 404 });

  await registrarAuditoria({
    atorTipo: s.tipo,
    atorId: s.sub,
    acao: "LGPD_EXPORTACAO",
    detalhe: "Titular solicitou exportação dos próprios dados",
  });

  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus_dados_${s.tipo.toLowerCase()}_${s.sub}.json"`,
    },
  });
}
