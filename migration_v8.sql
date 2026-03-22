-- Migration V8: Adicionar coluna paymentMethod na tabela de pedidos
-- Armazena a condição de pagamento escolhida pelo cliente

ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(255) DEFAULT NULL AFTER clientName;
