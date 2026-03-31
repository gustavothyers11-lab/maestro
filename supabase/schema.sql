-- =============================================
-- Maestro — Schema do banco de dados Supabase
-- Cole este SQL no Supabase SQL Editor e execute
-- =============================================

-- Habilita a extensão para gerar UUIDs automaticamente
create extension if not exists "uuid-ossp";

-- =============================================
-- BARALHOS — agrupa flashcards por tema
-- =============================================
create table baralhos (
  id         uuid primary key default uuid_generate_v4(),  -- identificador único
  user_id    uuid not null,                                 -- ID do usuário (Supabase Auth)
  nome       text not null,                                 -- nome do baralho (ex: "Verbos Irregulares")
  tema       text,                                          -- categoria/tema (ex: "Gramática", "Vocabulário")
  cor        text,                                          -- cor hex para exibição no UI (ex: "#1260CC")
  criado_em  timestamp with time zone default now()         -- data de criação
);

-- =============================================
-- AULAS — aulas com PDF e anotações
-- =============================================
create table aulas (
  id         uuid primary key default uuid_generate_v4(),  -- identificador único
  titulo     text not null,                                 -- título da aula
  pdf_url    text,                                          -- URL do PDF no Supabase Storage
  anotacoes  text,                                          -- anotações livres do usuário sobre a aula
  status     text default 'pendente',                       -- status: 'pendente', 'em_andamento', 'concluida'
  criado_em  timestamp with time zone default now()         -- data de criação
);

-- =============================================
-- CARDS — flashcards com dados de SRS
-- =============================================
create table cards (
  id               uuid primary key default uuid_generate_v4(),  -- identificador único
  frente           text not null,                                 -- lado da pergunta do card
  verso            text not null,                                 -- lado da resposta do card
  audio_url        text,                                          -- URL do áudio de pronúncia (Supabase Storage)
  genero           text,                                          -- gênero gramatical (ex: "masculino", "feminino", "neutro")
  baralho_id       uuid references baralhos(id) on delete cascade, -- baralho ao qual pertence
  aula_id          uuid references aulas(id) on delete set null,   -- aula de origem (se gerado automaticamente)
  notas            text,                                          -- anotações extras do usuário
  criado_em        timestamp with time zone default now(),        -- data de criação
  proximo_revisao  timestamp with time zone default now(),        -- quando o card deve ser revisado (SRS)
  intervalo        int default 1,                                 -- intervalo em dias até a próxima revisão
  facilidade       float default 2.5,                             -- fator de facilidade do algoritmo SM-2 (padrão 2.5)
  repeticoes       int default 0                                  -- quantas vezes foi revisado com sucesso seguidas
);

-- =============================================
-- PROGRESSO — histórico de cada revisão feita
-- =============================================
create table progresso (
  id            uuid primary key default uuid_generate_v4(),  -- identificador único
  user_id       uuid not null,                                 -- ID do usuário (Supabase Auth)
  card_id       uuid references cards(id) on delete cascade,   -- card que foi revisado
  resultado     text not null,                                 -- resposta: 'facil', 'bom', 'dificil', 'errei'
  respondido_em timestamp with time zone default now()         -- momento exato da resposta
);

-- =============================================
-- STREAK — registro diário de metas de estudo
-- =============================================
create table streak (
  id            uuid primary key default uuid_generate_v4(),  -- identificador único
  user_id       uuid not null,                                 -- ID do usuário (Supabase Auth)
  data          date not null default current_date,            -- dia do registro
  meta_atingida boolean default false,                         -- se a meta diária de estudo foi atingida

  unique(user_id, data)                                        -- impede duplicatas no mesmo dia
);

-- =============================================
-- ÍNDICES para performance
-- =============================================
create index idx_cards_baralho     on cards(baralho_id);
create index idx_cards_proximo     on cards(proximo_revisao);
create index idx_progresso_user    on progresso(user_id);
create index idx_progresso_card    on progresso(card_id);
create index idx_streak_user_data  on streak(user_id, data);

-- =============================================
-- DIÁRIO — entradas de escrita livre
-- =============================================
create table diario (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null,
  conteudo   text not null,
  correcao   jsonb,                                           -- resultado da correção por IA
  criado_em  timestamp with time zone default now(),
  palavras   int default 0
);

create index idx_diario_user on diario(user_id);
create index idx_diario_data on diario(user_id, criado_em desc);

-- =============================================
-- MISSÕES — missões diárias e semanais
-- =============================================
create table missoes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null,
  titulo          text not null,
  descricao       text,
  tipo            text not null,                                -- 'diaria' ou 'semanal'
  meta            int not null,
  progresso       int default 0,
  xp_recompensa   int not null,
  concluida       boolean default false,
  expira_em       timestamp with time zone,
  criado_em       timestamp with time zone default now()
);

create index idx_missoes_user      on missoes(user_id);
create index idx_missoes_expira    on missoes(user_id, expira_em);
create index idx_missoes_tipo      on missoes(user_id, tipo);

-- =============================================
-- PROFILES — preferências e token FCM por usuário
-- =============================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  fcm_token     text,                                          -- token Firebase Cloud Messaging
  meta_diaria   int default 20,                               -- meta de cards por dia
  modo_escuro   boolean default false,                        -- preferência de tema
  idioma        text,                                          -- idioma de estudo (ex: 'espanhol', 'inglês', 'francês')
  criado_em     timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);

-- Trigger para criar profile automaticamente ao cadastrar usuário
create or replace function criar_profile_usuario()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure criar_profile_usuario();
