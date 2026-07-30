# Relatório de QA — Sistema de Escalação de Freelancers (v3 — modelo SaaS)

| Campo | Valor |
| --- | --- |
| **Data** | 2026-07-30 |
| **Executor** | Marcos Hamilton Barbosa Morato |
| **Ticket** | N/A — TCC (Centro Universitário do Distrito Federal – UDF, 2025) |
| **Produto** | Sistema de Escalação de Freelancers (web) — incremento v3 (SaaS) |
| **Ambiente** | Node.js v22.23.1 · Next.js 15.5.21 · PostgreSQL 16.14 (container Docker `escala-postgres`, `localhost:5432`) · Chromium (Playwright 1.61.1) |
| **Build sob teste** | Build de produção (`next build` + `next start`) na porta **3100** |
| **Método** | Automação: Vitest (unitário, sem banco) + Playwright (E2E em navegador real). Dados criados isoladamente por teste via fixtures (CPF/CNPJ válidos gerados, e-mails com sufixo único). |

---

## 1. Objetivo

Validar o incremento **v3**, que transforma a conta de empresa em um tenant SaaS:
login por **membro** (tabela `membros`), **RBAC por papel** dentro da empresa e
**gating por plano** via `assinaturas`. Duas perguntas guiaram a execução: (a) o
novo modelo de identidade quebrou algum requisito já implementado do TCC
(RF01–RF15 / RNF01–RNF07)? (b) as novas regras — papéis, cotas e troca de plano —
se comportam como especificado, com evidência de banco?

## 2. Escopo testado

Dentro do escopo:

- Migration `20260730135450_v3_saas_membros_assinaturas` com backfill de membro
  PROPRIETARIO + assinatura para empresas existentes.
- Login de empresa por `membros`; sessão com `membroId`/`papel`; revogação de
  acesso durante a sessão.
- RBAC (Proprietário, Administrador, Coordenador, Visualizador) em server
  actions, páginas (`requirePermissao`) e UI.
- Cotas de plano (usuários, eventos ativos, vínculos) e a feature paga
  *escalação inteligente*; troca de plano e recusa de downgrade.
- **Regressão completa** das suítes anteriores (v1 + v2), para detectar quebra
  causada pela troca do modelo de login.

Fora do escopo nesta execução (não coletado / não verificado):

- Carga e desempenho (RNF02) — nenhum teste de carga executado.
- Acessibilidade (WCAG) e cross-browser: só Chromium.
- Cobrança real: não há integração com PSP; a troca de plano é aplicada direto
  (ganchos `provedor`/`provedor_ref` permanecem vazios).
- Amostra nova do CSV de escala (RF11): não recoletada nesta sessão — o caso
  segue coberto pelos asserts de `escala.spec.ts` e há amostra real no relatório
  de 2026-07-24.
- Fluxo de recuperação de senha para membros (não implementado): a senha
  provisória é definida por quem convida.

## 3. Resultados

### 3.1 Qualidade de build

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Tipos | `npm run typecheck` (`tsc --noEmit`) | ✅ sem saída de erro |
| Build de produção | `npm run build` | ✅ **24 rotas + middleware** compilados (novas: `/empresa/equipe`, `/empresa/plano`) |
| Migrations | `npx prisma migrate status` | ✅ `3 migrations found` · `Database schema is up to date!` |
| App no ar | `PORT=3100 npm start` + `curl` | ✅ `/` → 200 · `/login?tipo=EMPRESA` → 200 · `/empresa/eventos` sem sessão → 307 |

### 3.2 Testes unitários (Vitest)

```
 ✓ tests/unit/csv.test.ts (3 tests) 5ms
 ✓ tests/unit/validators-doc.test.ts (6 tests) 6ms
 ✓ tests/unit/rbac.test.ts (8 tests) 7ms
 ✓ tests/unit/planos.test.ts (11 tests) 10ms
 ✓ tests/unit/stats.test.ts (10 tests) 10ms
 ✓ tests/unit/validations.test.ts (9 tests) 19ms

 Test Files  6 passed (6)
      Tests  47 passed (47)
```

✅ **47/47**, dos quais **19 novos** da v3: `planos.test.ts` (catálogo, `cabeMais`
no limite exato, `pctUso` saturando em 100, ilimitado = `null`, mensagens de
bloqueio) e `rbac.test.ts` (Proprietário ⊇ todos os papéis, Visualizador sem
nenhuma escrita, Coordenador sem equipe/plano, Administrador sem plano/exclusão
de conta, papéis atribuíveis).

### 3.3 E2E (Playwright, build de produção + PostgreSQL real)

```
77 passed (22.7s)
```

| Suíte | Área | Resultado |
| --- | --- | --- |
| `cadastro.spec.ts` | RF01/RF02 + LGPD | ✅ 9/9 |
| `login.spec.ts` | RF03 | ✅ 6/6 |
| `eventos.spec.ts` | RF05 | ✅ 5/5 |
| `vinculos.spec.ts` | RF06/RF07 | ✅ 6/6 |
| `inscricoes.spec.ts` | RF08/RF09/RF13/RF14 | ✅ 5/5 |
| `escala.spec.ts` | RF10/RF11 | ✅ 5/5 |
| `historico-notificacoes.spec.ts` | RF12/RF15 | ✅ 3/3 |
| `lgpd.spec.ts` | LGPD Art. 18 | ✅ 4/4 |
| `seguranca.spec.ts` | RNF03 (RBAC de conta, IDOR) | ✅ 6/6 |
| `fluxo-completo.spec.ts` | jornada completa | ✅ 4/4 |
| `v2.spec.ts` | painéis, presença, avaliação | ✅ 5/5 |
| `smoke.spec.ts` | páginas públicas | ✅ 4/4 |
| **`saas.spec.ts`** | **v3: membro, RBAC, planos** | ✅ **15/15** |

Casos novos que sustentam as regras da v3 (todos verificados na UI e, quando
aplicável, no banco):

| Caso | Verificação |
| --- | --- |
| Login por membro | Coordenador entra e o menu mostra `<empresa> · Coordenador` |
| RBAC em URL direta | `/empresa/equipe` redireciona para `/empresa/dashboard?negado=equipe%3Agerenciar` + aviso citando o papel (status HTTP não coletado) |
| Visualizador | sem link "Novo evento"; `/empresa/eventos/novo` → `?negado=evento%3Acriar`; tela de escalar em modo leitura, sem botão de finalizar |
| Revogação em sessão ativa | `membros.ativo=false` aplicado direto no banco → próximo acesso cai em `/login?tipo=EMPRESA&erro=acesso_revogado` com aviso |
| Criação de membro | UI → `prisma.membro` com `papel=COORDENADOR` e `empresaId` correto |
| Revogação pela UI | `ativo=false` confirmado no banco |
| Cota de usuários (Starter=2) | 2º membro presente → "Cota de usuários esgotada" e formulário de convite não renderizado |
| Cota de eventos (Starter=3) | 3 eventos ativos → aviso "Limite do plano Starter atingido" e botão "Novo evento" ausente; mesma conta em Professional cria o 4º com sucesso |
| Feature paga | "⚡ Selecionar sugeridos" ausente no Starter (com link para Plano) e presente após `definirPlano(PROFESSIONAL)` |
| Troca de plano | `assinaturas.plano=PROFESSIONAL`, `status=ATIVA` conferidos no banco |
| Downgrade inconsistente | 4 eventos ativos → recusa "acima do limite em 4 eventos ativos"; assinatura permanece PROFESSIONAL |
| Permissão de plano | Coordenador vê a tela de Plano, sem botões de troca |

### 3.4 Migration e backfill (evidência de banco)

Após `prisma migrate dev`, consulta direta no PostgreSQL:

```
 id | empresa_id |          email          |    papel     | ativo
----+------------+-------------------------+--------------+-------
  1 |        244 | contato@cenaviva.com.br | PROPRIETARIO | t
  2 |        245 | rh@bsbfeiras.com.br     | PROPRIETARIO | t

 empresa_id |  plano  | status
------------+---------+--------
        244 | STARTER | TRIAL
        245 | STARTER | TRIAL
```

✅ As duas empresas pré-existentes ganharam membro PROPRIETARIO com **o mesmo
e-mail e o mesmo hash de senha** de antes (login preservado) e assinatura. Após o
`db:seed` da v3, a distribuição de papéis passou a incluir os membros de
demonstração:

```
    papel     | count
--------------+-------
 PROPRIETARIO |   179
 COORDENADOR  |    29
 VISUALIZADOR |     9
```

(os números altos vêm das empresas criadas pelas execuções de E2E — cada teste
cria a própria conta.)

### 3.5 Trilha de auditoria (RNF07)

As ações novas gravam log com o **membro que agiu** — antes o log só sabia dizer
"a empresa":

```
       acao        |                                detalhe
-------------------+-----------------------------------------------------------------------
 PLANO_ALTERADO    | STARTER → PROFESSIONAL (por Empresa E2E ms7lqimq1g)
 MEMBRO_CRIADO     | por Empresa E2E ms7lqgzj17: novo_ms7lqgzp18@e2e.test como Coordenador
 MEMBRO_DESATIVADO | por Empresa E2E ms7lqgzv1h: membro_ms7lqgzz1i@e2e.test
```

Contagem no período: `MEMBRO_CRIADO` 4 · `MEMBRO_DESATIVADO` 4 ·
`PLANO_ALTERADO` 4 · `LOGIN` 195 · `CADASTRO` 6. O `LOGIN` de empresa agora
registra em `detalhe` qual membro entrou e com qual papel:

```
 acao  |                    detalhe
-------+-----------------------------------------------
 LOGIN | membro emp_ms7ls3x22a@e2e.test (PROPRIETARIO)
```

## 4. Achados

**4.1 🐛→✅ (produto) — `destroySession()` durante o render.** A primeira versão
de `requireEmpresa()` apagava o cookie ao detectar membro desativado. O Next 15
não permite mutar cookies em Server Component: o acesso revogado resultava em erro
de render em vez de redirecionamento, e o membro continuava vendo a página.
Corrigido: a função apenas redireciona para `/login?erro=acesso_revogado` (o
cookie deixa de valer porque toda tela da empresa revalida o membro no banco) e a
tela de login exibe o aviso. Reverificado pelo caso "acesso revogado durante a
sessão" (✅).

**4.2 Ajuste de harness (não é bug de produto) — fixtures da v3.** `novaEmpresa()`
criava só a linha de `empresas`; com o login resolvendo por `membros`, nenhuma
empresa de teste conseguiria autenticar. A fixture passou a criar empresa +
membro PROPRIETARIO + assinatura (com parâmetro `plano`), mais `novoMembro()` e
`definirPlano()`. Nenhum assert das suítes antigas precisou mudar — indício de que
o tenant continuou sendo `empresa_id`.

**4.3 Ajuste de harness — seletores.** Dois casos novos usavam `getByRole("alert")`,
que colide com o *route announcer* do Next (`#__next-route-announcer__`), e
`getByRole("heading", { name: "Plano" })`, que casava com três títulos. Trocados
por `data-testid="aviso-negado"` / `exact: true`.

**4.4 Ambiente — servidor de desenvolvimento em conflito.** Um `next dev` de
sessão anterior seguia rodando na porta 3000 e recompilava para o mesmo diretório
`.next`, corrompendo o build de produção (`Cannot find module './vendor-chunks/…'`).
Encerrado com autorização do executor; a suíte rodou contra `npm start` na 3100.
Não é defeito do produto, mas vale como procedimento: **não rodar E2E de produção
com um `next dev` ativo no mesmo projeto**.

**4.5 🐛→✅ (produto, encontrado em navegação manual pós-suíte) — copy da tela de
escalar para papel somente-leitura.** No evento FINALIZADO, o texto de abertura
dizia "Marque a presença e avalie." também para o Visualizador, que não tem os
botões de presença nem o formulário de avaliação — instrução impossível de
cumprir. Corrigido: o texto passa a depender de `podeMarcarPresenca || podeAvaliar`
("Seu papel permite apenas acompanhar presença e avaliações (somente leitura)").
Reverificado em duas etapas: `typecheck` limpo + `playwright test saas.spec.ts
v2.spec.ts escala.spec.ts` → **25/25** contra o dev server e, em seguida, **rebuild
de produção e suíte inteira reexecutada** → `npm test` **47/47** e
`playwright test` **77 passed (22.7s)** contra `npm start` na 3100. Ou seja: os
números da seção 3 valem para a árvore final, já com esta correção.

**4.6 Dívidas conhecidas (documentadas, não corrigidas).**
`empresas.email`/`senha_hash` continuam existindo sem autenticar (remoção exige
migration de limpeza); `membros.email` é único globalmente, então a mesma pessoa
não pode ser membro de duas empresas com o mesmo e-mail. Ambas registradas no
ADR 0001 com o motivo de aceitação.

**4.7 Efeito colateral aceito no gating de vínculos.** Só ações **da empresa** são
barradas por cota — um trabalhador nunca recebe erro por causa do plano da
empresa. Consequência: pedidos de vínculo recebidos podem levar a conta ao teto, e
aí a empresa não convida nem aceita mais ninguém até liberar espaço. Registrado no
ADR 0002.

## 5. Recomendação

1. **CI**: rodar `typecheck` + `build` + `npm test` + E2E (contra `npm start`) em
   pipeline, com Postgres de serviço — hoje a execução é manual.
2. **Antes de produção**: teste de carga (RNF02), auditoria de acessibilidade
   (WCAG), execução cross-browser (Firefox/WebKit) e revisão de cifragem/retenção
   de PII.
3. **Se houver cobrança real**: integrar PSP preenchendo `provedor`/`provedorRef`
   e tratar `INADIMPLENTE` (hoje o status existe no enum, mas nenhuma regra o
   consome — apenas exibição).
4. **Convite de membro por e-mail** com definição de senha pelo próprio convidado
   (hoje o administrador define uma senha provisória e a transmite fora do
   sistema).
5. **Limpeza do modelo**: migration removendo as credenciais órfãs de `empresas`
   depois de um período de convivência.

## 6. Conclusão

O incremento v3 está **implementado e verificado por automação** neste ambiente:
47/47 unitários, 77/77 E2E contra build de produção e PostgreSQL 16 real,
migration com backfill conferida no banco e trilha de auditoria gravando o membro
responsável. A regressão completa das suítes v1/v2 passou sem alteração de
asserts, o que sustenta que a troca do modelo de login não afetou os requisitos já
entregues. **Não** está validado para produção: carga, acessibilidade,
cross-browser e cobrança real permanecem fora de escopo e sem evidência coletada.
