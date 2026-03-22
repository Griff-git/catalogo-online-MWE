-- Migration V6: Revendedor + Permissões
-- Rode este script no phpMyAdmin ANTES de atualizar o frontend e api.php

-- 1. Adicionar RESELLER ao ENUM de role
ALTER TABLE users MODIFY role ENUM('ADMIN','RETAILER','RESELLER') DEFAULT 'RETAILER';

-- 2. Adicionar coluna de permissões (JSON array como texto)
ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL;
