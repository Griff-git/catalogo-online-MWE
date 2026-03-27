-- Migration v9: Segurança e funcionalidades novas
-- Executar após todas as migrações anteriores

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    userName VARCHAR(255) DEFAULT '',
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entityId VARCHAR(36) DEFAULT NULL,
    details TEXT,
    ip VARCHAR(45) DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (userId),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity),
    INDEX idx_audit_date (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela de tokens de reset de senha
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_token (token),
    INDEX idx_reset_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Adicionar índices de performance nas tabelas existentes
ALTER TABLE products ADD INDEX idx_products_active (active);
ALTER TABLE products ADD INDEX idx_products_group (group_name);
ALTER TABLE orders ADD INDEX idx_orders_userId (userId);
ALTER TABLE orders ADD INDEX idx_orders_status (status);
ALTER TABLE orders ADD INDEX idx_orders_date (date);
ALTER TABLE users ADD INDEX idx_users_email (email);
ALTER TABLE users ADD INDEX idx_users_status (status);

-- Converter senhas em texto puro para bcrypt (executar via PHP após migration)
-- A API fará isso automaticamente no primeiro login de cada usuário
