# Escala — Sistema de Escalação de Freelancers

Plataforma web para escalação de freelancers em eventos culturais e corporativos.
Empresas publicam oportunidades, trabalhadores se vinculam e se candidatam, e a
empresa monta e exporta a escala final — de forma centralizada, rastreável e
em conformidade com a LGPD.

Implementação do sistema descrito no TCC *Sistema de Escalação de Freelancers*
(Fernando Rodrigues Leite Soares e Marcos Hamilton Barbosa Morato — UDF, 2025).

---

## Novidades (v3) — modelo SaaS: equipe, papéis e planos

A empresa deixa de ser "um usuário" e passa a ser uma **conta (tenant) com equipe
e assinatura**:

- **Multiusuário por empresa**: o login de empresa resolve por `membros` — cada
  conta nasce com um **Proprietário** e pode ter vários usuários.
- **RBAC por papel**: Proprietário, Administrador, Coordenador e Visualizador.
  O papel restringe **escrita** (a leitura entre contas continua isolada por
  `empresa_id`), aplicado em três camadas: server action, página e UI.
- **Revogação imediata**: desativar um membro ou trocar seu papel vale no
  próximo request (a sessão é revalidada no banco, não espera o JWT expirar).
- **Planos e limites** (Starter/Professional/Enterprise): usuários da conta,
  eventos ativos e vínculos; bloqueio com mensagem que diz o teto e **como
  liberar espaço**. Único recurso pago é a *escalação inteligente* (extra da v2)
  — nenhum requisito do TCC é bloqueado por plano.
- **Telas novas**: `/empresa/equipe` (membros e papéis) e `/empresa/plano`
  (assinatura, uso × limites, comparativo e troca de plano).

Detalhes em [`docs/V3_SAAS.md`](docs/V3_SAAS.md); decisões em
[`docs/adr/`](docs/adr/).

---

## Novidades (v2) — funções que elevam a produtividade

Recursos adicionados além do escopo básico do TCC, cobrindo exatamente os
"trabalhos futuros" citados na conclusão do trabalho:

- **Painéis com KPIs** (empresa e trabalhador): eventos, preenchimento de vagas,
  ganhos, taxa de presença, reputação e próximos compromissos — com gráficos
  inline (sem dependência externa).
- **Avaliação bidirecional + reputação**: a empresa avalia os escalados e o
  trabalhador avalia a empresa (nota 1–5 + comentário); médias exibidas em
  perfis, painéis e na escalação.
- **Controle de presença / check-in**: a empresa marca presença/falta, o que
  alimenta a reputação e a priorização.
- **Escalação inteligente**: na tela de escalar, candidatos são ordenados por
  um *score* (reputação + presença), com badges e **alerta de conflito de
  agenda** (trabalhador já escalado em outro evento na mesma data).
- **Perfil enriquecido** do trabalhador: cidade, bio e habilidades (usadas no
  matching).
- **Notificações**: badge de não lidas no menu.

Detalhes de implementação em [`docs/V2_FUNCOES.md`](docs/V2_FUNCOES.md).

---

## Stack

| Camada | Tecnologia | Por quê |
| --- | --- | --- |
| Framework | **Next.js 15** (App Router, React 19, Server Actions) | Full-stack em um só projeto, tipos ponta a ponta |
| Linguagem | **TypeScript** (strict) | Segurança de tipos front + back |
| Banco | **PostgreSQL 16** + **Prisma 6** | Integridade referencial, enums nativos, migrations versionadas |
| Auth | **Sessão JWT** (`jose`) + **bcryptjs** | Credenciais em tabelas separadas (trabalhador / membro da empresa), cookie httpOnly, RBAC por papel — mesmo padrão credentials+JWT do Auth.js, sob controle total |
| Validação | **Zod** | Schemas reaproveitados em server actions e testes |
| UI | **Tailwind CSS v4** + componentes próprios + **lucide-react** | Responsivo, tema claro/escuro |
| Testes | **Vitest** (unitário) + **Playwright** (E2E) | Mesma ferramenta de UI do padrão de QA |

> **Nota sobre autenticação:** o TCC previa PHP/MySQL. Aqui a stack foi
> modernizada conforme solicitado. A sessão usa o padrão *credentials + JWT*
> assinado com `jose` (a mesma biblioteca que o Auth.js usa internamente),
> escolhido por lidar de forma limpa com **duas tabelas de conta distintas**
> (trabalhador e empresa), o que o modelo de usuário único do Auth.js torna
> mais trabalhoso. A troca por `next-auth` é direta se desejado.

---

## Pré-requisitos

- Node.js 20+ (testado em Node 22)
- PostgreSQL 16 (via Docker recomendado)

## Como rodar

### Opção A — sem Docker (mais rápido; usa Postgres local em `.pgdata`)

```bash
npm install
cp .env.example .env       # já vem apontando para localhost:5432
npm run setup              # sobe o Postgres local + migra + popula dados
npm run dev                # http://localhost:3000
```

`npm run setup` = `db:up` (inicia um PostgreSQL local via binários oficiais,
sem Docker/root) + `db:deploy` (migrations) + `db:seed` (dados de exemplo).
Para parar o banco: `npm run db:down`. Estado: `npm run db:status`.

### Opção B — com Docker (recomendado em produção)

```bash
npm install
cp .env.example .env       # edite AUTH_SECRET: openssl rand -base64 48
docker compose up -d       # PostgreSQL em localhost:5432
npm run db:deploy          # aplica a migration prisma/migrations/0000_init
npm run db:seed            # empresas, trabalhadores, vínculos e eventos
npm run dev                # http://localhost:3000
```

### Contas de exemplo (após `db:seed`)

| Tipo | E-mail | Senha |
| --- | --- | --- |
| Empresa — Proprietário (plano Professional) | `contato@cenaviva.com.br` | `Senha@123` |
| Empresa — Coordenador (mesma conta) | `coord@cenaviva.com.br` | `Senha@123` |
| Empresa — Visualizador (mesma conta) | `financeiro@cenaviva.com.br` | `Senha@123` |
| Empresa — Proprietário (plano Starter/trial) | `rh@bsbfeiras.com.br` | `Senha@123` |
| Trabalhador | `ana@exemplo.com` | `Senha@123` |
| Trabalhador | `bruno@exemplo.com` | `Senha@123` |
| Trabalhador | `carla@exemplo.com` | `Senha@123` |

---

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`prisma generate` + `next build`) |
| `npm start` | Servidor de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes E2E (Playwright) |
| `npm run db:deploy` | Aplica migrations |
| `npm run db:seed` | Popula dados de exemplo |
| `npm run db:studio` | Prisma Studio (inspeção do banco) |

### Testes

```bash
npm test                      # 47 testes unitários (Vitest) — sem banco

npm run test:e2e:smoke        # smoke E2E (páginas públicas + gating) — sem banco

# Suíte E2E completa (77 testes) — precisa da app + PostgreSQL.
# Mais estável contra o build de produção:
npm run db:up                 # ou docker compose up -d
npm run build && npm start &  # servidor de produção em :3000
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

A matriz completa de casos (CT-01…CT-72) está em
[`docs/CASOS_DE_TESTE.md`](docs/CASOS_DE_TESTE.md). Os testes E2E criam dados
isolados por teste (CPF/CNPJ válidos gerados), então rodam em paralelo e
repetidamente sem interferência. Cobrem: cadastro/login (positivos e negativos),
vínculos bidirecionais, CRUD de eventos, inscrição e bloqueio por vínculo (RF13),
escalação + CSV, histórico, notificações, LGPD (export/exclusão),
segurança/RBAC/IDOR e o modelo SaaS da v3 (login por membro, papéis, cotas e
troca de plano).

---

## Cobertura dos requisitos do TCC

Todos os requisitos funcionais e não funcionais estão implementados. O mapa
completo RF/RNF → arquivo está em [`docs/REQUISITOS.md`](docs/REQUISITOS.md).
Arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md); conformidade legal
em [`docs/LGPD.md`](docs/LGPD.md).

Resumo:

- **RF01–RF04** cadastro (trabalhador/empresa), login e perfil
- **RF05** CRUD de eventos · **RF06/RF07** vínculos (convite/aceite/lista)
- **RF08/RF09** propostas e aceite/recusa · **RF10** escalação
- **RF11** lista de escalados em CSV · **RF12** histórico
- **RF13** só vinculados participam · **RF14** status de inscrição
- **RF15** notificações internas
- **RNF01–RNF07** usabilidade, disponibilidade, segurança, compatibilidade,
  integridade (transações + FKs), portabilidade e **auditoria**

---

## Evidências de verificação

Executado neste ambiente (Node 22, PostgreSQL 18 real):

- ✅ `npm run build` — 24 rotas + middleware compilados
- ✅ `npm run typecheck` — sem erros
- ✅ `npm test` — **47/47** testes unitários (CPF/CNPJ, CSV, schemas Zod, KPIs,
  limites de plano e matriz de papéis)
- ✅ `npm run test:e2e` — **77/77** testes E2E em Chromium real (13 suítes),
  contra o build de produção + PostgreSQL 16, em ~22s
- ✅ Migration v3 aplicada com backfill conferido no banco: cada empresa
  existente ganhou membro `PROPRIETARIO` (mesmas credenciais) e assinatura
- ✅ `prisma migrate deploy` + `db:seed` — schema aplicado e dados criados
- ✅ Fluxo completo (golden path): empresa cria proposta → trabalhador vinculado
  se inscreve → empresa escala e finaliza → **CSV baixado e validado** → "Escalado"
  no histórico
- ✅ Trilha de auditoria (RNF07) gravou a sequência real: `LOGIN`,
  `EVENTO_CRIADO`, `INSCRICAO`, `ESCALA_FINALIZADA`, `LISTA_EXPORTADA`
- ✅ Smoke HTTP: `/` e `/privacidade` 200; rotas protegidas → 307 login;
  `/api/lgpd/export` sem sessão → 401

> O PostgreSQL usado na verificação subiu via `embedded-postgres` (sem Docker),
> apenas de forma transitória. O fluxo oficial documentado acima usa Docker.

---

## Estrutura

```
prisma/                 schema, migration inicial, seed
src/
  app/                  rotas (App Router)
    login, cadastro/    autenticação
    trabalhador/        área do trabalhador
    empresa/            área da empresa (inclui equipe/ e plano/ — v3 SaaS)
    privacidade/        política LGPD
    api/lgpd/export     portabilidade de dados
  components/           UI e componentes compartilhados
  lib/                  auth, sessão, prisma, validações, LGPD, CSV, auditoria,
                        rbac (papéis), planos (limites), assinatura (uso)
  server/actions/       server actions (regras de negócio, RF01–RF15)
  middleware.ts         proteção de rotas por papel (RBAC)
tests/
  unit/                 Vitest
  e2e/                  Playwright
docs/                   ARQUITETURA, LGPD, REQUISITOS, V2_FUNCOES, V3_SAAS, adr/
```
