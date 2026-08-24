-- ============================================================
-- RADAR REGULATÓRIO FINNET — migração de 16/08/2026
--
-- Para bancos que JÁ EXISTEM (criados com o schema.sql antigo).
-- Como aplicar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo INTEIRO e clique em RUN.
--
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- Quem criar o banco do zero com o schema.sql atual NÃO precisa
-- rodar isto — ele já inclui todas estas mudanças.
--
-- O que muda:
--   1. Auditoria confiável: quem grava histórico/atividade agora
--      precisa informar o PRÓPRIO e-mail (usuario_email = auth.email()).
--   2. Nova tabela coletas_execucoes (saúde das coletas do robô).
--   3. noticias ganha as colunas descartada e temas_manuais,
--      e o time passa a poder atualizar notícias (curadoria).
--   4. Índice GIN em noticias.temas (busca rápida por tema).
-- ============================================================

-- ---------- 1. Auditoria confiável ----------
-- Antes bastava estar ativo; agora o e-mail gravado no registro
-- tem que ser o e-mail de quem está logado (auth.email()).
-- Atenção: o site precisa preencher usuario_email com o e-mail
-- do usuário logado, senão o insert é recusado.

drop policy if exists "equipe grava historico" on radar_eventos;
create policy "equipe grava historico" on radar_eventos
  for insert to authenticated
  with check (usuario_ativo() and usuario_email = auth.email());

drop policy if exists "equipe registra atividade" on atividades;
create policy "equipe registra atividade" on atividades
  for insert to authenticated
  with check (usuario_ativo() and usuario_email = auth.email());

-- ---------- 2. Tabela coletas_execucoes ----------
-- Cada linha = uma execução do robô coletor para uma fonte.

create table if not exists coletas_execucoes (
  id          bigint generated always as identity primary key,
  fonte       text,                        -- 'Banco Central', 'Coaf', 'Febraban'...
  iniciada_em timestamptz default now(),
  duracao_ms  int,                         -- quanto tempo levou (milissegundos)
  itens       int,                         -- quantos itens a fonte trouxe
  erro        text                         -- null = deu tudo certo
);

alter table coletas_execucoes enable row level security;

-- Equipe logada e ativa pode LER (para ver a saúde das coletas).
drop policy if exists "equipe le coletas" on coletas_execucoes;
create policy "equipe le coletas" on coletas_execucoes
  for select to authenticated using (usuario_ativo());

-- Só o robô (chave service_role) grava e atualiza.
-- Obs.: a service_role já passa por cima do RLS; as policies abaixo
-- deixam essa intenção explícita e documentada.
drop policy if exists "robo grava coletas" on coletas_execucoes;
create policy "robo grava coletas" on coletas_execucoes
  for insert to service_role with check (true);

drop policy if exists "robo atualiza coletas" on coletas_execucoes;
create policy "robo atualiza coletas" on coletas_execucoes
  for update to service_role using (true) with check (true);

-- ---------- 3. Colunas novas em noticias ----------

alter table noticias
  add column if not exists descartada boolean not null default false;   -- true = time descartou do feed

alter table noticias
  add column if not exists temas_manuais text[];                        -- temas adicionados à mão pelo time

-- Curadoria: o time logado e ativo pode ATUALIZAR notícias
-- (arquivar/restaurar e temas manuais). Sem esta policy, o RLS
-- bloquearia a gravação em silêncio (sucesso com 0 linhas).
drop policy if exists "equipe faz curadoria" on noticias;
create policy "equipe faz curadoria" on noticias
  for update to authenticated
  using (usuario_ativo()) with check (usuario_ativo());

-- ---------- 4. Índice GIN em noticias.temas ----------
-- Acelera filtros do tipo "temas contém 'Pix'".

create index if not exists idx_noticias_temas on noticias using gin (temas);
