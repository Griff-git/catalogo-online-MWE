-- Migration V7: Adicionar campo clientName para pedidos de revendedores
ALTER TABLE orders ADD COLUMN clientName VARCHAR(255) DEFAULT NULL AFTER userStoreName;
