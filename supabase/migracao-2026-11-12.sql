-- ============================================================
-- RADAR REGULATÓRIO FINNET — migração de 12/11/2026
--
-- Como aplicar: no painel do Supabase, abra "SQL Editor", cole este
-- arquivo INTEIRO e clique em RUN. Pode rodar mais de uma vez.
-- (Quem criar o banco do zero com o schema.sql atual não precisa.)
--
-- O que muda:
--   Nova tabela tributario_publicacoes: vertical Split Payment &
--   Reforma Tributária. O robô (coletor/coletar-tributario.js) grava
--   aqui, todo dia, o que os bancos integrados à Finnet publicam
--   sobre os dois assuntos; o time trata cada publicação na aba
--   "Split & Reforma" (status, responsável e ação).
-- ============================================================

create table if not exists tributario_publicacoes (
  id              uuid primary key default gen_random_uuid(),
  banco           text not null,                       -- instituição da lista da Finnet
  titulo          text not null,
  url             text not null unique,                -- o unique evita duplicar
  veiculo         text not null default '',            -- quem publicou (o banco ou o jornal)
  origem          text not null default 'Imprensa'
                  check (origem in ('Site do banco', 'Imprensa')),
  assuntos        text[] not null default '{}',        -- 'Split Payment', 'Reforma Tributária'
  sinais          text[] not null default '{}',        -- 'Layout/Integração', 'Prazo/Cronograma'...
  prioridade      text not null default 'Baixa'
                  check (prioridade in ('Alta', 'Média', 'Baixa')),
  status          text not null default 'Novo'
                  check (status in ('Novo', 'Em análise', 'Ação definida', 'Concluído', 'Sem impacto', 'Histórico')),
  responsavel     text not null default '',
  acao            text not null default '',            -- plano de ação / observações do time
  data_publicacao timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists idx_tributario_data   on tributario_publicacoes (data_publicacao desc);
create index if not exists idx_tributario_status on tributario_publicacoes (status);
create index if not exists idx_tributario_banco  on tributario_publicacoes (banco);

drop trigger if exists trg_tributario_atualizado on tributario_publicacoes;
create trigger trg_tributario_atualizado
  before update on tributario_publicacoes
  for each row execute function marcar_atualizado();

alter table tributario_publicacoes enable row level security;

-- Equipe logada e ativa lê e trata; quem grava as publicações é o robô
-- (service_role, que passa por cima do RLS)
drop policy if exists "equipe le tributario" on tributario_publicacoes;
create policy "equipe le tributario"      on tributario_publicacoes for select to authenticated using (usuario_ativo());

drop policy if exists "equipe trata tributario" on tributario_publicacoes;
create policy "equipe trata tributario"   on tributario_publicacoes for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
