import { AlertTriangle } from "lucide-react";
import { mensagemPermissao, ORDEM_PAPEIS, pode, rotuloPapel, type PapelId, type Permissao } from "@/lib/rbac";

const PERMISSOES_CONHECIDAS: Permissao[] = [
  "evento:criar",
  "evento:editar",
  "evento:excluir",
  "escala:gerenciar",
  "presenca:marcar",
  "avaliacao:registrar",
  "vinculo:gerenciar",
  "empresa:editar",
  "equipe:gerenciar",
  "plano:gerenciar",
  "conta:excluir",
];

/**
 * Aviso exibido quando o RBAC redireciona o membro para fora de uma tela
 * (`?negado=<permissao>`): diz o papel atual e quais papéis teriam acesso.
 */
export function AvisoNegado({ negado, papel }: { negado?: string; papel: PapelId }) {
  if (!negado) return null;
  const permissao = PERMISSOES_CONHECIDAS.find((p) => p === negado);
  const texto = permissao
    ? mensagemPermissao(papel, permissao)
    : `Seu papel (${rotuloPapel(papel)}) não permite acessar esta área.`;
  // Sanidade: se o papel de fato pode, não há o que avisar (link antigo).
  if (permissao && pode(papel, permissao) && ORDEM_PAPEIS.includes(papel)) return null;

  return (
    <div
      role="alert"
      data-testid="aviso-negado"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{texto}</span>
    </div>
  );
}
