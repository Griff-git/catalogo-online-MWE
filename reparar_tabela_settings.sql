-- SCRIPT DE REPARAÇÃO DE TABELA --
USE u608788898_catalogo;

-- Este script APAGA a tabela de configurações e a cria novamente do zero.
-- Use apenas se as configurações não estiverem salvando.

DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
    id INT PRIMARY KEY,
    primaryColor VARCHAR(20) DEFAULT '#fc5200',
    secondaryColor VARCHAR(20) DEFAULT '#1e293b',
    companyName VARCHAR(100) DEFAULT 'MWE Autopeças',
    footerText VARCHAR(255) DEFAULT 'MWE Distribuidora © 2025',
    logoUrl TEXT,
    faviconUrl TEXT,
    supportEmail VARCHAR(100),
    supportPhone VARCHAR(20),
    instagramUrl TEXT,
    linkedinUrl TEXT,
    facebookUrl TEXT,
    youtubeUrl TEXT,
    tiktokUrl TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (id, primaryColor, secondaryColor, companyName, footerText, logoUrl, faviconUrl, supportEmail, supportPhone, instagramUrl, facebookUrl)
VALUES (
    1, 
    '#fc5200', 
    '#1e293b', 
    'MWE', 
    'MWE Comércio e Distribuidora de Autopeças © 2026', 
    'https://mwedistribuidora.com.br/wp-content/uploads/2024/03/mwe-preto.png',
    '',
    'contato@mwedistribuidora.com.br',
    '+55 11 93923-6169',
    'https://www.instagram.com/qualykits/',
    'https://www.facebook.com/profile.php?id=61583188140686'
);
