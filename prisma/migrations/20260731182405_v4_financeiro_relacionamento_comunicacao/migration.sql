-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'DINHEIRO', 'CARTAO_CREDITO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PARCIAL', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusContestacao" AS ENUM ('ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "StatusFechamentoCaixa" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoSolicitacaoEvento" AS ENUM ('INTERVALO', 'DESCANSO', 'PROBLEMA', 'AJUDA', 'SUBSTITUICAO', 'FALAR_COORDENACAO');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('EM_ANALISE', 'AGUARDANDO', 'APROVADA', 'RECUSADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "TipoChavePix" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'PAGAMENTO_REGISTRADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'PAGAMENTO_PARCIAL';
ALTER TYPE "TipoNotificacao" ADD VALUE 'FECHAMENTO_INICIADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'CONTESTACAO_ABERTA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'CONTESTACAO_RESPONDIDA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'SOLICITACAO_RECEBIDA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'SOLICITACAO_RESPONDIDA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'MENSAGEM_COORDENACAO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'AVALIACAO_RECEBIDA';

-- AlterTable
ALTER TABLE "avaliacoes" ADD COLUMN     "nota_comprometimento" INTEGER,
ADD COLUMN     "nota_comunicacao" INTEGER,
ADD COLUMN     "nota_pontualidade" INTEGER,
ADD COLUMN     "nota_qualidade" INTEGER,
ADD COLUMN     "nota_trabalho_equipe" INTEGER;

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "autorizado_financeiro" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "membro_id" INTEGER,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pix_atualizado_em" TIMESTAMP(3),
ADD COLUMN     "pix_chave_cifrada" TEXT,
ADD COLUMN     "pix_tipo" "TipoChavePix";

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "valor_devido" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "valor_pago" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "forma" "FormaPagamento",
    "funcao" VARCHAR(120),
    "hora_entrada" VARCHAR(5),
    "hora_saida" VARCHAR(5),
    "observacoes" VARCHAR(500),
    "registrado_por_membro_id" INTEGER,
    "quitado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_lancamentos" (
    "id" SERIAL NOT NULL,
    "pagamento_id" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "observacao" VARCHAR(300),
    "registrado_por_membro_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamento_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contestacoes_pagamento" (
    "id" SERIAL NOT NULL,
    "pagamento_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "motivo" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(1000) NOT NULL,
    "status" "StatusContestacao" NOT NULL DEFAULT 'ABERTA',
    "resposta" VARCHAR(1000),
    "respondido_por_membro_id" INTEGER,
    "respondido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contestacoes_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fechamentos_caixa" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "status" "StatusFechamentoCaixa" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciado_por_membro_id" INTEGER,
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(3),
    "observacoes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fechamentos_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fechamento_caixa_itens" (
    "id" SERIAL NOT NULL,
    "fechamento_id" INTEGER NOT NULL,
    "pagamento_id" INTEGER NOT NULL,
    "valor_devido" DECIMAL(10,2) NOT NULL,
    "valor_pago" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "forma" "FormaPagamento" NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "observacao" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fechamento_caixa_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabalhador_favoritos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "observacao" VARCHAR(300),
    "criado_por_membro_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabalhador_favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabalhador_bloqueios" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "aplicado_por_membro_id" INTEGER,
    "removido_por_membro_id" INTEGER,
    "removido_em" TIMESTAMP(3),
    "motivo_remocao" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trabalhador_bloqueios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_evento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tipo" "TipoSolicitacaoEvento" NOT NULL,
    "mensagem" VARCHAR(500),
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'EM_ANALISE',
    "resposta" VARCHAR(500),
    "respondido_por_membro_id" INTEGER,
    "respondido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_coordenador" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "membro_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "texto" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_coordenador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_presenca" (
    "id" SERIAL NOT NULL,
    "inscricao_id" INTEGER NOT NULL,
    "check_in_em" TIMESTAMP(3),
    "check_out_em" TIMESTAMP(3),
    "observacao" VARCHAR(300),
    "registrado_por_membro_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_presenca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagamentos_empresa_id_status_idx" ON "pagamentos"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "pagamentos_user_id_status_idx" ON "pagamentos"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_evento_id_user_id_key" ON "pagamentos"("evento_id", "user_id");

-- CreateIndex
CREATE INDEX "pagamento_lancamentos_pagamento_id_idx" ON "pagamento_lancamentos"("pagamento_id");

-- CreateIndex
CREATE INDEX "contestacoes_pagamento_pagamento_id_idx" ON "contestacoes_pagamento"("pagamento_id");

-- CreateIndex
CREATE INDEX "contestacoes_pagamento_user_id_status_idx" ON "contestacoes_pagamento"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fechamentos_caixa_evento_id_key" ON "fechamentos_caixa"("evento_id");

-- CreateIndex
CREATE INDEX "fechamentos_caixa_empresa_id_status_idx" ON "fechamentos_caixa"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fechamento_caixa_itens_fechamento_id_pagamento_id_key" ON "fechamento_caixa_itens"("fechamento_id", "pagamento_id");

-- CreateIndex
CREATE INDEX "trabalhador_favoritos_empresa_id_idx" ON "trabalhador_favoritos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "trabalhador_favoritos_empresa_id_user_id_key" ON "trabalhador_favoritos"("empresa_id", "user_id");

-- CreateIndex
CREATE INDEX "trabalhador_bloqueios_empresa_id_user_id_removido_em_idx" ON "trabalhador_bloqueios"("empresa_id", "user_id", "removido_em");

-- CreateIndex
CREATE INDEX "trabalhador_bloqueios_user_id_removido_em_idx" ON "trabalhador_bloqueios"("user_id", "removido_em");

-- CreateIndex
CREATE INDEX "solicitacoes_evento_evento_id_status_idx" ON "solicitacoes_evento"("evento_id", "status");

-- CreateIndex
CREATE INDEX "solicitacoes_evento_evento_id_user_id_idx" ON "solicitacoes_evento"("evento_id", "user_id");

-- CreateIndex
CREATE INDEX "mensagens_coordenador_evento_id_created_at_idx" ON "mensagens_coordenador"("evento_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registros_presenca_inscricao_id_key" ON "registros_presenca"("inscricao_id");

-- CreateIndex
CREATE INDEX "eventos_empresa_id_status_idx" ON "eventos"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "notificacoes_membro_id_lida_idx" ON "notificacoes"("membro_id", "lida");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registrado_por_membro_id_fkey" FOREIGN KEY ("registrado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_lancamentos" ADD CONSTRAINT "pagamento_lancamentos_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_lancamentos" ADD CONSTRAINT "pagamento_lancamentos_registrado_por_membro_id_fkey" FOREIGN KEY ("registrado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_pagamento" ADD CONSTRAINT "contestacoes_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_pagamento" ADD CONSTRAINT "contestacoes_pagamento_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_pagamento" ADD CONSTRAINT "contestacoes_pagamento_respondido_por_membro_id_fkey" FOREIGN KEY ("respondido_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fechamentos_caixa" ADD CONSTRAINT "fechamentos_caixa_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fechamentos_caixa" ADD CONSTRAINT "fechamentos_caixa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fechamentos_caixa" ADD CONSTRAINT "fechamentos_caixa_iniciado_por_membro_id_fkey" FOREIGN KEY ("iniciado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fechamento_caixa_itens" ADD CONSTRAINT "fechamento_caixa_itens_fechamento_id_fkey" FOREIGN KEY ("fechamento_id") REFERENCES "fechamentos_caixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fechamento_caixa_itens" ADD CONSTRAINT "fechamento_caixa_itens_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_favoritos" ADD CONSTRAINT "trabalhador_favoritos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_favoritos" ADD CONSTRAINT "trabalhador_favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_favoritos" ADD CONSTRAINT "trabalhador_favoritos_criado_por_membro_id_fkey" FOREIGN KEY ("criado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_bloqueios" ADD CONSTRAINT "trabalhador_bloqueios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_bloqueios" ADD CONSTRAINT "trabalhador_bloqueios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_bloqueios" ADD CONSTRAINT "trabalhador_bloqueios_aplicado_por_membro_id_fkey" FOREIGN KEY ("aplicado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhador_bloqueios" ADD CONSTRAINT "trabalhador_bloqueios_removido_por_membro_id_fkey" FOREIGN KEY ("removido_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_evento" ADD CONSTRAINT "solicitacoes_evento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_evento" ADD CONSTRAINT "solicitacoes_evento_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_evento" ADD CONSTRAINT "solicitacoes_evento_respondido_por_membro_id_fkey" FOREIGN KEY ("respondido_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_coordenador" ADD CONSTRAINT "mensagens_coordenador_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_coordenador" ADD CONSTRAINT "mensagens_coordenador_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_coordenador" ADD CONSTRAINT "mensagens_coordenador_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_presenca" ADD CONSTRAINT "registros_presenca_inscricao_id_fkey" FOREIGN KEY ("inscricao_id") REFERENCES "inscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_presenca" ADD CONSTRAINT "registros_presenca_registrado_por_membro_id_fkey" FOREIGN KEY ("registrado_por_membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Regras que o Prisma não modela (escritas à mão)
-- ---------------------------------------------------------------------------

-- Notificação tem EXATAMENTE um destinatário: trabalhador OU membro da empresa.
-- Sem esta constraint seria possível gravar notificação órfã (nenhum dos dois) ou
-- ambígua (os dois), e nenhuma tela saberia para quem ela é.
ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_destinatario_exclusivo"
  CHECK (("user_id" IS NULL) <> ("membro_id" IS NULL));

-- Dinheiro nunca é negativo, e o pago nunca passa do devido: invariante do saldo
-- garantida no banco, não só na aplicação (o fechamento de caixa e a tela de
-- pagamentos gravam pelos dois caminhos).
ALTER TABLE "pagamentos"
  ADD CONSTRAINT "pagamentos_valores_nao_negativos"
  CHECK ("valor_devido" >= 0 AND "valor_pago" >= 0),
  ADD CONSTRAINT "pagamentos_pago_nao_excede_devido"
  CHECK ("valor_pago" <= "valor_devido");

ALTER TABLE "pagamento_lancamentos"
  ADD CONSTRAINT "pagamento_lancamentos_valor_positivo"
  CHECK ("valor" > 0);

ALTER TABLE "fechamento_caixa_itens"
  ADD CONSTRAINT "fechamento_itens_valores_nao_negativos"
  CHECK ("valor_devido" >= 0 AND "valor_pago" >= 0);

-- Notas de avaliação, quando informadas, ficam em 1..5 (a nota geral é obrigatória).
ALTER TABLE "avaliacoes"
  ADD CONSTRAINT "avaliacoes_notas_1_a_5"
  CHECK (
    "nota" BETWEEN 1 AND 5
    AND ("nota_pontualidade" IS NULL OR "nota_pontualidade" BETWEEN 1 AND 5)
    AND ("nota_comunicacao" IS NULL OR "nota_comunicacao" BETWEEN 1 AND 5)
    AND ("nota_trabalho_equipe" IS NULL OR "nota_trabalho_equipe" BETWEEN 1 AND 5)
    AND ("nota_qualidade" IS NULL OR "nota_qualidade" BETWEEN 1 AND 5)
    AND ("nota_comprometimento" IS NULL OR "nota_comprometimento" BETWEEN 1 AND 5)
  );

-- Só pode existir UM bloqueio vigente por par empresa×trabalhador (histórico de
-- bloqueios anteriores continua na tabela, com removido_em preenchido).
CREATE UNIQUE INDEX "trabalhador_bloqueios_vigente_unico"
  ON "trabalhador_bloqueios" ("empresa_id", "user_id")
  WHERE "removido_em" IS NULL;

-- Uma contestação em aberto por pagamento (evita fila de contestações duplicadas
-- do mesmo trabalhador para o mesmo pagamento).
CREATE UNIQUE INDEX "contestacoes_abertas_unica_por_pagamento"
  ON "contestacoes_pagamento" ("pagamento_id")
  WHERE "status" IN ('ABERTA', 'EM_ANALISE');
