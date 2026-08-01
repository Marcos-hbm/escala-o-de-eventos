# Documentação da API (Server Actions)

Este projeto **não expõe uma API REST**: as mutações são *Server Actions* do Next.js
(funções `"use server"`), e as leituras acontecem dentro dos Server Components. Só
existem dois *route handlers* HTTP, para download. Esta é, portanto, a documentação da
superfície de escrita do sistema.

Convenções válidas para todas as actions:

- **Autenticação** é resolvida por `requireTrabalhador()` / `requireEmpresa()`
  (`lib/auth.ts`), que redirecionam quem não está autenticado. `requireEmpresa()`
  revalida o membro no banco a cada chamada, então revogar acesso ou trocar papel vale
  no próximo request.
- **Autorização** por papel usa `erroDePermissao(sessao, permissao)`; permissões
  financeiras consideram também `Membro.autorizadoFinanceiro`
  ([ADR 0005](adr/0005-chave-pix-cifrada-e-rbac-financeiro.md)).
- **Escopo de tenant**: toda consulta de escrita filtra por `empresaId` da sessão
  (anti-IDOR). Ação sobre recurso de outra empresa responde "não encontrado".
- **Resultado**: as actions da v4 redirecionam de volta com a mensagem na URL
  (`?aviso=` / `?erro_op=`), renderizada no servidor
  ([ADR 0004](adr/0004-atualizacao-de-tela-apos-server-action.md)). Actions mais
  antigas de formulário com validação de campo ainda devolvem `ActionState` com
  `fieldErrors` para exibição ao lado do input.
- **Auditoria**: toda ação relevante grava `AuditLog` (RNF07), com o membro
  responsável quando a sessão é de empresa.

| Ator | Significado na coluna "Quem pode" |
| --- | --- |
| Trabalhador | sessão `tipo=TRABALHADOR` |
| P / A / C / V | papéis do membro: Proprietário, Administrador, Coordenador, Visualizador |
| C-fin | Coordenador **com** `autorizadoFinanceiro` |

---

## Autenticação e conta — `server/actions/auth.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `cadastrarTrabalhador` | nome, email, cpf, dataNascimento, telefone, genero, senha, aceiteLgpd | público | cria `users` + `consentimentos`; auditoria `CADASTRO`; abre sessão |
| `cadastrarEmpresa` | nome, cnpj, email, telefone, senha, aceiteLgpd | público | cria `empresas` + membro PROPRIETARIO + assinatura STARTER/TRIAL (transação); auditoria; abre sessão |
| `entrar` | tipo, email, senha, next | público | valida credenciais (empresa resolve por `membros`); auditoria `LOGIN`/`LOGIN_FALHA` com membro e papel |
| `sair` | — | autenticado | auditoria `LOGOUT`; destrói sessão |

## Perfil, LGPD e PIX — `server/actions/perfil.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `editarPerfilTrabalhador` | nome, telefone, genero, cidade, bio, habilidades, foto | Trabalhador | atualiza perfil; auditoria `PERFIL_EDITADO` |
| `editarPerfilEmpresa` | nome, telefone, foto | P, A (`empresa:editar`) | idem para a empresa |
| `salvarChavePix` | tipo, chave | Trabalhador | valida/normaliza por tipo (`lib/pix.ts`), **cifra** (`lib/cripto.ts`) e grava; auditoria `PIX_CADASTRADO` (sem o valor) |
| `removerChavePix` | — | Trabalhador | apaga chave; auditoria `PIX_REMOVIDO` |
| `excluirConta` | — | Trabalhador; P (`conta:excluir`) | anonimiza (LGPD art. 18, VI); em empresa, desativa **todos** os membros e cancela assinatura |
| `marcarNotificacaoLida` / `marcarTodasLidas` | id | Trabalhador | marca leitura; volta com aviso |

## Eventos — `server/actions/eventos.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `criarEvento` | nome, descrição, data, local, hora, vagas, funções, cachê, observações | P, A, C (`evento:criar`) + cota do plano | cria evento PUBLICADO; notifica vinculados ativos; auditoria |
| `editarEvento` | idem + eventoId | P, A, C (`evento:editar`) | atualiza; notifica inscritos; recusa evento FINALIZADO |
| `excluirEvento` | eventoId | P, A (`evento:excluir`) | remove evento (cascade); auditoria; **confirmação em duas etapas na UI** |

## Vínculos — `server/actions/vinculos.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `solicitarVinculo` | empresaId | Trabalhador | cria/reabre vínculo PENDENTE |
| `convidarTrabalhador` | userId | P, A, C (`vinculo:gerenciar`) + cota do plano | convite PENDENTE; notifica trabalhador |
| `responderVinculo` | vinculoId, acao | contraparte do pedido | ATIVO/RECUSADO; notifica; auditoria |
| `desvincular` | vinculoId | qualquer das partes | DESVINCULADO |
| `alternarFavorito` | vinculoId | Trabalhador | favorito **do trabalhador sobre a empresa** (não confundir com `TrabalhadorFavorito`) |

## Inscrições e escala — `inscricoes.ts`, `escala.ts`, `presenca.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `inscreverEvento` | eventoId | Trabalhador com vínculo ATIVO e **sem bloqueio** | cria/reativa inscrição; auditoria (`INSCRICAO` ou `INSCRICAO_BLOQUEADA`) |
| `recusarEvento` | eventoId | Trabalhador | CANCELADO_TRABALHADOR |
| `escalarEFinalizar` | eventoId, userIds[] | P, A, C (`escala:gerenciar`) | transação: escalados → ESCALADO, demais → RECUSADO_EMPRESA, evento → FINALIZADO; notifica; auditoria |
| `reabrirEvento` | eventoId | P, A, C | volta a PUBLICADO |
| `marcarPresenca` | inscricaoId, presente | P, A, C (`presenca:marcar`) | PRESENTE/FALTA |

## Avaliação — `server/actions/avaliacoes.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `avaliarTrabalhador` | eventoId, userId, 5 critérios, comentário | P, A, C (`avaliacao:registrar`) | valida no domínio, grava critérios + **nota geral = média**; notifica trabalhador; auditoria ([ADR 0006](adr/0006-avaliacao-por-criterios-preservando-a-nota-geral.md)) |
| `avaliarEmpresa` | eventoId, nota, comentário | Trabalhador que participou | nota única (a especificação pede critérios só no sentido empresa→trabalhador) |

## Equipe e plano — `equipe.ts`, `plano.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `criarMembro` | nome, email, senha, papel | P, A (`equipe:gerenciar`) + cota de usuários | cria membro; papéis atribuíveis limitados pelo próprio papel |
| `alterarPapel` | membroId, papel | P, A | protege o último PROPRIETARIO ativo |
| `alternarMembroAtivo` | membroId | P, A | revoga/reativa acesso; ninguém desativa a si mesmo |
| `trocarPlano` | plano | P (`plano:gerenciar`) | recusa downgrade se o uso exceder o plano destino; auditoria `PLANO_ALTERADO` |

## Financeiro — `server/actions/pagamentos.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `sincronizarPagamentosDoEvento` | eventoId, empresaId | interno (chamado pela página) | cria linhas de pagamento faltantes a partir do cachê; **idempotente** |
| `ajustarPagamento` | pagamentoId, valorDevido, funcao, horaEntrada, horaSaida, observações | P, A, C-fin (`financeiro:gerenciar`) | recusa valor devido abaixo do já pago; auditoria `PAGAMENTO_AJUSTADO` |
| `registrarPagamento` | pagamentoId, valor, forma, observação | P, A, C-fin | aplica regra pura (`aplicarLancamento`), grava lançamento + saldo em transação; notifica trabalhador; auditoria `PAGAMENTO_QUITADO`/`PAGAMENTO_PARCIAL` |
| `estornarPagamento` | pagamentoId | P, A, C-fin | volta a PENDENTE **sem apagar lançamentos**; auditoria `PAGAMENTO_ESTORNADO` |
| `alterarFormaPagamento` | pagamentoId, forma | P, A, C-fin | troca a forma sem mover valor |
| `iniciarFechamentoCaixa` | eventoId | P, A, C-fin | cria/reabre fechamento; **notifica todos os escalados**; auditoria |
| `registrarItemFechamento` | pagamentoId, valorPago, forma, observação | P, A, C-fin | conferência por trabalhador; lançamento apenas pela **diferença**; notifica |
| `concluirFechamentoCaixa` | eventoId | P, A, C-fin | só conclui com todos conferidos |
| `contestarPagamento` | pagamentoId, motivo, descrição | Trabalhador dono do pagamento | recusa segunda contestação em aberto; notifica responsáveis do financeiro |
| `responderContestacao` | contestacaoId, resposta, status | P, A, C-fin | RESOLVIDA/EM_ANALISE/REJEITADA; notifica trabalhador |

Leitura sensível relacionada: `lib/pix-leitura.ts` → `lerChavePixParaEmpresa()` exige
`pix:ver`, trabalhador **escalado em evento da empresa**, e grava
`AuditLog PIX_VISUALIZADO` a cada leitura.

## Relacionamento — `server/actions/relacionamento.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `favoritarTrabalhador` | userId, observação | P, A, C (`relacionamento:gerenciar`) | **alterna** favorito; auditoria |
| `bloquearTrabalhador` | userId, motivo (≥10 caracteres) | P, A, C | bloqueia, desfaz vínculo, cancela inscrições futuras, remove favorito (transação); auditoria |
| `desbloquearTrabalhador` | bloqueioId, motivoRemocao | P, A (`equipe:gerenciar`) | marca `removidoEm` mantendo a linha como histórico |

## Comunicação do evento — `server/actions/comunicacao.ts`

| Action | Entrada | Quem pode | Efeitos |
| --- | --- | --- | --- |
| `criarSolicitacao` | eventoId, tipo, mensagem | Trabalhador **escalado**, evento **em andamento** | um pedido aberto por tipo; notifica coordenação; auditoria |
| `responderSolicitacao` | solicitacaoId, status, resposta | P, A, C (`comunicacao:responder`) | valida transição no domínio; notifica trabalhador; auditoria |
| `enviarMensagemCoordenacao` | eventoId, texto, userId? | P, A, C | recado individual ou para toda a equipe escalada; notifica; auditoria |
| `registrarCheckIn` / `registrarCheckOut` | inscricaoId | P, A, C (`presenca:marcar`) | grava instante em `registros_presenca`; check-in confirma `PRESENTE`; recusa check-out sem check-in |

## Route handlers (HTTP)

| Rota | Método | Quem pode | Resposta |
| --- | --- | --- | --- |
| `/empresa/eventos/[id]/lista` | GET | empresa dona do evento | CSV da escala em padrão BR (`;`, BOM, datas `DD/MM/AAAA`, valores com vírgula); auditoria `LISTA_EXPORTADA`; 404 para evento de outra empresa |
| `/api/lgpd/export` | GET | trabalhador ou empresa autenticada | JSON com os dados pessoais do titular (LGPD art. 18, II e V); 401 sem sessão |

## Utilitários de navegação — `server/actions/navegacao.ts`

Não são ações de negócio: `voltarParaOrigem`, `voltarComSucesso` e `voltarComErro`
redirecionam de volta à origem (validando o `Referer` como caminho interno) com a
mensagem na URL. Motivo e medições no
[ADR 0004](adr/0004-atualizacao-de-tela-apos-server-action.md).
