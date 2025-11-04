CREATE TABLE `empresas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `cnpj` VARCHAR(18) NOT NULL UNIQUE,
  `endereco` VARCHAR(255),
  `telefone` VARCHAR(20)
);

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `senha_hash` VARCHAR(255) NOT NULL,
  `tipo_usuario` ENUM('empresa', 'funcionario', 'supervisor') NOT NULL,
  `empresa_id` INT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE
);

CREATE TABLE `funcionarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `cpf` VARCHAR(14) NOT NULL UNIQUE,
  `rg` VARCHAR(20),
  `telefone` VARCHAR(20),
  `endereco` VARCHAR(255),
  `conta_bancaria` VARCHAR(255),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `eventos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `empresa_id` INT NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `data_inicio` DATETIME NOT NULL,
  `data_fim` DATETIME NOT NULL,
  `local` VARCHAR(255),
  `status` ENUM('planejado', 'ativo', 'concluido', 'cancelado') DEFAULT 'planejado',
  FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE
);

CREATE TABLE `vagas_evento` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `evento_id` INT NOT NULL,
  `cargo` VARCHAR(100) NOT NULL,
  `qtd` INT NOT NULL,
  `horario_inicio` TIME NOT NULL,
  `horario_fim` TIME NOT NULL,
  `salario` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON DELETE CASCADE
);

CREATE TABLE `convites` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vaga_id` INT NOT NULL,
  `funcionario_id` INT NOT NULL,
  `status` ENUM('pendente', 'aceito', 'recusado') DEFAULT 'pendente',
  `data_convite` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `data_resposta` DATETIME,
  FOREIGN KEY (`vaga_id`) REFERENCES `vagas_evento`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE
);

CREATE TABLE `presencas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `funcionario_id` INT NOT NULL,
  `evento_id` INT NOT NULL,
  `checkin` DATETIME,
  `checkout` DATETIME,
  FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON DELETE CASCADE
);

CREATE TABLE `pagamentos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `funcionario_id` INT NOT NULL,
  `evento_id` INT NOT NULL,
  `valor` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pendente', 'pago', 'cancelado') DEFAULT 'pendente',
  `data_pagamento` DATE,
  FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON DELETE CASCADE
);