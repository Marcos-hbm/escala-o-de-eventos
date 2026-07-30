# v3 — Modelo SaaS: multiusuário por empresa, RBAC e planos

A v1/v2 tratavam a empresa como **um** usuário: o login era a própria linha de
`empresas`. A v3 transforma a empresa em **conta (tenant) com equipe e
assinatura**, que é como um produto de escalação é vendido de verdade: uma
produtora tem dono, coordenadores de operação e gente que só acompanha, e paga
por faixa de uso.

## 1. Modelagem

| Tabela | Papel no modelo |
| --- | --- |
| `membros` | Usuários da conta. `empresa_id`, `email` (único), `senha_hash`, `papel`, `ativo`. É por aqui que o login de empresa passa. |
| `assinaturas` | 1–1 com `empresas`: `plano`, `status`, `trial_termina_em` e ganchos `provedor`/`provedor_ref` para um PSP futuro (Stripe/pagar.me). |

Enums novos: `Papel` (PROPRIETARIO, ADMIN, COORDENADOR, VISUALIZADOR), `Plano`
(STARTER, PROFESSIONAL, ENTERPRISE) e `StatusAssinatura` (TRIAL, ATIVA,
INADIMPLENTE, CANCELADA).

A **Empresa continua sendo o tenant**: `empresa_id` já escopava eventos,
vínculos e inscrições, e a sessão de empresa continua apontando para
`empresa.id`. Por isso nenhuma consulta existente (`where: { empresaId: s.sub }`)
precisou mudar — ganhamos equipe e papéis sem reescrever o núcleo.

Migration: `20260730135450_v3_saas_membros_assinaturas`. Além do DDL gerado pelo
Prisma, ela traz um **backfill escrito à mão**: cada empresa existente recebe um
membro PROPRIETARIO com o mesmo e-mail e o mesmo hash de senha de antes (nenhuma
conta perde acesso) e uma assinatura STARTER/TRIAL. Contas anonimizadas (LGPD)
entram como membros inativos.

## 2. Autenticação por membro

- `verificarCredenciais("EMPRESA", ...)` resolve por `membros` → valida membro
  ativo + empresa ativa/não anonimizada → sessão com
  `sub` = empresa, `membroId`, `papel`, `membroNome` (`lib/session.ts`).
- `requireEmpresa()` revalida o membro no banco a cada acesso: revogação e troca
  de papel valem **no próximo request**, sem esperar o JWT expirar (8h). Quando o
  acesso foi revogado, cai em `/login?erro=acesso_revogado` com aviso na tela.
- Cadastro de empresa cria, na mesma transação, a empresa + o membro
  PROPRIETARIO + a assinatura (trial de 14 dias).
- LGPD: anonimizar a empresa também anonimiza/desativa **todos** os membros e
  cancela a assinatura — senão um membro seguiria entrando numa conta excluída.

## 3. RBAC por papel (`lib/rbac.ts`, puro)

| Papel | Pode |
| --- | --- |
| **Proprietário** | Tudo: operação, equipe, plano e exclusão da conta. |
| **Administrador** | Operação + equipe + excluir evento + editar empresa. Não troca plano nem exclui a conta. |
| **Coordenador** | Operação do dia a dia: eventos (criar/editar), escala, presença, avaliações, vínculos. |
| **Visualizador** | Somente leitura (painéis, eventos, escala em modo leitura). |

Leitura não é restringida por papel — o isolamento entre contas continua sendo o
`empresa_id`. O que os papéis controlam é **escrita**.

Aplicação em três camadas:

1. **Server actions** — `erroDePermissao(sessao, "evento:criar")` devolve a
   mensagem de negação (que diz o papel atual e quais papéis teriam acesso).
2. **Páginas** — `requirePermissao("equipe:gerenciar")` redireciona para
   `/empresa/dashboard?negado=...`, e o aviso é exibido lá
   (`components/aviso-negado.tsx`).
3. **UI** — botões/menus que o papel não pode usar não são renderizados
   (Equipe fora do menu, sem "Novo evento", escala em modo leitura).

Regras de proteção do dono: só o Proprietário atribui/retira o papel
Proprietário, a conta nunca fica sem Proprietário ativo e ninguém revoga o
próprio acesso.

## 4. Planos e gating (`lib/planos.ts` puro + `lib/assinatura.ts` I/O)

| | Starter (grátis) | Professional (R$ 149/mês) | Enterprise |
| --- | --- | --- | --- |
| Usuários da conta | 2 | 8 | ilimitado |
| Eventos ativos | 3 | 25 | ilimitado |
| Vínculos ativos/pendentes | 25 | 200 | ilimitado |
| Escalação inteligente | — | ✅ | ✅ |

- `lib/planos.ts` é **puro** (catálogo, `cabeMais`, `pctUso`, mensagens) — testado
  offline no Vitest, igual a `lib/stats.ts`. `lib/assinatura.ts` faz o I/O: lê a
  assinatura e conta o uso (`membros` ativos, eventos não encerrados, vínculos
  ATIVO+PENDENTE).
- Ao atingir um limite, a ação é bloqueada com mensagem que diz **o teto, o plano
  e como liberar espaço** ("Finalize ou cancele um evento, ou faça upgrade").
- Só as ações **da empresa** são barradas por cota; um trabalhador nunca recebe
  erro por causa do plano da empresa.
- Requisitos do TCC (RF01–RF15, incluindo o CSV da escala) **não** são gated: o
  único recurso pago é a *escalação inteligente* (score de reputação + presença,
  extra da v2). Sem ela, a lista de candidatos fica alfabética e o botão
  "⚡ Selecionar sugeridos" não aparece.
- Downgrade é recusado enquanto o uso estiver acima do plano destino (a conta não
  fica em estado inconsistente). Sem cobrança real: a troca é aplicada direto e
  os ganchos de PSP ficam vazios.

## 5. Telas novas

- **`/empresa/equipe`** (Proprietário/Administrador): consumo da cota de
  usuários, adicionar membro (nome, e-mail, senha provisória, papel), trocar
  papel, revogar/reativar acesso e a tabela "o que cada papel pode fazer".
- **`/empresa/plano`** (todos os membros): plano atual, situação da assinatura,
  fim do trial, **uso × limites** em barras e comparativo dos três planos. A
  troca de plano só aparece para o Proprietário.
- Rodapé do menu passa a mostrar `<empresa> · <papel>` e o nome do membro logado.

## 6. Verificação (executada neste ambiente)

- `npm run typecheck` — sem erros.
- `npm run build` — 24 rotas + middleware.
- `npm test` — **47/47** unitários, incluindo 19 novos (`planos.test.ts` 11,
  `rbac.test.ts` 8).
- `npm run test:e2e` (build de produção + PostgreSQL 16 real) — **77/77**,
  incluindo `saas.spec.ts` com 15 casos: login por membro, Equipe fora do menu e
  bloqueio na URL direta, visualizador em modo leitura, acesso revogado durante a
  sessão, criação/revogação de membro persistida no banco, cota de usuários,
  bloqueio do 4º evento no Starter, escalação inteligente aparecendo só no plano
  que a inclui, troca de plano persistida e downgrade recusado.
- `prisma migrate dev` + backfill conferido no banco: as duas empresas do seed
  ganharam membro PROPRIETARIO e assinatura.
