# Casos de teste

Matriz de casos cobertos pela suíte automatizada. Cada caso mapeia para um
teste real (unitário em Vitest ou E2E em Playwright) e para o requisito do TCC.

**Convenção:** CT = Caso de Teste. Tipo: E2E (Playwright, navegador real) ou
UNIT (Vitest). Os E2E criam dados isolados por teste (fixtures) e rodam contra
a aplicação em execução + PostgreSQL.

## Autenticação e cadastro

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-01 | Cadastro de trabalhador com dados válidos → entra no sistema | E2E | RF01 | cadastro.spec |
| CT-02 | Cadastro rejeita CPF inválido | E2E/UNIT | RF01 | cadastro.spec / validators-doc.test |
| CT-03 | Cadastro rejeita menor de 16 anos | E2E/UNIT | RF01 | cadastro.spec / validations.test |
| CT-04 | Cadastro rejeita senha fraca (sem número) | E2E/UNIT | RF01 | cadastro.spec / validations.test |
| CT-05 | Cadastro rejeita e-mail já cadastrado | E2E | RF01 | cadastro.spec |
| CT-06 | Cadastro exige aceite da LGPD (campo obrigatório) | E2E/UNIT | RF01/LGPD | cadastro.spec / validations.test |
| CT-07 | Cadastro de empresa com dados válidos → entra no sistema | E2E | RF02 | cadastro.spec |
| CT-08 | Cadastro de empresa rejeita CNPJ inválido | E2E/UNIT | RF02 | cadastro.spec / validators-doc.test |
| CT-09 | Cadastro de empresa rejeita CNPJ já cadastrado | E2E | RF02 | cadastro.spec |
| CT-10 | Login de empresa com sucesso | E2E | RF03 | login.spec |
| CT-11 | Login de trabalhador com sucesso | E2E | RF03 | login.spec |
| CT-12 | Login rejeita senha incorreta | E2E | RF03 | login.spec |
| CT-13 | Login rejeita tipo de conta trocado | E2E | RF03 | login.spec |
| CT-14 | Login rejeita e-mail inexistente | E2E | RF03 | login.spec |
| CT-15 | Logout encerra a sessão e bloqueia área protegida | E2E | RF03 | login.spec |

## Vínculos

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-16 | Trabalhador solicita e empresa aceita → vínculo ativo | E2E | RF06/RF07 | vinculos.spec |
| CT-17 | Empresa convida e trabalhador aceita → vínculo ativo | E2E | RF06/RF07 | vinculos.spec |
| CT-18 | Empresa recusa a solicitação do trabalhador | E2E | RF06 | vinculos.spec |
| CT-19 | Favoritar e desfavoritar empresa vinculada | E2E | RF07 | vinculos.spec |
| CT-20 | Desvincular remove o vínculo ativo | E2E | RF07 | vinculos.spec |
| CT-21 | Busca de empresa sem correspondência informa vazio | E2E | RF06 | vinculos.spec |

## Eventos

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-22 | Criar evento válido → aparece na lista | E2E | RF05/RF08 | eventos.spec |
| CT-23 | Editar evento altera os dados | E2E | RF05 | eventos.spec |
| CT-24 | Excluir evento remove da lista | E2E | RF05 | eventos.spec |
| CT-25 | Filtrar eventos por nome | E2E | RF05 | eventos.spec |
| CT-26 | Evento recém-criado nasce como PUBLICADO | E2E | RF08 | eventos.spec |

## Inscrições e regra de vínculo

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-27 | Trabalhador vinculado se inscreve | E2E | RF09 | inscricoes.spec |
| CT-28 | Sem vínculo não pode se inscrever (bloqueio) | E2E | RF13 | inscricoes.spec |
| CT-29 | Descoberta só mostra eventos de empresas vinculadas | E2E | RF13 | inscricoes.spec |
| CT-30 | Evento de empresa vinculada aparece na descoberta | E2E | RF09 | inscricoes.spec |
| CT-31 | Cancelar inscrição permite reinscrever | E2E | RF14 | inscricoes.spec |

## Escalação e lista

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-32 | Escalar todos, finalizar e baixar CSV com conteúdo correto | E2E | RF10/RF11 | escala.spec |
| CT-33 | Botão finalizar desabilitado sem seleção | E2E | RF10 | escala.spec |
| CT-34 | Selecionar todos e depois desmarcar todos | E2E | RF10 | escala.spec |
| CT-35 | Evento sem inscritos mostra mensagem apropriada | E2E | RF10 | escala.spec |
| CT-36 | Reabrir evento finalizado volta para escalação | E2E | RF10 | escala.spec |
| CT-37 | Escape de CSV (aspas/vírgula/quebra) e BOM UTF-8 | UNIT | RF11 | csv.test |

## Histórico e notificações

| CT | Descrição | Tipo | RF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-38 | Histórico mostra participação como 'Escalado' | E2E | RF12 | historico-notificacoes.spec |
| CT-39 | Novo evento gera notificação ao vinculado | E2E | RF15 | historico-notificacoes.spec |
| CT-40 | Marcar todas as notificações como lidas | E2E | RF15 | historico-notificacoes.spec |

## LGPD

| CT | Descrição | Tipo | Base legal | Arquivo |
| --- | --- | --- | --- | --- |
| CT-41 | Exportar meus dados retorna JSON sem a senha | E2E | Art. 18 II/V | lgpd.spec |
| CT-42 | Exportar sem sessão é negado (401) | E2E | Art. 46 | lgpd.spec |
| CT-43 | Excluir conta anonimiza e impede novo login | E2E | Art. 18 VI | lgpd.spec |
| CT-44 | Política de privacidade pública citando LGPD e DPO | E2E | Art. 9 | lgpd.spec |

## Segurança e autorização

| CT | Descrição | Tipo | RNF | Arquivo |
| --- | --- | --- | --- | --- |
| CT-45 | Rota do trabalhador sem sessão redireciona ao login | E2E | RNF03 | seguranca.spec |
| CT-46 | Rota da empresa sem sessão redireciona ao login | E2E | RNF03 | seguranca.spec |
| CT-47 | RBAC: trabalhador não acessa área da empresa | E2E | RNF03 | seguranca.spec |
| CT-48 | RBAC: empresa não acessa área do trabalhador | E2E | RNF03 | seguranca.spec |
| CT-49 | IDOR: empresa não escala evento de outra empresa (404) | E2E | RNF03 | seguranca.spec |
| CT-50 | IDOR: empresa não baixa CSV de evento alheio (404) | E2E | RNF03 | seguranca.spec |

## Jornada completa (integração)

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-51 | Golden path: proposta → inscrição → escala → CSV → histórico | E2E | fluxo-completo.spec |

## Smoke (sem banco)

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-52 | Landing carrega e leva ao cadastro | E2E | smoke.spec |
| CT-53 | Política de privacidade cita a LGPD | E2E | smoke.spec |
| CT-54 | Rota protegida redireciona para login | E2E | smoke.spec |
| CT-55 | Tela de login alterna tipo de conta | E2E | smoke.spec |

## v3 — SaaS: membros, RBAC e planos

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-56 | Membro COORDENADOR entra e vê empresa + papel no menu | E2E | saas.spec |
| CT-57 | COORDENADOR não vê Equipe no menu e é barrado na URL direta | E2E | saas.spec |
| CT-58 | VISUALIZADOR sem "Novo evento" e sem criar evento por URL | E2E | saas.spec |
| CT-59 | VISUALIZADOR vê a escala em modo leitura (sem escalar) | E2E | saas.spec |
| CT-60 | Acesso revogado na sessão derruba o membro no próximo acesso | E2E | saas.spec |
| CT-61 | PROPRIETARIO adiciona membro com papel (persistido no banco) | E2E | saas.spec |
| CT-62 | PROPRIETARIO revoga acesso de um membro | E2E | saas.spec |
| CT-63 | Cota de usuários do STARTER bloqueia novo convite | E2E | saas.spec |
| CT-64 | STARTER bloqueia o 4º evento ativo com orientação de upgrade | E2E | saas.spec |
| CT-65 | PROFESSIONAL cria evento além do limite do STARTER | E2E | saas.spec |
| CT-66 | Escalação inteligente só aparece no plano que a inclui | E2E | saas.spec |
| CT-67 | Página de Plano mostra plano, situação e uso × limites | E2E | saas.spec |
| CT-68 | Troca de plano persiste a assinatura | E2E | saas.spec |
| CT-69 | Downgrade recusado quando o uso excede o plano destino | E2E | saas.spec |
| CT-70 | Membro sem permissão vê o plano, mas não troca | E2E | saas.spec |
| CT-71 | Limites por plano: cabeMais/pctUso/mensagens (11 asserts) | Unitário | planos.test |
| CT-72 | Matriz de papéis: escrita por papel e papéis atribuíveis (8 asserts) | Unitário | rbac.test |

## v4 fase 1 — Data/hora BR e fundação de UX

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-73 | Evento exibe data DD/MM/AAAA sem deslocar o dia (data civil) | E2E | ux.spec |
| CT-74 | Notificação mostra tempo relativo + data/hora completa no title | E2E | ux.spec |
| CT-75 | CSV exportado em padrão BR (data e cachê com vírgula) | E2E | ux.spec |
| CT-76 | Tema alterna, persiste em cookie e sobrevive ao reload (sem flash) | E2E | ux.spec |
| CT-77 | Listagem pagina no banco e navegação preserva filtro | E2E | ux.spec |
| CT-78 | Empty state de empresa sem eventos oferece criar o primeiro | E2E | ux.spec |
| CT-79 | Busca sem resultado oferece limpar filtros | E2E | ux.spec |
| CT-80 | Trabalhador sem vínculo é direcionado a Vínculos | E2E | ux.spec |
| CT-81 | Toast acessível (aria-live) aparece e pode ser fechado | E2E | ux.spec |
| CT-82 | Data civil x instante: fuso correto nos dois casos (16 asserts) | Unitário | datetime.test |
| CT-83 | Guarda: nenhuma formatação de data fora de lib/datetime.ts | Unitário | datetime.test |
| CT-84 | Paginação: clamp de entrada hostil, metadados e URLs (14 asserts) | Unitário | paginacao.test |
| CT-85 | Redirecionamento pós-mutação recusa destino externo (open redirect) | Unitário | navegacao.test |
| CT-86 | Aviso de sucesso renderizado no servidor, fechável por link | E2E | ux.spec |
| CT-87 | Recusa por regra de negócio aparece no formulário e nada é alterado | E2E | ux.spec |
| CT-88 | Flash na URL: preserva filtros, não acumula, limita tamanho (12 asserts) | Unitário | flash.test |

## v4 fase 2 — Modelagem financeira, PIX cifrado e RBAC financeiro

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-89 | Cifragem AES-256-GCM: reversível, IV aleatório, detecta adulteração (10 asserts) | Unitário | cripto.test |
| CT-90 | Chave PIX: validação/normalização por tipo e máscara (13 asserts) | Unitário | pix.test |
| CT-91 | Regras de dinheiro: saldo, status derivado, parcial, recusas (15 asserts) | Unitário | pagamento.test |
| CT-92 | RBAC financeiro: coordenador só com autorização; visualizador nunca | Unitário | rbac.test |
| CT-93 | Notificação exige exatamente um destinatário (trabalhador XOR membro) | Integração | schema-v4.test |
| CT-94 | Pagamento recusa valor negativo e pago acima do devido | Integração | schema-v4.test |
| CT-95 | Avaliação recusa nota fora de 1..5 nos cinco critérios | Integração | schema-v4.test |
| CT-96 | Um bloqueio vigente por par empresa×trabalhador, com histórico preservado | Integração | schema-v4.test |
| CT-97 | Uma contestação em aberto por pagamento | Integração | schema-v4.test |
| CT-98 | Um fechamento de caixa por evento; check-in/check-out registrados | Integração | schema-v4.test |
| CT-99 | Empresa que escalou lê a chave PIX decifrada **e** gera auditoria | Integração | pix-leitura.test |
| CT-100 | Empresa sem escalação não lê a chave e não gera auditoria | Integração | pix-leitura.test |
| CT-101 | Trabalhador vê a própria chave mascarada, sem auditoria | Integração | pix-leitura.test |
| CT-102 | Coluna do banco guarda pacote cifrado versionado, não a chave em claro | Integração | pix-leitura.test |

## v4 fase 3 — Financeiro (telas e fluxos)

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-103 | "Finalizar pagamentos" no card do evento finalizado; linha criada com o cachê | E2E | financeiro.spec |
| CT-104 | Pagamento total: status ✅, lançamento, notificação e auditoria | E2E | financeiro.spec |
| CT-105 | Pagamento parcial acumula e recusa valor acima do saldo (diz quanto resta) | E2E | financeiro.spec |
| CT-106 | Estorno volta a pendente **preservando** o histórico de lançamentos | E2E | financeiro.spec |
| CT-107 | PIX: trabalhador cadastra (cifrado) e vê mascarado; empresa vê completo com auditoria | E2E | financeiro.spec |
| CT-108 | Fechamento: iniciar notifica escalados, conferir registra, concluir fecha | E2E | financeiro.spec |
| CT-109 | Contestação: trabalhador abre, responsáveis do financeiro são notificados, empresa responde | E2E | financeiro.spec |
| CT-110 | Segunda contestação em aberto é bloqueada no mesmo pagamento | E2E | financeiro.spec |
| CT-111 | Coordenador sem autorização não vê Financeiro nem a tela de pagamentos | E2E | financeiro.spec |
| CT-112 | Coordenador autorizado registra pagamento (lançamento atribuído a ele) | E2E | financeiro.spec |
| CT-113 | Visualizador não acessa o financeiro nem com a flag ligada | E2E | financeiro.spec |
| CT-114 | Histórico da empresa filtra por situação e busca por nome | E2E | financeiro.spec |
| CT-115 | Indicador ✅/⏳ no histórico de participações do trabalhador | E2E | financeiro.spec |
| CT-116 | Valor monetário aceita "1.234,50" e "1234.50"; campo opcional ausente (null) | Unitário | validations.test |

## v4 fase 4 — Avaliação por critérios, favoritos e bloqueio

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-117 | Critérios: nota geral é a média arredondada; ignora não preenchidos (14 asserts) | Unitário | avaliacao.test |
| CT-118 | Validação aponta o critério inválido pelo nome; exige ao menos um | Unitário | avaliacao.test |
| CT-119 | Resumo por critério e destaque/ponto a melhorar (sem ruído quando empata) | Unitário | avaliacao.test |
| CT-120 | Empresa avalia por critérios: prévia da média, nota geral no banco e notificação | E2E | v2.spec |
| CT-121 | Favoritar na tela de pagamentos e ver na lista própria | E2E | relacionamento.spec |
| CT-122 | O mesmo controle desfavorita (alterna) | E2E | relacionamento.spec |
| CT-123 | Bloquear exige motivo, desfaz vínculo, cancela inscrição futura e remove favorito | E2E | relacionamento.spec |
| CT-124 | Bloqueado não vê vagas da empresa e recebe 404 no evento por URL | E2E | relacionamento.spec |
| CT-125 | Bloqueado não consegue se candidatar nem por requisição direta à action | E2E | relacionamento.spec |
| CT-126 | Bloqueado não aparece na busca de trabalhadores para convidar | E2E | relacionamento.spec |
| CT-127 | Coordenador não remove bloqueio; Proprietário remove e o histórico permanece | E2E | relacionamento.spec |
| CT-128 | Depois de desbloqueado, o trabalhador volta a ver as vagas | E2E | relacionamento.spec |
| CT-129 | Favorito exibe destaque e ponto a melhorar a partir dos critérios | E2E | relacionamento.spec |

## v4 fase 5 — Comunicação do evento e painel do coordenador

| CT | Descrição | Tipo | Arquivo |
| --- | --- | --- | --- |
| CT-130 | Estado do evento por data civil BR; madrugada em UTC não encerra o dia | Unitário | comunicacao.test |
| CT-131 | Transições de status válidas; terminais não voltam atrás | Unitário | comunicacao.test |
| CT-132 | Fila do coordenador: abertas antes, urgentes na frente, antigas primeiro | Unitário | comunicacao.test |
| CT-133 | Presença: estado do turno e minutos trabalhados | Unitário | comunicacao.test |
| CT-134 | `diaCivilBR` devolve o dia em Brasília, não em UTC | Unitário | datetime.test |
| CT-135 | Escalado abre pedido em evento de hoje e a coordenação é notificada | E2E | comunicacao.spec |
| CT-136 | Pedido urgente chega marcado para a coordenação | E2E | comunicacao.spec |
| CT-137 | Segundo pedido do mesmo tipo é recusado na tela **e** no servidor | E2E | comunicacao.spec |
| CT-138 | Canal fechado antes do dia do evento, com histórico visível | E2E | comunicacao.spec |
| CT-139 | Quem não está escalado não vê o canal | E2E | comunicacao.spec |
| CT-140 | Coordenação responde: status muda, notifica e o trabalhador vê a resposta | E2E | comunicacao.spec |
| CT-141 | Solicitação terminal não oferece resposta (transição inválida) | E2E | comunicacao.spec |
| CT-142 | Check-in/check-out gravam horário e confirmam presença | E2E | comunicacao.spec |
| CT-143 | Check-out sem check-in não é oferecido | E2E | comunicacao.spec |
| CT-144 | Mensagem à equipe notifica escalados e aparece nos dois lados | E2E | comunicacao.spec |
| CT-145 | Atualização periódica declarada + link "atualizar agora" traz pedido novo | E2E | comunicacao.spec |
| CT-146 | Visualizador não acessa o painel do coordenador | E2E | comunicacao.spec |
| CT-147 | Histórico do evento continua acessível depois, sem ações | E2E | comunicacao.spec |

---

## Como executar

```bash
# Unitários + integração (a parte de integração precisa do PostgreSQL)
npm test

# Só os unitários (sem banco)
npx vitest run tests/unit

# E2E: precisa da app rodando + PostgreSQL
npm run db:up        # ou docker compose up -d
npm run build && npm start   # servidor de produção (mais estável p/ E2E)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e

# Só o smoke (sem banco)
npm run test:e2e:smoke
```
