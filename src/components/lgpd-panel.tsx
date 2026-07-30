"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { excluirConta } from "@/server/actions/perfil";
import { Download, ShieldAlert } from "lucide-react";

/**
 * Painel de direitos do titular (LGPD Art. 18) exibido no Perfil.
 *
 * `podeExcluir=false` (v3/SaaS): membro de empresa sem permissão para excluir a
 * conta — a exportação continua disponível, a exclusão não.
 */
export function LgpdPanel({ podeExcluir = true }: { podeExcluir?: boolean }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5 text-red-600" /> Seus dados (LGPD)</h2>
      <p className="mt-1 text-sm text-muted">
        Você tem direito de acessar, portar e eliminar seus dados pessoais (Lei nº 13.709/2018, art. 18).
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a href="/api/lgpd/export" className="inline-flex">
          <Button variant="outline" type="button"><Download className="h-4 w-4" /> Exportar meus dados (JSON)</Button>
        </a>

        {!podeExcluir ? (
          <p className="text-sm text-muted">
            A exclusão da conta da empresa afeta toda a equipe e é feita pelo Proprietário.
          </p>
        ) : !confirmando ? (
          <Button variant="danger" type="button" onClick={() => setConfirmando(true)}>Excluir minha conta</Button>
        ) : (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-300">
              Esta ação é irreversível. Seus dados pessoais serão anonimizados e você não poderá mais acessar a conta.
            </p>
            <div className="flex gap-2">
              <form action={excluirConta}>
                <SubmitButton variant="danger" size="sm" pendingLabel="Excluindo...">Confirmar exclusão</SubmitButton>
              </form>
              <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmando(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
