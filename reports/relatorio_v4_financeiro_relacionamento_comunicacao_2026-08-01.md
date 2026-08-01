# Relatório de QA — Escala v4 (financeiro, relacionamento e comunicação do evento)

| Campo | Valor |
| --- | --- |
| **Data** | 2026-08-01 |
| **Executor** | Marcos Hamilton Barbosa Morato |
| **Ticket** | N/A — TCC (UDF, 2025) + especificação de produto v4 (15 itens) |
| **Ambiente** | Node v22.23.1 · Next.js 16.2.12 · PostgreSQL 16.14 (container `escala-postgres`, up 4 dias, healthy) · Playwright 1.61.1 / Chromium |
| **Build sob teste** | produção (`next start`) na porta 3100 |
| **Método** | Automação: Vitest (unitário + integração com banco real) + Playwright (E2E). Dados isolados por teste via fixtures (`uid()` com `process.pid`). Evidência de banco coletada por `psql` direto no container. |

## 1. Objetivo

Validar a v4 — fluxo pós-evento (pagamentos, fechamento de caixa, contestação),
relacionamento (avaliação por critérios, favoritos, bloqueio), comunicação durante o
evento e painel do coordenador — sem regressão nos requisitos do TCC (RF01–RF15,
RNF01–RNF07) nem no SaaS da v3. Em particular: confirmar que as regras de dinheiro,
permissão financeira e cifragem da chave PIX são impostas **no servidor e no banco**,
não só na tela.

## 2. Escopo testado

Entrou:

- **Item 1** — data/hora no padrão BR (`DD/MM/AAAA`, `HH:mm`, fuso de Brasília) em
  telas, cards, notificações e CSV.
- **Itens 2, 6, 9, 10** — tela "Finalizar pagamentos", pagamento total/parcial,
  estorno, troca de forma, fechamento de caixa, contestação, históricos financeiros
  (empresa e trabalhador) e indicador ✅/⏳.
- **Itens 3, 4, 5** — avaliação em 5 critérios com nota geral derivada, favoritos,
  bloqueio com motivo e seus efeitos reais.
- **Itens 7, 8** — canal do evento (6 tipos, 5 status, janela no dia), painel do
  coordenador, mensagens, check-in/check-out.
- **Itens 11, 13** — modelagem (21 tabelas), CHECK constraints e índices parciais;
  RBAC financeiro, PIX cifrado e trilha de auditoria.
- **Item 12** — UX: empty states, filtros, paginação no banco, tema, aviso de
  resultado renderizado no servidor, confirmação em ação destrutiva.
- Regressão completa das suítes v1/v2/v3.

Ficou **fora** desta validação (não testado, não afirmado):

- Carga/desempenho e disponibilidade (RNF02) — nenhum teste de carga foi executado.
- Acessibilidade (WCAG) além de `role`/rótulo usados pelos seletores.
- Cross-browser: só **Chromium**. Firefox/WebKit/mobile não foram executados.
- PDF e envio de e-mail — **não existem no produto** (declarado em
  `docs/CASOS_DE_USO.md`); não há o que testar.
- Cobrança real de assinatura (sem provedor de pagamento integrado).
- Rotação da chave `PIX_ENCRYPTION_KEY` (procedimento não implementado).

## 3. Resultados

### 3.1 Qualidade de build e migrations

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Migrations aplicadas | `npx prisma migrate status` | ✅ `4 migrations found in prisma/migrations` · `Database schema is up to date!` |
| Seed | `npm run db:seed` | ✅ `✅ Seed concluído.` + `v4: pagamentos (pago/parcial/pendente), favorito, bloqueio, solicitação e mensagem criados` |
| Typecheck | `npx tsc --noEmit` | ✅ saída vazia, `TYPECHECK_EXIT=0` |
| Build de produção | `npm run build` | ✅ `✓ Compiled successfully in 2.8s`; `✓ Generating static pages using 11 workers (24/24) in 254ms`; **29 rotas** |
| App no ar | `curl -o /dev/null -w %{http_code} http://localhost:3100/login` | ✅ `200` |

### 3.2 Unitários e integração (Vitest)

```
 ✓ tests/integration/schema-v4.test.ts (12 tests) 165ms
 ✓ tests/integration/pix-leitura.test.ts (6 tests) 155ms
 ✓ tests/unit/datetime.test.ts (18 tests) 20ms
 ✓ tests/unit/comunicacao.test.ts (16 tests) 16ms
 ✓ tests/unit/validations.test.ts (14 tests) 8ms
 ✓ tests/unit/rbac.test.ts (16 tests) 7ms
 ✓ tests/unit/pagamento.test.ts (15 tests) 13ms
 ✓ tests/unit/avaliacao.test.ts (14 tests) 5ms
 ✓ tests/unit/paginacao.test.ts (14 tests) 9ms
 ✓ tests/unit/pix.test.ts (13 tests) 4ms
 ✓ tests/unit/planos.test.ts (11 tests) 3ms
 ✓ tests/unit/cripto.test.ts (10 tests) 9ms
 ✓ tests/unit/csv.test.ts (7 tests) 17ms
 ✓ tests/unit/flash.test.ts (8 tests) 5ms
 ✓ tests/unit/stats.test.ts (10 tests) 3ms
 ✓ tests/unit/navegacao.test.ts (4 tests) 2ms
 ✓ tests/unit/validators-doc.test.ts (6 tests) 3ms

 Test Files  17 passed (17)
      Tests  194 passed (194)
   Duration  3.32s
```

As duas suítes de `integration/` rodam contra o **PostgreSQL real** (não mock): é ali
que as CHECK constraints e o caminho de leitura auditada da chave PIX são exercidos
pelo código de produção.

### 3.3 E2E (Playwright, build de produção)

Três execuções consecutivas da suíte inteira contra `http://localhost:3100`:

```
123 passed (49.2s)     # rodada 1
123 passed (57.7s)     # rodada 2
123 passed (57.3s)     # rodada 3
```

Distribuição por arquivo (via `npx playwright test --list`), total 123:

| Área | Arquivo | Testes | Requisito / item |
| --- | --- | --- | --- |
| SaaS: equipe, RBAC, plano | `saas.spec.ts` | 15 | v3 |
| Financeiro: pagamentos, caixa, contestação, PIX, RBAC | `financeiro.spec.ts` | 13 | itens 2, 6, 9, 10, 13 |
| Comunicação e painel do coordenador | `comunicacao.spec.ts` | 13 | itens 7, 8 |
| UX: datas BR, tema, paginação, empty state, aviso | `ux.spec.ts` | 10 | itens 1, 12 |
| Favoritos, bloqueio e critérios no histórico | `relacionamento.spec.ts` | 10 | itens 3, 4, 5 |
| Cadastro | `cadastro.spec.ts` | 9 | RF01/RF02 |
| Vínculos | `vinculos.spec.ts` | 6 | RF06/RF07 |
| Segurança e IDOR | `seguranca.spec.ts` | 6 | RNF03 |
| Login | `login.spec.ts` | 6 | RF03 |
| Painéis, presença e avaliação | `v2.spec.ts` | 5 | v2 + item 3 |
| Inscrições | `inscricoes.spec.ts` | 5 | RF09/RF13/RF14 |
| Eventos (inclui confirmação de exclusão) | `eventos.spec.ts` | 5 | RF05 + item 12 |
| Escalação e CSV | `escala.spec.ts` | 5 | RF10/RF11 |
| Smoke | `smoke.spec.ts` | 4 | — |
| LGPD | `lgpd.spec.ts` | 4 | RNF03 |
| Jornada completa | `fluxo-completo.spec.ts` | 4 | RF05→RF12 |
| Histórico e notificações | `historico-notificacoes.spec.ts` | 3 | RF12/RF15 |

Cobertura declarada por caso de teste: matriz **CT-01…CT-148** em
`docs/CASOS_DE_TESTE.md`.

### 3.4 Invariantes no banco (item 11) — tentativas reais de violação

Executadas por `psql` dentro do container, cada uma em transação com `ROLLBACK`
(nenhum dado alterado). Saída literal do PostgreSQL:

```
ERROR:  new row for relation "pagamentos" violates check constraint "pagamentos_pago_nao_excede_devido"
DETAIL:  Failing row contains (229, 3075, 2191, 3515, 200.00, 201.00, PAGO, PIX, ...)

ERROR:  new row for relation "avaliacoes" violates check constraint "avaliacoes_notas_1_a_5"
DETAIL:  Failing row contains (156, 3107, 3550, 2225, EMPRESA, 4, null, ..., 5, 2, 5, 6, 4)

ERROR:  new row for relation "notificacoes" violates check constraint "notificacoes_destinatario_exclusivo"

ERROR:  new row for relation "pagamento_lancamentos" violates check constraint "pagamento_lancamentos_valor_positivo"

ERROR:  duplicate key value violates unique constraint "trabalhador_bloqueios_vigente_unico"
DETAIL:  Key (empresa_id, user_id)=(3484, 2165) already exists.

ERROR:  duplicate key value violates unique constraint "contestacoes_abertas_unica_por_pagamento"
DETAIL:  Key (pagamento_id)=(236) already exists.
```

✅ As seis invariantes que a aplicação promete (pago ≤ devido, nota 1..5, destinatário
exclusivo da notificação, lançamento > 0, um bloqueio vigente por par, uma contestação
em aberto por pagamento) são impostas pelo banco, não apenas pelo código.

### 3.5 Chave PIX: cifrada em repouso e leitura auditada (item 13)

Conteúdo real da coluna (nenhuma chave em claro):

```
 pix_tipo |                 pacote_inicio                  | tam
----------+------------------------------------------------+-----
 EMAIL    | v1._olOd0v5KjJg1Hal.fvzV5L5kwQIh70Tdl-61GA.k7f |  71
 EMAIL    | v1.2MPtR2vVeCa7ErLa.mEN1bf_KxEPfrfBtmlb6qw.kh_ |  71
```

Formato `v1.iv.tag.dados` (AES-256-GCM, IV aleatório por operação — os dois registros
têm IV distintos).

Cada leitura pela empresa gera log, e o log **não** contém a chave:

```
 ator_tipo |      acao       | entidade |                          detalhe                           | ip
-----------+-----------------+----------+------------------------------------------------------------+-----
 EMPRESA   | PIX_VISUALIZADO | User     | por Empresa E2E msarlnnjelvj1p · evento 3272 · chave EMAIL | ::1
 EMPRESA   | PIX_VISUALIZADO | User     | por Empresa E2E msarketjek3v1i · evento 3175 · chave EMAIL | ::1
```

### 3.6 Trilha de auditoria (RNF07)

Ações distintas registradas em `audit_logs` após as três execuções (contagem 3 =
uma por rodada; 6/9/12 = ações exercidas por mais de um teste):

| Domínio | Ações registradas (contagem) |
| --- | --- |
| Financeiro | `PAGAMENTO_QUITADO` (6), `PAGAMENTO_PARCIAL` (3), `PAGAMENTO_ESTORNADO` (3), `FECHAMENTO_INICIADO` (3), `FECHAMENTO_ITEM_REGISTRADO` (3), `FECHAMENTO_CONCLUIDO` (3), `CONTESTACAO_ABERTA` (3), `CONTESTACAO_RESPONDIDA` (3) |
| PIX | `PIX_CADASTRADO` (3), `PIX_VISUALIZADO` (3) |
| Relacionamento | `FAVORITO_ADICIONADO` (3), `FAVORITO_REMOVIDO` (3), `TRABALHADOR_BLOQUEADO` (3), `TRABALHADOR_DESBLOQUEADO` (3), `AVALIACAO_TRABALHADOR` (3), `AVALIACAO_EMPRESA` (3) |
| Comunicação | `SOLICITACAO_ABERTA` (6), `SOLICITACAO_RESPONDIDA` (3), `MENSAGEM_COORDENACAO` (3), `CHECKIN_REGISTRADO` (3), `CHECKOUT_REGISTRADO` (3), `PRESENCA_CONFIRMADA` (3) |
| SaaS / TCC | `LOGIN` (333), `LOGIN_FALHA` (12), `MEMBRO_CRIADO` (6), `MEMBRO_DESATIVADO` (3), `PLANO_ALTERADO` (3), `EVENTO_CRIADO` (12), `ESCALA_FINALIZADA` (6), `LISTA_EXPORTADA` (9), `LGPD_EXPORTACAO` (3), `LGPD_ANONIMIZACAO` (3), … |

Total: **44 ações distintas** na trilha.

### 3.7 Artefato real — CSV da escala (RF11 + item 1)

Amostra gerada nesta sessão (evento criado só para a amostra e **removido depois**;
`cat` do arquivo baixado pelo endpoint autenticado):

```
﻿Evento;Show de Encerramento msarohpteofv4
Data;20/12/2026
Hora de início;-
Local;Local E2E
Cachê (R$);"1.234,50"

Nome;CPF;Telefone;E-mail;Função;Status
Ana Amostra msarohpneofv2;660.875.388-87;61988880000;trab_msarohpoeofv3@e2e.test;Apoio;PRESENTE
```

✅ BOM UTF-8 no início, separador `;`, data `DD/MM/AAAA`, valor com ponto de milhar e
vírgula decimal — abre direto no Excel pt-BR.

### 3.8 Export LGPD (Art. 18, II e V)

Recorte real do JSON do próprio titular (trabalhador autenticado):

```json
{
  "geradoEm": "2026-08-01T19:31:10.488Z",
  "titular": { "tipo": "TRABALHADOR", "id": 2388 },
  "dadosPessoais": {
    "nome": "Ana Amostra msarohpneofv2",
    "email": "trab_msarohpoeofv3@e2e.test",
    "cpf": "66087538887",
    "pixTipo": null,
    "pixChaveCifrada": null,
    "anonimizadoEm": null
  }
}
```

✅ Sem `senhaHash`. Os dados temporários da amostra (evento, trabalhador, empresa,
membro e assinatura) foram apagados ao fim da coleta.

## 4. Achados

### 4.1 Defeitos de produto encontrados e corrigidos nesta entrega (🐛→✅)

| Achado | Efeito real | Correção | Como foi pego |
| --- | --- | --- | --- |
| `estadoDoEvento` usava o formatador de **data civil (UTC)** para decidir "hoje" | entre 21h e a meia-noite, o evento **do dia** aparecia como encerrado e o canal de comunicação fechava antes da hora | `diaCivilBR()` (fuso de Brasília) em `lib/datetime.ts` | teste unitário, antes de chegar à UI |
| Campos opcionais rejeitavam `null` vindo de `formData.get()` | ajuste de pagamento sem observação era recusado com erro de validação | `textoOpcional()` + regressão | a própria mensagem de flash na tela |
| Formatação de dinheiro dentro do domínio | risco de divergência de formato entre telas | centralizado em `lib/dinheiro.ts` | teste de guarda |
| Ação destrutiva (excluir evento) sem confirmação — lacuna do item 12 | um clique apagava o evento, inscrições e escala | `components/confirmar-acao.tsx` (duas etapas), CT-148 | revisão do item 12 contra a especificação |

### 4.2 Ajustes de harness/tooling (não são bugs do produto)

- `.next` compartilhado entre `next dev` e `next start` fazia todo `/_next/static/*`
  responder 400 e a app nunca hidratar — **era esta a causa do "CSS quebrando"**
  relatado. Procedimento: limpar `.next` e rodar E2E sempre com `E2E_BASE_URL`.
- `uid()` colidia entre workers do Playwright → passou a incluir `process.pid`.
- Cliques antes da hidratação eram engolidos → `MarcaHidratacao` + `irPara()`.
- Seletores: `getByRole("alert")` colidia com o *route announcer* do Next (→
  `data-testid`) e `getByLabel` casava por substring (→ `exact: true`).
- `Intl` pt-BR usa NBSP depois de "R$": o teste normaliza ` `.

### 4.3 Observações de arquitetura e ambiente

- **Residual conhecido (ADR 0004)**: 0–1 de ~123 testes por execução em que o cliente
  não aplicava o resultado da action (POST 200, banco correto, sem erro no console).
  Nas **três** rodadas desta sessão o residual **não** apareceu (123/123 em todas),
  mas três execuções não provam ausência — o ADR fica registrado. A mitigação
  arquitetural (formulários renderizados no servidor + aviso na URL) é o que reduziu
  isso de 3/12 para 0. **Este item foi revisto no mesmo dia: ver o adendo (§7)** — a
  taxa por tela era muito maior do que esta seção sugere, e a causa foi identificada.
- "Tempo real" da comunicação é **polling de 15 s** isolado em um componente
  (ADR 0007), não WebSocket. É a decisão registrada, não uma limitação escondida.
- O export LGPD inclui a coluna `pixChaveCifrada` (texto cifrado). Não vaza nada —
  é o próprio titular pedindo os próprios dados —, mas é um campo inútil no pacote;
  vale trocar por um booleano "chave cadastrada".
- O status de assinatura `INADIMPLENTE` existe no enum, mas **nenhuma regra o
  consome** (não há cobrança integrada).
- PostgreSQL roda em container local; não houve teste em ambiente gerenciado.

## 5. Recomendação

1. **Antes de produção**: teste de carga (RNF02), auditoria de acessibilidade (WCAG),
   execução cross-browser (Firefox/WebKit e viewport mobile).
2. **Chave de cifragem**: definir guarda e **rotação** de `PIX_ENCRYPTION_KEY` (hoje o
   pacote é versionado `v1.`, o que permite rotação, mas o procedimento não existe).
   Sem a variável, a leitura da chave é recusada com motivo — comportamento correto,
   mas precisa estar no runbook de deploy.
3. **CI**: rodar `typecheck → build → vitest → playwright` em pipeline, com o Postgres
   como serviço; hoje tudo é local.
4. **Item 6 (futuro declarado)**: anexo de comprovante na contestação.
5. **Item 4 (futuro declarado)**: usar a lista de favoritos para sugerir escalação.
6. Substituir `pixChaveCifrada` por um indicador booleano no export LGPD.
7. Quando entrar cobrança real, dar consumidor ao status `INADIMPLENTE`.

## 6. Conclusão

Os 15 itens da especificação v4 estão **implementados e verificados por automação**
nesta sessão: 194/194 unitários e de integração, 123/123 E2E em três execuções
consecutivas contra o build de produção, invariantes financeiras e de relacionamento
recusadas pelo próprio PostgreSQL, chave PIX cifrada em repouso com leitura auditada e
44 ações distintas na trilha de auditoria. O que **não** foi validado — carga,
acessibilidade, cross-browser, rotação de chave e cobrança real — está listado no
escopo e nas recomendações; o sistema não pode ser declarado *validado para produção*
enquanto esses pontos não forem cobertos.

---

## 7. Adendo (2026-08-01, após o fechamento acima)

Uma verificação seguinte, executada por causa de outra mudança, expôs que o residual
do ADR 0004 estava **subestimado** para telas específicas. O que estava escrito em
§3.3 e §4.3 é verdade sobre o que foi medido (três rodadas completas, 123/123), mas
esconde a concentração por tela.

### 7.1 O que apareceu

Repetindo **só** o grupo "Plano e assinatura": **4 de 10 rodadas com falha**. Com a
mudança daquele momento revertida (`git stash` + rebuild), **4 de 10** também — logo,
não era regressão nova.

### 7.2 Como foi investigado

Harness de 16 iterações independentes do fluxo (criar empresa → login →
`/empresa/plano` → clicar "Mudar para Professional"), 2 workers como na suíte real,
comparando **tela × banco** em cada iteração e registrando se o `POST` da action foi
pelo caminho do router (cabeçalho `next-action`) ou nativo.

Em todas as falhas: `db=PROFESSIONAL`, `PLANO_ALTERADO` gravado na auditoria, `POST`
pelo caminho do router, nenhum erro de console — e um `reload` já mostrava o valor
novo. A troca acontece; o cliente descarta o resultado.

| Variante | Tela velha |
| --- | --- |
| Trocar plano — segmento com `loading.tsx` | 4 de 16 |
| Trocar plano — sem o `revalidatePath` de outra rota | 3 de 16 (sem efeito) |
| **Trocar plano — sem `loading.tsx` no segmento** | **0 de 48** |
| Convidar trabalhador (`/empresa/vinculos`) — com `loading.tsx` | 5 de 64 |
| **Convidar trabalhador — sem `loading.tsx`** | **0 de 64** |
| Equipe — adicionar membro (skeleton mantido) | 0 de 64 |
| Notificações — marcar todas como lidas (skeleton mantido) | 0 de 64 |

Hipóteses descartadas por medição: `revalidatePath` de outra rota; clique antes da
hidratação (o cabeçalho `next-action` estava presente inclusive nas falhas); "`loading.tsx`
é ruim em qualquer tela" (duas telas com ele não reproduzem); "dado lento abre a janela
do defeito" (300 ms de atraso artificial em Notificações: 0 de 12).

### 7.3 Correção aplicada

Removidos `loading.tsx` dos dois segmentos onde o defeito foi medido (`empresa/plano`,
`empresa/vinculos`); skeleton mantido onde a medição não acusou nada. Como a correção
é a **ausência** de um arquivo, há guarda de regressão
(`tests/unit/fronteiras-loading.test.ts`) fixando as duas listas, comentário no
cabeçalho das duas páginas e o registro no
[ADR 0004](../docs/adr/0004-atualizacao-de-tela-apos-server-action.md).

### 7.4 Números finais desta sessão (substituem §3.2 e §3.3)

| Verificação | Resultado |
| --- | --- |
| `tsc --noEmit` | sem erros |
| `npm run build` | `✓ Compiled successfully` |
| Vitest | **200/200** (18 arquivos — inclui os 2 testes novos de export LGPD e os 4 da guarda de fronteiras) |
| Playwright, build de produção (:3100) | **125/125 em 5 rodadas consecutivas** (625 execuções, nenhuma falha) |
| Grupo "Plano e assinatura", 10 rodadas | 0 falhas (antes: 4) |

### 7.5 O que continua aberto

O gatilho interno do router **não** foi explicado — foi removido dessas telas. Não
afirmo que o residual do ADR 0004 acabou: a diferença entre as telas que reproduzem e
as que não reproduzem é a pista que falta, e é o que deve ser levado ao projeto Next
junto com o loop reprodutível.
