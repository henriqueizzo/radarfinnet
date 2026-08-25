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
  descartada      boolean not null default false, -- true = time descartou a notícia do feed
  temas_manuais   text[],                       -- temas adicionados à mão pelo time
  -- prioridade CALCULADA pelo banco a partir da categoria (o feed ordena por ela):
  -- 1 = Normativo · 2 = Comunicado/Consulta Pública · 3 = todo o resto
  prioridade      smallint generated always as (
                    case categoria
                      when 'Normativo'        then 1
                      when 'Comunicado'       then 2
                      when 'Consulta Pública' then 2
                      else 3
                    end
                  ) stored,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_noticias_data  on noticias (data_publicacao desc);
create index if not exists idx_noticias_fonte on noticias (fonte);
create index if not exists idx_noticias_temas on noticias using gin (temas); -- busca rápida por tema
create index if not exists idx_noticias_prioridade on noticias (prioridade, data_publicacao desc);

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

-- ---------- Tabela 6: execuções do robô coletor (saúde das coletas) ----------
create table if not exists coletas_execucoes (
  id          bigint generated always as identity primary key,
  fonte       text,                        -- 'Banco Central', 'Coaf', 'Febraban'...
  iniciada_em timestamptz default now(),
  duracao_ms  int,                         -- quanto tempo levou (milissegundos)
  itens       int,                         -- quantos itens a fonte trouxe
  erro        text                         -- null = deu tudo certo
);

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

alter table noticias          enable row level security;
alter table radar_itens       enable row level security;
alter table radar_eventos     enable row level security;
alter table perfis            enable row level security;
alter table atividades        enable row level security;
alter table coletas_execucoes enable row level security;

-- (o "drop policy if exists" antes de cada policy permite rodar
--  este arquivo de novo, quantas vezes precisar, sem dar erro)

drop policy if exists "equipe le noticias" on noticias;
create policy "equipe le noticias"      on noticias      for select to authenticated using (usuario_ativo());

-- Curadoria: o time logado e ativo pode ATUALIZAR notícias
-- (arquivar/restaurar e temas manuais). Sem esta policy, o RLS
-- bloquearia a gravação em silêncio (sucesso com 0 linhas).
drop policy if exists "equipe faz curadoria" on noticias;
create policy "equipe faz curadoria"    on noticias      for update to authenticated using (usuario_ativo()) with check (usuario_ativo());

drop policy if exists "equipe le radar" on radar_itens;
create policy "equipe le radar"         on radar_itens   for select to authenticated using (usuario_ativo());

drop policy if exists "equipe cria no radar" on radar_itens;
create policy "equipe cria no radar"    on radar_itens   for insert to authenticated with check (usuario_ativo());

drop policy if exists "equipe atualiza radar" on radar_itens;
create policy "equipe atualiza radar"   on radar_itens   for update to authenticated using (usuario_ativo()) with check (usuario_ativo());

drop policy if exists "equipe remove do radar" on radar_itens;
create policy "equipe remove do radar"  on radar_itens   for delete to authenticated using (usuario_ativo());

drop policy if exists "equipe le historico" on radar_eventos;
create policy "equipe le historico"     on radar_eventos for select to authenticated using (usuario_ativo());

-- Auditoria confiável: além de estar ativo, o e-mail gravado tem que
-- ser o e-mail de quem está logado (auth.email()).
drop policy if exists "equipe grava historico" on radar_eventos;
create policy "equipe grava historico"  on radar_eventos for insert to authenticated with check (usuario_ativo() and usuario_email = auth.email());

drop policy if exists "equipe ve perfis" on perfis;
create policy "equipe ve perfis"        on perfis        for select to authenticated using (usuario_ativo());

drop policy if exists "admin edita perfis" on perfis;
create policy "admin edita perfis"      on perfis        for update to authenticated using (usuario_admin()) with check (usuario_admin());

drop policy if exists "equipe registra atividade" on atividades;
create policy "equipe registra atividade" on atividades  for insert to authenticated with check (usuario_ativo() and usuario_email = auth.email());

drop policy if exists "admin le atividades" on atividades;
create policy "admin le atividades"       on atividades  for select to authenticated using (usuario_admin());

-- coletas_execucoes: equipe lê; só o robô (service_role) grava/atualiza.
-- Obs.: a service_role já passa por cima do RLS; as policies abaixo
-- deixam essa intenção explícita e documentada.
drop policy if exists "equipe le coletas" on coletas_execucoes;
create policy "equipe le coletas"       on coletas_execucoes for select to authenticated using (usuario_ativo());

drop policy if exists "robo grava coletas" on coletas_execucoes;
create policy "robo grava coletas"      on coletas_execucoes for insert to service_role with check (true);

drop policy if exists "robo atualiza coletas" on coletas_execucoes;
create policy "robo atualiza coletas"   on coletas_execucoes for update to service_role using (true) with check (true);

-- ---------- Tabela 7: comunicações dos canais fechados do BC ----------
-- O que chega por BC Correio, UNICAD, Protocolo Digital, Siscom/Siscon,
-- CRD etc. é registrado À MÃO pelo time (esses sistemas exigem login da
-- instituição). O sistema classifica, cobra prazo e sugere plano de ação.

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
create policy "equipe le comunicacoes"       on comunicacoes for select to authenticated using (usuario_ativo());

drop policy if exists "equipe registra comunicacoes" on comunicacoes;
create policy "equipe registra comunicacoes" on comunicacoes for insert to authenticated with check (usuario_ativo());

drop policy if exists "equipe atualiza comunicacoes" on comunicacoes;
create policy "equipe atualiza comunicacoes" on comunicacoes for update to authenticated using (usuario_ativo()) with check (usuario_ativo());

drop policy if exists "equipe remove comunicacoes" on comunicacoes;
create policy "equipe remove comunicacoes"   on comunicacoes for delete to authenticated using (usuario_ativo());
