# Relatório de QA — Sistema de Escalação de Freelancers

| Campo | Valor |
| --- | --- |
| **Data** | 2026-07-24 |
| **Executor** | Marcos Hamilton Barbosa Morato |
| **Ticket** | N/A — TCC (Centro Universitário do Distrito Federal – UDF, 2025) |
| **Produto** | Sistema de Escalação de Freelancers (web) |
| **Ambiente** | Node.js v22.23.1 · Next.js 15.5.21 · PostgreSQL 18 (container Docker em `localhost:5432`) · Chromium (Playwright) |
| **Build sob teste** | Build de produção (`next build` + `next start`) na porta 3000 |
| **Método** | Automação: testes unitários (Vitest) e E2E em navegador real (Playwright). Dados criados isoladamente por teste via fixtures (CPF/CNPJ válidos gerados). |

---

## 1. Objetivo

Validar, com evidência executável, que a implementação do Sistema de Escalação
de Freelancers atende aos requisitos funcionais (RF01–RF15) e não funcionais
(RNF01–RNF07) especificados no TCC, incluindo as regras de negócio de vínculo e
escalação, a geração da lista final (CSV) e a conformidade com a LGPD.

---

## 2. Escopo testado

- Autenticação e cadastro (trabalhador e empresa), com validações.
- Vínculos bidirecionais (convite/solicitação/aceite/recusa/desvínculo/favorito).
- CRUD de eventos e publicação de propostas.
- Inscrição, **bloqueio por vínculo (RF13)** e status de inscrição.
- Escalação, finalização e **exportação da lista em CSV**.
- Histórico de participações e notificações internas.
- LGPD: exportação de dados, exclusão/anonimização, política de privacidade.
- Segurança: proteção de rotas, RBAC e IDOR.

Fora de escopo nesta rodada: teste de carga/desempenho (RNF02 medido apenas
qualitativamente), acessibilidade formal (WCAG) e compatibilidade cross-browser
além do Chromium.

---

## 3. Resultados

Todos os itens abaixo foram **executados** nesta sessão. Evidência bruta em
`docs/CASOS_DE_TESTE.md` (matriz) e nos arquivos `tests/`.

### 3.1 Qualidade de build

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Type-check | ✅ | `tsc --noEmit` → `OK (0 erros)` |
| Build de produção | ✅ | `next build` → `Compiled successfully`; 18 rotas + Middleware gerados |
| Aplicação no ar | ✅ | `GET /` → `HTTP 200` |

### 3.2 Testes unitários (Vitest) — ✅ 18/18

```
✓ tests/unit/csv.test.ts           (3 tests)
✓ tests/unit/validators-doc.test.ts (6 tests)
✓ tests/unit/validations.test.ts    (9 tests)
Test Files  3 passed (3)
     Tests  18 passed (18)
```

Cobrem: algoritmo de CPF/CNPJ (dígitos verificadores), geração/escape de CSV
(RFC 4180 + BOM UTF-8) e schemas Zod (idade mínima, senha, consentimento LGPD).

### 3.3 Testes E2E (Playwright, Chromium real) — ✅ 57/57 em 15,4 s

Executados contra o build de produção (`E2E_BASE_URL=http://localhost:3000`),
2 workers. Resultado: `57 passed (15.4s)`.

| Área | RF/RNF | Testes | Resultado |
| --- | --- | --- | --- |
| Cadastro (trabalhador/empresa) | RF01/RF02 | 9 | ✅ |
| Login / logout | RF03 | 6 | ✅ |
| Vínculos | RF06/RF07 | 6 | ✅ |
| Eventos (CRUD + filtro) | RF05/RF08 | 5 | ✅ |
| Inscrições + bloqueio por vínculo | RF09/RF13/RF14 | 5 | ✅ |
| Escalação + CSV | RF10/RF11 | 5 | ✅ |
| Histórico + notificações | RF12/RF15 | 3 | ✅ |
| LGPD | Art. 18/46 | 4 | ✅ |
| Segurança (rotas/RBAC/IDOR) | RNF03 | 6 | ✅ |
| Jornada completa (golden path) | RF01–RF15 | 4 | ✅ |
| Smoke (páginas públicas) | — | 4 | ✅ |

Destaques de casos negativos/segurança validados:

- 🐛→✅ Cadastro rejeita CPF/CNPJ inválido, e-mail/CNPJ duplicado, menor de 16
  anos, senha fraca e cadastro sem aceite da LGPD.
- 🐛→✅ Login rejeita senha errada, tipo de conta trocado e e-mail inexistente
  (mensagem genérica, sem enumeração de contas).
- 🐛→✅ **RF13**: trabalhador sem vínculo não vê nem se inscreve em eventos.
- 🐛→✅ **IDOR**: empresa recebe **404** ao tentar escalar ou baixar o CSV de um
  evento de outra empresa.
- 🐛→✅ **RBAC**: trabalhador e empresa não acessam a área um do outro.
- 🐛→✅ **LGPD**: `/api/lgpd/export` sem sessão retorna **401**; a exportação não
  inclui `senhaHash`; excluir a conta anonimiza e impede novo login.

### 3.4 Evidência da lista de escalados (RF11) — amostra real

CSV gerado a partir de dados reais (evento finalizado com 1 escalado), coletado
nesta sessão:

```csv
Evento;Festival Demo
Data;2026-12-20
Local;Parque da Cidade

Nome;CPF;Telefone;E-mail;Função;Status
Ana Souza;529.982.247-25;61988880001;csv_ana_...@e2e.test;"Recepção, Apoio";ESCALADO
```

Observa-se: BOM UTF-8 (acentuação correta no Excel), separador `;` (padrão
pt-BR) e **escape do campo `"Recepção, Apoio"`** por conter vírgula.

### 3.5 Trilha de auditoria (RNF07) — sequência observada

Durante a execução do fluxo completo (golden path) nesta sessão, a tabela
`audit_logs` registrou a sequência real de ações:

```
LOGIN (empresa) → EVENTO_CRIADO → LOGIN (trabalhador) → INSCRICAO
→ LOGIN (empresa) → ESCALA_FINALIZADA → LISTA_EXPORTADA → LOGIN (trabalhador)
```

---

## 4. Achados

1. **Nenhum defeito de produto** foi identificado nas funcionalidades sob teste:
   todos os 75 casos (18 unit + 57 E2E) passam contra o build de produção.

2. **Ajustes no harness de teste** (não no produto), corrigidos durante a
   automação:
   - Corrida no helper de login: a navegação seguinte ao login precisava
     aguardar o estabelecimento da sessão (cookie). Corrigido em
     `tests/e2e/fixtures.ts`.
   - Testes E2E são mais estáveis contra o build de produção do que contra o
     servidor de desenvolvimento (que compila rotas sob demanda). Padronizado
     via `E2E_BASE_URL` + `next start`.

3. **Correção de tooling:** o script `scripts/db.mjs` (subir Postgres local sem
   Docker) usava o binário `createdb`, ausente no pacote embarcado; passou a
   criar o banco pelo driver `pg`.

4. **Observação de ambiente:** neste ambiente há um PostgreSQL em container
   Docker ocupando a porta 5432, usado como banco dos testes. Em outra máquina,
   usar `docker compose up -d` ou `npm run db:up`.

---

## 5. Recomendação

- **Apto** para apresentação/demonstração do TCC: os requisitos RF01–RF15 e
  RNF01–RNF07 estão implementados e verificados por automação.
- Antes de um uso real (produção), incluir na próxima iteração:
  - Testes de carga para quantificar o RNF02 (disponibilidade/tempo de resposta).
  - Auditoria de acessibilidade (WCAG) e matriz cross-browser (Firefox/Edge).
  - Cifragem em repouso de CPF/CNPJ e expurgo automático de logs (LGPD).
- Integrar a suíte a um pipeline de CI (a suíte já roda em ~16 s com o banco de
  pé), executando `npm test` e `npm run test:e2e` a cada alteração.

---

## 6. Conclusão

A validação por automação confirma que o Sistema de Escalação de Freelancers
cumpre o comportamento especificado no TCC, incluindo as regras de negócio
críticas (vínculo obrigatório para inscrição, escalação e geração da lista) e a
conformidade com a LGPD. Foram executados **75 testes automatizados (18
unitários + 57 E2E), com 100% de aprovação**, além de verificação de type-check
e build de produção. Não foram encontrados defeitos de produto no escopo
testado.

---

*Relatório gerado com base em execuções reais nesta sessão. Métricas de
desempenho sob carga não foram coletadas nesta rodada (fora de escopo).*
