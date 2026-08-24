-- ============================================================
-- RADAR REGULATÓRIO FINNET — migração de 24/08/2026
--
-- Para bancos que JÁ EXISTEM. Como aplicar: no painel do Supabase,
-- abra "SQL Editor", cole este arquivo INTEIRO e clique em RUN.
--
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- Quem criar o banco do zero com o schema.sql atual NÃO precisa
-- rodar isto — ele já inclui esta mudança.
--
-- O que muda:
--   noticias ganha a coluna prioridade, CALCULADA pelo próprio banco
--   a partir da categoria (ninguém precisa preencher nada):
--     1 = Normativo   2 = Comunicado   3 = todo o resto
--   É ela que permite o feed ordenar "por prioridade".
-- ============================================================

alter table noticias
  add column if not exists prioridade smallint
    generated always as (
      case categoria
        when 'Normativo'  then 1
        when 'Comunicado' then 2
        else 3
      end
    ) stored;

-- Índice na dupla (prioridade, data) — é exatamente a ordem que o feed pede
create index if not exists idx_noticias_prioridade
  on noticias (prioridade, data_publicacao desc);
