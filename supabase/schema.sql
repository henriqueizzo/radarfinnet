-- ============================================================
-- RADAR REGULATÓRIO FINNET — banco de dados
--
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo INTEIRO e clique em RUN. Pronto.
--
-- Dica: o PRIMEIRO usuário criado vira administrador sozinho.
-- ============================================================

-- ---------- Tabela 1: as notícias/novidades coletadas ----------
create table if not exists noticias (
  id              uuid primary key default gen_random_uuid(),
  fonte           text not null,                -- 'Banco Central', 'Coaf', 'Febraban', 'Open Finance'
  categoria       text not null default 'Notícia', -- 'Normativo', 'Comunicado', 'Notícia', 'Wiki', 'Release'
  titulo          text not null,
  resumo          text default '',
  url             text not null unique,         -- o unique evita duplicar a mesma notícia
  data_publicacao timestamptz,
  temas           text[] not null default '{}', -- temas Finnet detectados (Pix, Open Finance, PLD/FT...)
  criado_em       timestamptz not null default now()
);

create index if not exists idx_noticias_data  on noticias (data_publicacao desc);
create index if not exists idx_noticias_fonte on noticias (fonte);

-- ---------- Tabela 2: os cards do Radar (o "CRM") ----------
create table if not exists radar_itens (
  id            uuid primary key default gen_random_uuid(),
  noticia_id    uuid not null unique references noticias (id) on delete cascade,
  status        text not null default 'Encontrado'
                check (status in ('Encontrado', 'Avaliando', 'Desenvolvimento', 'Entregue')),
  responsavel   text not null default '',
  observacoes   text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_radar_status on radar_itens (status);

-- ---------- Tabela 3: histórico de movimentações dos cards ----------
create table if not exists radar_eventos (
  id            bigint generated always as identity primary key,
  radar_id      uuid not null references radar_itens (id) on delete cascade,
  de_status     text,
  para_status   text not null,
  usuario_email text default '',
  quando        timestamptz not null default now()
);

-- ---------- Tabela 4: perfis dos usuários (espelho do login) ----------
-- Cada usuário criado no Supabase ganha automaticamente uma linha aqui
-- (trigger mais abaixo). is_admin controla as abas Usuários/Atividade.
create table if not exists perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null default '',
  email     text not null default '',
  is_admin  boolean not null default false,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- Tabela 5: log de atividades (auditoria de uso) ----------
create table if not exists atividades (
  id            bigint generated always as identity primary key,
  usuario_email text not null default '',
  tipo          text not null,           -- 'login', 'enviar_radar', 'mover_status', 'editar_card', 'remover_card'
  detalhe       text not null default '',
  noticia_id    uuid references noticias (id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_atividades_data on atividades (criado_em desc);

-- ---------- atualizado_em automático ao editar um card ----------
create or replace function marcar_atualizado()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_radar_atualizado on radar_itens;
create trigger trg_radar_atualizado
  before update on radar_itens
  for each row execute function marcar_atualizado();

-- ---------- Perfil automático para cada usuário novo ----------
-- O PRIMEIRO usuário do sistema vira administrador automaticamente.
create or replace function criar_perfil_automatico()
returns trigger
security definer set search_path = public
as $$
begin
  insert into perfis (id, nome, email, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.email, ''),
    not exists (select 1 from perfis)   -- primeiro usuário = admin
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_perfil_automatico on auth.users;
create trigger trg_perfil_automatico
  after insert on auth.users
  for each row execute function criar_perfil_automatico();

-- ---------- Funções de apoio para as regras de segurança ----------
-- (security definer: podem ler perfis sem cair nas próprias regras)
create or replace function usuario_ativo()
returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo);
$$ language sql;

create or replace function usuario_admin()
returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from perfis where id = auth.uid() and is_admin and ativo);
$$ language sql;

-- ---------- Segurança (RLS) ----------
-- Regra geral: só quem está LOGADO e ATIVO lê e mexe nos dados.
-- Abas administrativas (log de atividades, editar perfis): só admin.
-- O robô coletor usa a chave service_role, que passa por cima do RLS
-- (por isso ela é secreta e só vive nos Secrets do GitHub).

alter table noticias      enable row level security;
alter table radar_itens   enable row level security;
alter table radar_eventos enable row level security;
alter table perfis        enable row level security;
alter table atividades    enable row level security;

create policy "equipe le noticias"      on noticias      for select to authenticated using (usuario_ativo());
create policy "equipe le radar"         on radar_itens   for select to authenticated using (usuario_ativo());
create policy "equipe cria no radar"    on radar_itens   for insert to authenticated with check (usuario_ativo());
create policy "equipe atualiza radar"   on radar_itens   for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
create policy "equipe remove do radar"  on radar_itens   for delete to authenticated using (usuario_ativo());
create policy "equipe le historico"     on radar_eventos for select to authenticated using (usuario_ativo());
create policy "equipe grava historico"  on radar_eventos for insert to authenticated with check (usuario_ativo());

create policy "equipe ve perfis"        on perfis        for select to authenticated using (usuario_ativo());
create policy "admin edita perfis"      on perfis        for update to authenticated using (usuario_admin()) with check (usuario_admin());

create policy "equipe registra atividade" on atividades  for insert to authenticated with check (usuario_ativo());
create policy "admin le atividades"       on atividades  for select to authenticated using (usuario_admin());
