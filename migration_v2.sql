-- Migração V2: Refatoração do Catálogo
-- Rode este script na aba SQL do phpMyAdmin

-- 1. Renomear Categoria -> Grupo
ALTER TABLE products CHANGE COLUMN category group_name VARCHAR(100);

-- 2. Renomear Subcategoria -> Posição
ALTER TABLE products CHANGE COLUMN subcategory position VARCHAR(100);

-- 3. Remover Lado (Side) - Informação agora estará no nome ou posição
ALTER TABLE products DROP COLUMN side;

-- 4. Adicionar Montadora
ALTER TABLE products ADD COLUMN manufacturer VARCHAR(100) AFTER description;

-- 5. Adicionar Veículo
ALTER TABLE products ADD COLUMN vehicle VARCHAR(100) AFTER manufacturer;
