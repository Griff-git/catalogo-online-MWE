-- Script Completo de Instalação do Banco de Dados
-- Rode este arquivo na aba "Importar" ou "SQL" do seu phpMyAdmin

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    storeName VARCHAR(255) NOT NULL,
    responsibleName VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'RETAILER') DEFAULT 'RETAILER',
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE') DEFAULT 'PENDING',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    internalCode VARCHAR(50) NOT NULL,
    parallelCodes TEXT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer VARCHAR(100), -- Nova
    vehicle VARCHAR(100),      -- Nova
    compatibility_json LONGTEXT, -- NOVA COLUNA: JSON para pares
    application TEXT,
    -- side REMOVIDO
    kitComponents TEXT,
    group_name VARCHAR(100),   -- Renomeado de category
    position VARCHAR(100),     -- Renomeado de subcategory
    price DECIMAL(10, 2) NOT NULL,
    images LONGTEXT, -- JSON string
    stock INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    userId VARCHAR(50),
    userStoreName VARCHAR(255),
    total DECIMAL(10, 2),
    status VARCHAR(50),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    items LONGTEXT -- JSON string
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabela de Configurações (Faltava esta!)
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY,
    primaryColor VARCHAR(20) DEFAULT '#fc5200',
    secondaryColor VARCHAR(20) DEFAULT '#1e293b',
    companyName VARCHAR(100) DEFAULT 'MWE Autopeças',
    footerText VARCHAR(255) DEFAULT 'MWE Distribuidora © 2025',
    logoUrl TEXT,
    supportEmail VARCHAR(100),
    supportPhone VARCHAR(20),
    instagramUrl TEXT,
    linkedinUrl TEXT,
    facebookUrl TEXT,
    youtubeUrl TEXT,
    tiktokUrl TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Inserir Usuário Administrador (Senha: admin123)
-- Estamos usando INSERT IGNORE para não dar erro se já existir
INSERT IGNORE INTO users (id, storeName, responsibleName, cnpj, phone, email, password, role, status, createdAt)
VALUES ('admin-1', 'MWE Admin', 'Administrador', '00.000.000/0001-00', '1199999999', 'admin@admin.com', 'admin123', 'ADMIN', 'APPROVED', NOW());

-- 6. Inserir Configuração Padrão
INSERT IGNORE INTO settings (id, primaryColor, secondaryColor, companyName, footerText, supportEmail)
VALUES (1, '#fc5200', '#1e293b', 'MWE Autopeças', 'MWE Distribuidora © 2025 - Portal B2B', 'contato@mwe.com.br');
