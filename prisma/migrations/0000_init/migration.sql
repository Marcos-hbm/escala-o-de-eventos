-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "StatusVinculo" AS ENUM ('PENDENTE', 'ATIVO', 'RECUSADO', 'DESVINCULADO');

-- CreateEnum
CREATE TYPE "SolicitadoPor" AS ENUM ('EMPRESA', 'TRABALHADOR');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ESCALADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('INSCRITO', 'ESCALADO', 'RECUSADO_EMPRESA', 'CANCELADO_TRABALHADOR', 'PRESENTE', 'FALTA');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('CONVITE_VINCULO', 'VINCULO_ACEITO', 'VINCULO_RECUSADO', 'NOVO_EVENTO', 'ESCALADO', 'EVENTO_ATUALIZADO', 'EVENTO_CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAtor" AS ENUM ('TRABALHADOR', 'EMPRESA', 'SISTEMA');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "telefone" VARCHAR(11) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "foto_path" VARCHAR(255),
    "genero" "Genero" NOT NULL DEFAULT 'NAO_INFORMADO',
    "anonimizado_em" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(11) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "foto_path" VARCHAR(255),
    "anonimizado_em" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" VARCHAR(180) NOT NULL,
    "descricao" TEXT,
    "data_evento" DATE NOT NULL,
    "local" VARCHAR(200),
    "hora_inicio" VARCHAR(5),
    "vagas" INTEGER NOT NULL DEFAULT 1,
    "funcoes" VARCHAR(400),
    "valor_cache" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "observacoes" TEXT,
    "status" "StatusEvento" NOT NULL DEFAULT 'PUBLICADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'PENDENTE',
    "solicitado_por" "SolicitadoPor" NOT NULL,
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricoes" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "StatusInscricao" NOT NULL DEFAULT 'INSCRITO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "mensagem" VARCHAR(500) NOT NULL,
    "link" VARCHAR(255),
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "ator_tipo" "TipoAtor" NOT NULL,
    "ator_id" INTEGER,
    "acao" VARCHAR(80) NOT NULL,
    "entidade" VARCHAR(80),
    "entidade_id" INTEGER,
    "detalhe" VARCHAR(500),
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "finalidade" VARCHAR(120) NOT NULL,
    "versao" VARCHAR(20) NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT true,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_key" ON "empresas"("email");

-- CreateIndex
CREATE INDEX "eventos_empresa_id_idx" ON "eventos"("empresa_id");

-- CreateIndex
CREATE INDEX "eventos_data_evento_idx" ON "eventos"("data_evento");

-- CreateIndex
CREATE INDEX "vinculos_empresa_id_idx" ON "vinculos"("empresa_id");

-- CreateIndex
CREATE INDEX "vinculos_user_id_idx" ON "vinculos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_user_id_empresa_id_key" ON "vinculos"("user_id", "empresa_id");

-- CreateIndex
CREATE INDEX "inscricoes_evento_id_idx" ON "inscricoes"("evento_id");

-- CreateIndex
CREATE INDEX "inscricoes_user_id_idx" ON "inscricoes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_evento_id_user_id_key" ON "inscricoes"("evento_id", "user_id");

-- CreateIndex
CREATE INDEX "notificacoes_user_id_lida_idx" ON "notificacoes"("user_id", "lida");

-- CreateIndex
CREATE INDEX "audit_logs_ator_tipo_ator_id_idx" ON "audit_logs"("ator_tipo", "ator_id");

-- CreateIndex
CREATE INDEX "audit_logs_acao_idx" ON "audit_logs"("acao");

-- CreateIndex
CREATE INDEX "consentimentos_user_id_idx" ON "consentimentos"("user_id");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

