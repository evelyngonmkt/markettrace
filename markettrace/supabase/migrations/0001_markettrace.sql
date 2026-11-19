-- =====================================================================
-- MarketTrace · estrutura completa do banco (Supabase / Postgres)
-- Rode este arquivo UMA vez no SQL Editor de um projeto Supabase novo.
-- Três níveis de acesso:
--   super admin  → dona da plataforma (e-mails em platform_admins)
--   assinante    → dono(a) de uma conta (account) e suas empresas
--   membro       → pessoa convidada para a conta (editor ou leitor)
-- Toda tabela tem RLS ativado: cada conta só enxerga os próprios dados.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Quem é administradora da plataforma
-- ---------------------------------------------------------------------
create table public.platform_admins (
  email text primary key
);
insert into public.platform_admins (email) values ('evelyngon.mkt@gmail.com');

-- ---------------------------------------------------------------------
-- 2. Pessoas, planos e contas
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  telefone text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco_mensal numeric(12,2) not null default 0,
  preco_anual numeric(12,2),
  limite_empresas int,          -- vazio = ilimitado
  limite_usuarios int,          -- vazio = ilimitado
  recursos text[] not null default '{}',
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem int default 0,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'profissional' check (tipo in ('agencia','profissional','empresa')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  ciclo text not null default 'mensal' check (ciclo in ('mensal','anual')),
  status text not null default 'trial' check (status in ('trial','ativa','suspensa','cancelada')),
  trial_ate date default (current_date + 14),
  created_at timestamptz not null default now()
);

create table public.account_members (
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  papel text not null default 'editor' check (papel in ('owner','editor','leitor')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  email text not null,
  papel text not null default 'editor' check (papel in ('editor','leitor')),
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  aceito boolean not null default false,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  nome text not null,
  segmento text,
  site text,
  instagram text,
  logo_url text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Dados de trabalho (sempre ligados a uma conta e a uma empresa)
-- ---------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  nome text not null,
  objetivo text,
  canal text,
  status text not null default 'planejada' check (status in ('planejada','ativa','pausada','encerrada')),
  inicio date,
  fim date,
  verba numeric(14,2) default 0,
  observacoes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  data date not null default current_date,
  canal text not null,
  investimento numeric(14,2) default 0,
  receita numeric(14,2) default 0,
  conversoes int default 0,
  leads int default 0,
  novos_clientes int default 0,
  cliques int default 0,
  impressoes int default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  titulo text not null,
  rede text not null default 'instagram',
  formato text,
  data_hora timestamptz,
  status text not null default 'ideia' check (status in ('ideia','rascunho','aprovado','agendado','publicado')),
  legenda text,
  link text,
  alcance int,
  engajamento int,
  salvamentos int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'a_fazer' check (status in ('a_fazer','em_andamento','concluido')),
  responsavel text,
  prazo date,
  etiqueta text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  mes date not null,
  categoria text not null,
  descricao text,
  valor_planejado numeric(14,2) default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  data date not null default current_date,
  descricao text not null,
  categoria text not null,
  valor numeric(14,2) default 0,
  responsavel text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  data date not null default current_date,
  canal text not null,
  pedidos int default 0,
  receita numeric(14,2) default 0,
  taxas numeric(14,2) default 0,
  frete numeric(14,2) default 0,
  custo_produtos numeric(14,2) default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  titulo text not null,
  publico text not null default 'B2B' check (publico in ('B2B','B2C')),
  formato text,
  canal text,
  objetivo text,
  motivo text,
  status text not null default 'nova' check (status in ('nova','em_briefing','aprovada','descartada')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null unique references public.companies (id) on delete cascade,
  ramo text,
  objetivos text[] not null default '{}',
  ciclo text not null default 'Anual' check (ciclo in ('Anual','Semestral')),
  fases jsonb not null default '{}'::jsonb,
  publico_alvo text,
  tensao text,
  conteudos text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  nome text not null,
  instagram text not null,
  site text not null,
  seguidores int,
  posts_semana numeric(6,1),
  agressividade int check (agressividade between 0 and 100),
  presenca int check (presenca between 0 and 100),
  ameaca text check (ameaca in ('baixa','media','alta')),
  movimento text,
  canais text[] not null default '{}',
  ultima_leitura date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.activities (
  id bigserial primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  descricao text not null,
  tabela text,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Atendimento, contato, privacidade, site e auditoria
-- ---------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  aberto_por uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  assunto text not null,
  categoria text not null default 'duvida' check (categoria in ('duvida','problema','financeiro','sugestao','outro')),
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  status text not null default 'aberto' check (status in ('aberto','em_andamento','resolvido','fechado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mensagem text not null,
  do_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  empresa text,
  plano_interesse text,
  mensagem text,
  origem text not null default 'site',
  status text not null default 'novo' check (status in ('novo','em_conversa','convertido','perdido')),
  anotacoes text,
  created_at timestamptz not null default now()
);

create table public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('acesso','correcao','exclusao','portabilidade','outro')),
  detalhes text,
  status text not null default 'aberta' check (status in ('aberta','em_andamento','concluida','negada')),
  prazo date not null default (current_date + 15),
  resposta text,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  acao text not null,
  tabela text not null,
  registro_id text,
  detalhes jsonb,
  created_at timestamptz not null default now()
);

-- Índices úteis
create index on public.account_members (user_id);
create index on public.companies (account_id);
create index on public.metrics (company_id, data);
create index on public.posts (company_id, data_hora);
create index on public.tasks (company_id, status);
create index on public.expenses (company_id, data);
create index on public.sales (company_id, data);
create index on public.activities (account_id, created_at desc);
create index on public.support_tickets (account_id, status);
create index on public.ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- 5. Funções de permissão (usadas nas regras de RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_member(acc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_members where account_id = acc and user_id = auth.uid());
$$;

create or replace function public.can_edit(acc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_members
                 where account_id = acc and user_id = auth.uid() and papel in ('owner','editor'));
$$;

create or replace function public.is_owner(acc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_members
                 where account_id = acc and user_id = auth.uid() and papel = 'owner');
$$;

create or replace function public.shares_account(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_members a
                 join public.account_members b on a.account_id = b.account_id
                 where a.user_id = auth.uid() and b.user_id = other);
$$;

create or replace function public.can_see_ticket(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (select 1 from public.support_tickets s where s.id = t and public.is_member(s.account_id));
$$;

-- ---------------------------------------------------------------------
-- 6. Gatilhos (regras automáticas)
-- ---------------------------------------------------------------------

-- 6.1 Novo usuário: cria perfil, conta, aceita convites e marca a admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  admin boolean := exists (select 1 from public.platform_admins where lower(email) = lower(new.email));
  v_plan uuid;
  v_account uuid;
  v_nome text := coalesce(nullif(meta->>'nome', ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, nome, email, telefone, is_super_admin)
  values (new.id, v_nome, lower(new.email), nullif(meta->>'telefone', ''), admin);

  -- convites pendentes para este e-mail
  insert into public.account_members (account_id, user_id, papel)
  select i.account_id, new.id, i.papel from public.invitations i
  where lower(i.email) = lower(new.email) and not i.aceito
  on conflict do nothing;
  update public.invitations set aceito = true where lower(email) = lower(new.email);

  -- assinante (cadastro pelo site) ou a própria admin: cria a conta
  if admin or nullif(meta->>'conta_nome', '') is not null then
    if nullif(meta->>'plan_id', '') is not null then
      select id into v_plan from public.plans where id = (meta->>'plan_id')::uuid and ativo;
    end if;
    insert into public.accounts (nome, tipo, owner_id, plan_id, ciclo, status, trial_ate)
    values (
      coalesce(nullif(meta->>'conta_nome', ''), v_nome),
      case when meta->>'conta_tipo' in ('agencia','profissional','empresa') then meta->>'conta_tipo' else 'profissional' end,
      new.id, v_plan,
      case when meta->>'ciclo' = 'anual' then 'anual' else 'mensal' end,
      case when admin then 'ativa' else 'trial' end,
      case when admin then null else current_date + 14 end)
    returning id into v_account;

    insert into public.account_members (account_id, user_id, papel) values (v_account, new.id, 'owner');

    if admin then
      insert into public.companies (account_id, nome, segmento, site)
      values (v_account, 'MCI Store', 'Broadcast & Cinema', 'https://www.mci.tv');
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 6.2 Convite para alguém que já tem cadastro: entra na hora
create or replace function public.handle_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_limit int;
  v_used int;
begin
  select p.limite_usuarios into v_limit
  from public.accounts a left join public.plans p on p.id = a.plan_id where a.id = new.account_id;
  if v_limit is not null then
    select (select count(*) from public.account_members where account_id = new.account_id)
         + (select count(*) from public.invitations where account_id = new.account_id and not aceito)
    into v_used;
    if v_used >= v_limit then
      raise exception 'Seu plano permite até % usuários. Fale com o suporte para ampliar.', v_limit;
    end if;
  end if;

  new.email := lower(trim(new.email));
  select id into v_user from public.profiles where email = new.email;
  if v_user is not null then
    insert into public.account_members (account_id, user_id, papel)
    values (new.account_id, v_user, new.papel) on conflict do nothing;
    new.aceito := true;
  end if;
  return new;
end $$;

create trigger before_invitation_insert
before insert on public.invitations
for each row execute function public.handle_invitation();

-- 6.3 Limite de empresas do plano
create or replace function public.check_company_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_used int;
begin
  select p.limite_empresas into v_limit
  from public.accounts a left join public.plans p on p.id = a.plan_id where a.id = new.account_id;
  if v_limit is not null then
    select count(*) into v_used from public.companies where account_id = new.account_id and ativa;
    if v_used >= v_limit then
      raise exception 'Seu plano permite até % empresas ativas. Fale com o suporte para ampliar.', v_limit;
    end if;
  end if;
  return new;
end $$;

create trigger before_company_insert
before insert on public.companies
for each row execute function public.check_company_limit();

-- 6.4 A empresa precisa pertencer à mesma conta do registro
create or replace function public.check_company_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.companies where id = new.company_id and account_id = new.account_id) then
    raise exception 'Empresa inválida para esta conta.';
  end if;
  return new;
end $$;

-- 6.5 Atividade recente (aparece na Visão geral)
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  label text := coalesce(j->>'titulo', j->>'nome', j->>'descricao', j->>'canal', '');
  msg text;
begin
  if tg_table_name = 'sales' then
    label := case j->>'canal' when 'mercado_livre' then 'Mercado Livre' when 'amazon' then 'Amazon'
      when 'loja_oficial' then 'Loja oficial' when 'shopee' then 'Shopee' when 'loja_fisica' then 'Loja física'
      else coalesce(j->>'canal', '') end;
  elsif tg_table_name = 'budgets' then
    label := coalesce(nullif(j->>'descricao', ''), replace(initcap(replace(j->>'categoria', '_', ' ')), 'Midia', 'Mídia'));
  end if;
  if tg_op = 'UPDATE' then
    if tg_table_name = 'tasks' and new.status = 'concluido' and old.status <> 'concluido' then
      msg := 'Tarefa concluída: ' || label;
    elsif tg_table_name = 'posts' and new.status = 'publicado' and old.status <> 'publicado' then
      msg := 'Conteúdo publicado: ' || label;
    else
      return new;
    end if;
  else
    msg := case tg_table_name
      when 'campaigns'   then 'Campanha criada: '
      when 'metrics'     then 'Métricas lançadas: '
      when 'posts'       then 'Conteúdo na agenda: '
      when 'tasks'       then 'Nova tarefa: '
      when 'budgets'     then 'Orçamento planejado: '
      when 'expenses'    then 'Custo lançado: '
      when 'sales'       then 'Vendas registradas: '
      when 'ideas'       then 'Nova ideia: '
      when 'competitors' then 'Concorrente no radar: '
      else 'Registro criado: ' end || label;
  end if;
  insert into public.activities (account_id, company_id, descricao, tabela)
  values (new.account_id, new.company_id, msg, tg_table_name);
  return new;
end $$;

-- 6.6 Mensagens de suporte: marca se é da equipe MarketTrace e movimenta o chamado
create or replace function public.handle_ticket_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.do_admin := public.is_super_admin();
  update public.support_tickets
     set updated_at = now(),
         status = case when new.do_admin and status = 'aberto' then 'em_andamento'
                       when not new.do_admin and status in ('resolvido','fechado') then 'aberto'
                       else status end
   where id = new.ticket_id;
  return new;
end $$;

create trigger before_ticket_message_insert
before insert on public.ticket_messages
for each row execute function public.handle_ticket_message();

-- 6.7 Auditoria (o que muda em contas, planos, chamados, site etc.)
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, acao, tabela, registro_id, detalhes)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(rec->>'id', rec->>'account_id'), rec);
  return coalesce(new, old);
end $$;

-- aplica os gatilhos nas tabelas de trabalho
do $$
declare t text;
begin
  foreach t in array array['campaigns','metrics','posts','tasks','budgets','expenses','sales','ideas','brand_profiles','competitors'] loop
    execute format('create trigger check_company before insert or update on public.%I
                    for each row execute function public.check_company_account()', t);
  end loop;
  foreach t in array array['campaigns','metrics','posts','tasks','budgets','expenses','sales','ideas','competitors'] loop
    execute format('create trigger activity after insert on public.%I
                    for each row execute function public.log_activity()', t);
  end loop;
  foreach t in array array['accounts','plans','companies','account_members','invitations','support_tickets','contact_leads','lgpd_requests','site_settings'] loop
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

create trigger activity_update after update of status on public.tasks
for each row execute function public.log_activity();
create trigger activity_update after update of status on public.posts
for each row execute function public.log_activity();

-- ---------------------------------------------------------------------
-- 7. Ações exclusivas da admin (chamadas pelo backoffice)
-- ---------------------------------------------------------------------
create or replace function public.admin_update_account(
  p_account uuid, p_status text, p_plan uuid, p_trial_ate date, p_ciclo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito à administração do MarketTrace.';
  end if;
  update public.accounts
     set status = p_status, plan_id = p_plan, trial_ate = p_trial_ate, ciclo = coalesce(p_ciclo, ciclo)
   where id = p_account;
end $$;

create or replace function public.admin_set_super_admin(p_user uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito à administração do MarketTrace.';
  end if;
  if p_user = auth.uid() and not p_value then
    raise exception 'Você não pode remover o seu próprio acesso de admin.';
  end if;
  update public.profiles set is_super_admin = p_value where id = p_user;
end $$;

-- Pessoa sem conta (ex.: se cadastrou como convidada, mas o convite não existia) cria a própria conta
create or replace function public.create_my_account(p_nome text, p_tipo text default 'profissional')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from public.accounts where owner_id = auth.uid()) then
    raise exception 'Você já tem uma conta própria.';
  end if;
  insert into public.accounts (nome, tipo, owner_id)
  values (coalesce(nullif(trim(p_nome), ''), 'Minha conta'),
          case when p_tipo in ('agencia','profissional','empresa') then p_tipo else 'profissional' end,
          auth.uid())
  returning id into v_account;
  insert into public.account_members (account_id, user_id, papel) values (v_account, auth.uid(), 'owner');
  return v_account;
end $$;
revoke execute on function public.create_my_account(text, text) from anon;

-- ---------------------------------------------------------------------
-- 8. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.platform_admins enable row level security;  -- sem regras: ninguém lê pelo app

-- perfis
alter table public.profiles enable row level security;
create policy "perfil: ler" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or public.shares_account(id));
create policy "perfil: editar o próprio" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- planos (público vê os ativos; admin gerencia)
alter table public.plans enable row level security;
create policy "planos: ler" on public.plans for select using (ativo or public.is_super_admin());
create policy "planos: admin" on public.plans for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- contas
alter table public.accounts enable row level security;
create policy "contas: ler" on public.accounts for select
  using (public.is_member(id) or public.is_super_admin());
create policy "contas: dono edita nome" on public.accounts for update
  using (public.is_owner(id)) with check (public.is_owner(id));

-- membros
alter table public.account_members enable row level security;
create policy "membros: ler" on public.account_members for select
  using (public.is_member(account_id) or public.is_super_admin());
create policy "membros: dono altera papel" on public.account_members for update
  using (public.is_owner(account_id) and papel <> 'owner')
  with check (public.is_owner(account_id) and papel <> 'owner');
create policy "membros: dono remove" on public.account_members for delete
  using (public.is_owner(account_id) and papel <> 'owner');

-- convites
alter table public.invitations enable row level security;
create policy "convites: ler" on public.invitations for select
  using (public.is_owner(account_id) or public.is_super_admin());
create policy "convites: dono cria" on public.invitations for insert
  with check (public.is_owner(account_id));
create policy "convites: dono apaga" on public.invitations for delete
  using (public.is_owner(account_id));

-- empresas
alter table public.companies enable row level security;
create policy "empresas: ler" on public.companies for select
  using (public.is_member(account_id) or public.is_super_admin());
create policy "empresas: criar" on public.companies for insert with check (public.can_edit(account_id));
create policy "empresas: editar" on public.companies for update
  using (public.can_edit(account_id)) with check (public.can_edit(account_id));
create policy "empresas: apagar" on public.companies for delete using (public.is_owner(account_id));

-- tabelas de trabalho: mesma regra para todas
do $$
declare t text;
begin
  foreach t in array array['campaigns','metrics','posts','tasks','budgets','expenses','sales','ideas','brand_profiles','competitors'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "ler" on public.%I for select using (public.is_member(account_id) or public.is_super_admin())', t);
    execute format('create policy "criar" on public.%I for insert with check (public.can_edit(account_id))', t);
    execute format('create policy "editar" on public.%I for update using (public.can_edit(account_id)) with check (public.can_edit(account_id))', t);
    execute format('create policy "apagar" on public.%I for delete using (public.can_edit(account_id))', t);
  end loop;
end $$;

-- atividades (só leitura; quem escreve são os gatilhos)
alter table public.activities enable row level security;
create policy "atividades: ler" on public.activities for select
  using (public.is_member(account_id) or public.is_super_admin());

-- chamados de suporte
alter table public.support_tickets enable row level security;
create policy "chamados: ler" on public.support_tickets for select
  using (public.is_member(account_id) or public.is_super_admin());
create policy "chamados: abrir" on public.support_tickets for insert
  with check (public.is_member(account_id) and aberto_por = auth.uid() and status = 'aberto');
create policy "chamados: admin atualiza" on public.support_tickets for update
  using (public.is_super_admin()) with check (public.is_super_admin());

alter table public.ticket_messages enable row level security;
create policy "mensagens: ler" on public.ticket_messages for select using (public.can_see_ticket(ticket_id));
create policy "mensagens: escrever" on public.ticket_messages for insert
  with check (public.can_see_ticket(ticket_id) and autor_id = auth.uid());

-- formulário de contato do site (qualquer visitante envia; só a admin lê)
alter table public.contact_leads enable row level security;
create policy "contato: enviar" on public.contact_leads for insert to anon, authenticated
  with check (status = 'novo' and anotacoes is null);
create policy "contato: admin lê" on public.contact_leads for select using (public.is_super_admin());
create policy "contato: admin atualiza" on public.contact_leads for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "contato: admin apaga" on public.contact_leads for delete using (public.is_super_admin());

-- LGPD
alter table public.lgpd_requests enable row level security;
create policy "lgpd: ler" on public.lgpd_requests for select
  using (user_id = auth.uid() or public.is_super_admin());
create policy "lgpd: pedir" on public.lgpd_requests for insert
  with check (user_id = auth.uid() and status = 'aberta' and resposta is null);
create policy "lgpd: admin responde" on public.lgpd_requests for update
  using (public.is_super_admin()) with check (public.is_super_admin());

-- conteúdo do site (público lê; admin edita)
alter table public.site_settings enable row level security;
create policy "site: ler" on public.site_settings for select using (true);
create policy "site: admin edita" on public.site_settings for update
  using (public.is_super_admin()) with check (public.is_super_admin());

-- auditoria
alter table public.audit_log enable row level security;
create policy "auditoria: admin lê" on public.audit_log for select using (public.is_super_admin());

-- Campos que o app NÃO pode alterar direto (evita alguém se promover a admin)
revoke update on public.profiles from anon, authenticated;
grant update (nome, telefone, avatar_url) on public.profiles to authenticated;
revoke update on public.accounts from anon, authenticated;
grant update (nome, tipo) on public.accounts to authenticated;
revoke insert, delete on public.accounts from anon, authenticated;
revoke all on public.platform_admins from anon, authenticated;
revoke execute on function public.admin_update_account(uuid, text, uuid, date, text) from anon;
revoke execute on function public.admin_set_super_admin(uuid, boolean) from anon;

-- ---------------------------------------------------------------------
-- 9. Conteúdo inicial do site (dados reais da Evelyn; editáveis no admin)
-- ---------------------------------------------------------------------
insert into public.site_settings (id, data) values (1, jsonb_build_object(
  'hero_titulo', 'Do dado à decisão.',
  'hero_subtitulo', 'Pesquisa, conteúdo, mídia, orçamento e indicadores no mesmo fluxo de trabalho. Para quem cria, para quem analisa e para quem precisa decidir.',
  'contato_nome', 'Evelyn Gonçalves',
  'contato_cargo', 'Profissional de Marketing · idealizadora do MarketTrace',
  'contato_email', 'evelyngoncalves.marketing@gmail.com',
  'contato_whatsapp', '(85) 99818-4302',
  'contato_whatsapp_link', 'https://wa.me/message/QLNPISU2BUG7J1',
  'contato_instagram', '@evelyn.namidia',
  'contato_linkedin', 'https://www.linkedin.com/in/evelyn-goncalves-oficial/',
  'portfolio_link', '',
  'portfolio', '[]'::jsonb
));
