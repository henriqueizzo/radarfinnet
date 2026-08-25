-- ============================================================
-- RADAR REGULATÓRIO FINNET — migração de 24/08/2026
--
-- Para bancos que JÁ EXISTEM. Como aplicar: no painel do Supabase,
-- abra "SQL Editor", cole este arquivo INTEIRO e clique em RUN.
--
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- Quem criar o banco do zero com o schema.sql atual NÃO precisa
-- rodar isto — ele já inclui estas mudanças.
--
-- O que muda:
--   1. noticias ganha a coluna prioridade, CALCULADA pelo próprio
--      banco a partir da categoria (ninguém precisa preencher nada):
--        1 = Normativo   2 = Comunicado/Consulta Pública   3 = o resto
--      É ela que permite o feed ordenar "por prioridade".
--   2. Nova tabela comunicacoes: registro do que chega pelos canais
--      FECHADOS do BC (BC Correio, UNICAD, Protocolo Digital, CRD…),
--      com classificação, prazo, plano de ação e status de resposta.
-- ============================================================

-- ---------- 1. Coluna prioridade em noticias ----------

alter table noticias
  add column if not exists prioridade smallint
    generated always as (
      case categoria
        when 'Normativo'        then 1
        when 'Comunicado'       then 2
        when 'Consulta Pública' then 2
        else 3
      end
    ) stored;

-- Índice na dupla (prioridade, data) — é exatamente a ordem que o feed pede
create index if not exists idx_noticias_prioridade
  on noticias (prioridade, data_publicacao desc);

-- ---------- 2. Tabela comunicacoes ----------
-- Cada linha = uma comunicação oficial recebida (registrada à mão pelo
-- time, porque esses canais exigem login da instituição no site do BC).

create table if not exists comunicacoes (
  id                uuid primary key default gen_random_uuid(),
  canal             text not null,                       -- 'BC Correio', 'UNICAD', 'Protocolo Digital'...
  tipo              text not null,                       -- 'Informação', 'Exigência', 'Fiscalização'...
  assunto           text not null,
  descricao         text default '',
  recebida_em       date,                                -- quando a comunicação chegou
  prazo             date,                                -- prazo de resposta (se houver)
  area_responsavel  text default '',
  documentos        text default '',                     -- documentos requeridos
  impacto           text default '',                     -- impacto potencial para a Finnet
  reporte_diretoria boolean not null default false,      -- precisa reportar à Diretoria/Conselho?
  plano_acao        text default '',                     -- plano de ação (sugerido pelo sistema, editável)
  status_resposta   text not null default 'Sem resposta'
                    check (status_resposta in ('Sem resposta', 'Em andamento', 'Respondida')),
  criado_por        text default '',                     -- e-mail de quem registrou
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists idx_comunicacoes_prazo  on comunicacoes (prazo);
create index if not exists idx_comunicacoes_status on comunicacoes (status_resposta);

alter table comunicacoes enable row level security;

-- Toda a equipe logada e ativa registra, consulta, atualiza e remove
drop policy if exists "equipe le comunicacoes" on comunicacoes;
create policy "equipe le comunicacoes"      on comunicacoes for select to authenticated using (usuario_ativo());

drop policy if exists "equipe registra comunicacoes" on comunicacoes;
create policy "equipe registra comunicacoes" on comunicacoes for insert to authenticated with check (usuario_ativo());

drop policy if exists "equipe atualiza comunicacoes" on comunicacoes;
create policy "equipe atualiza comunicacoes" on comunicacoes for update to authenticated using (usuario_ativo()) with check (usuario_ativo());

drop policy if exists "equipe remove comunicacoes" on comunicacoes;
create policy "equipe remove comunicacoes"  on comunicacoes for delete to authenticated using (usuario_ativo());
