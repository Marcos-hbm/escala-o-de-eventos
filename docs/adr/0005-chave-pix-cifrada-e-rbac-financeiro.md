# ADR 0005 — Chave PIX cifrada em repouso e RBAC financeiro

- **Status:** aceito
- **Data:** 2026-07-31
- **Contexto da versão:** v4, fase 2 (modelagem)

## Contexto

A especificação do módulo financeiro pede, ao mesmo tempo, duas coisas em tensão:

- a empresa precisa **ver e copiar a chave PIX** do trabalhador para pagar;
- "apenas a empresa possa visualizar a chave PIX" e "toda alteração financeira gere
  logs de auditoria".

Chave PIX é dado pessoal sob a LGPD (identifica o titular diretamente e, no caso de
CPF/telefone/e-mail, é o próprio identificador). Guardar em texto puro significaria
que qualquer cópia do banco — backup, dump de suporte, log de query lento — entrega
as chaves de todos os trabalhadores de uma vez.

Também era preciso resolver "coordenadores autorizados": o RBAC da v3 tem quatro
papéis fixos, e a operação financeira não cabe em nenhum deles sem exceção.

## Decisão

### 1. Cifragem em repouso (AES-256-GCM)

`User.pixChaveCifrada` guarda o pacote `v1.<iv>.<tag>.<dados>` em base64url,
produzido por `lib/cripto.ts` com chave de 32 bytes vinda de `PIX_ENCRYPTION_KEY`.

- **GCM (cifra autenticada)**: além de esconder, detecta adulteração — bytes
  trocados na coluna fazem a leitura falhar em vez de devolver lixo silencioso.
- **IV aleatório por operação**: cifrar a mesma chave duas vezes dá saídas
  diferentes, então a coluna não revela quem compartilha a mesma chave.
- **Prefixo de versão**: permite trocar algoritmo/chave depois sem adivinhação.
- Não é hash: precisa ser reversível para a empresa pagar. Senha continua em bcrypt.

Sem a variável configurada, o sistema **não grava** chave (o seed avisa e segue sem
ela) — melhor um dado ausente que um dado vazado.

### 2. Leitura por um caminho único e auditado

`lib/pix-leitura.ts` é o único lugar que decifra. Ele exige, em conjunto:

1. permissão financeira de quem lê (`pix:ver`, verificada pela action/página);
2. o trabalhador estar **escalado em um evento daquela empresa** — não existe
   "listar as chaves de todos os trabalhadores";
3. registro em `audit_logs` (`PIX_VISUALIZADO`) com o membro que leu e o evento.

O trabalhador vê a própria chave **mascarada** no perfil (`an*****@exemplo.com`),
sem auditoria, porque não expõe o valor.

### 3. RBAC financeiro sem criar um quinto papel

- `Membro.autorizadoFinanceiro` (boolean) libera o financeiro para um COORDENADOR
  específico — é o "coordenador autorizado" da especificação.
- PROPRIETARIO e ADMIN têm acesso pelo papel.
- VISUALIZADOR **nunca** tem, mesmo com a flag marcada: é papel de leitura, e
  permitir o contrário seria contornar o papel por um checkbox.
- Novas permissões: `financeiro:gerenciar`, `financeiro:ver`, `pix:ver`. A função
  `podeFinanceiro(papel, permissao, flag)` concentra a regra; `sessaoPode` e
  `erroDePermissao` já a usam, então nenhuma tela decide isso por conta própria.
- A flag é revalidada no banco a cada acesso (junto com o papel), então revogar
  acesso financeiro vale no próximo request.

### 4. Invariantes no banco, não só na aplicação

A migration escreve à mão o que o Prisma não modela:

| Constraint | Por quê |
| --- | --- |
| `notificacoes_destinatario_exclusivo` (XOR user/membro) | notificação órfã ou ambígua não teria destino |
| `pagamentos_valores_nao_negativos`, `pagamentos_pago_nao_excede_devido` | dinheiro é gravado por dois caminhos (tela e fechamento de caixa) |
| `pagamento_lancamentos_valor_positivo` | lançamento de R$ 0 não é pagamento |
| `avaliacoes_notas_1_a_5` | inclui os cinco critérios novos |
| índice parcial `trabalhador_bloqueios_vigente_unico` | um bloqueio vigente por par, preservando histórico |
| índice parcial `contestacoes_abertas_unica_por_pagamento` | evita fila de contestações duplicadas |

## Consequências

**Positivas**

- Vazamento do banco sozinho não expõe chaves PIX.
- Existe trilha de quem viu qual chave, quando e em qual evento — exigência do item
  13 e prova de conformidade LGPD.
- A regra do financeiro está em função pura testada (16 casos em `rbac.test.ts`) e
  as invariantes de dinheiro, provadas contra o PostgreSQL real
  (`tests/integration/schema-v4.test.ts`).

**Negativas / limites aceitos**

- **Não há busca por chave PIX** (a coluna é cifrada com IV aleatório). Nenhuma tela
  precisa disso hoje; se precisar, exigiria índice cego (HMAC determinístico), que é
  outra decisão.
- **Rotação de chave** exige processo próprio: decifrar com a antiga e regravar com
  a nova. Trocar `PIX_ENCRYPTION_KEY` sem isso torna as chaves ilegíveis (a leitura
  falha com mensagem explícita, não silenciosamente).
- A chave de cifragem fica em variável de ambiente: quem tem acesso ao servidor
  **e** ao banco consegue decifrar. Um KMS/HSM elevaria isso, ao custo de
  infraestrutura que o projeto não tem.
- `autorizadoFinanceiro` é um booleano por membro. Se no futuro houver mais
  dimensões (só ver, só lançar, só fechar caixa), o caminho é promover para papéis
  compostos em vez de acumular flags.
