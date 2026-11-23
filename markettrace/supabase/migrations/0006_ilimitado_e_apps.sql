-- =====================================================================
-- MarketTrace · 0006 · Contas ilimitadas e integração com apps próprios
-- Rode no SQL Editor depois do 0005. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contas ilimitadas (sem limite de empresas, usuários e equipe)
--    Vale para a conta da administração e para as contas que a
--    administração marcar como ilimitadas (ex.: cortesias).
-- ---------------------------------------------------------------------
alter table public.accounts add column if not exists ilimitado boolean not null default false;
update public.accounts a set ilimitado = true
 where exists (select 1 from public.profiles p where p.id = a.owner_id and p.is_super_admin);

create or replace function public.account_unlimited(acc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.accounts a join public.profiles p on p.id = a.owner_id
    where a.id = acc and (a.ilimitado or p.is_super_admin));
$$;

create or replace function public.admin_set_unlimited(p_account uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito à administração do MarketTrace.';
  end if;
  update public.accounts set ilimitado = p_value where id = p_account;
end $$;

-- ninguém marca a própria conta como ilimitada pelo app
create or replace function public.protect_account_unlimited()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- só vale para quem usa o app (no SQL Editor não há usuário logado)
  if new.ilimitado is distinct from old.ilimitado and auth.uid() is not null and not public.is_super_admin() then
    new.ilimitado := old.ilimitado;
  end if;
  return new;
end $$;
drop trigger if exists before_account_unlimited on public.accounts;
create trigger before_account_unlimited before update on public.accounts
for each row execute function public.protect_account_unlimited();

create or replace function public.check_team_limit(acc uuid, emp uuid[], extra int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if public.account_unlimited(acc) then return; end if;
  for r in select id, nome from public.companies
           where account_id = acc and ativa and (emp is null or id = any (emp)) loop
    if public.company_people(r.id) + extra > public.team_limit() then
      raise exception 'A empresa % já tem % pessoas com acesso (limite atual).', r.nome, public.team_limit();
    end if;
  end loop;
end $$;

create or replace function public.check_company_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_used int;
begin
  if public.account_unlimited(new.account_id) then return new; end if;
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

create or replace function public.handle_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_limit int;
  v_used int;
begin
  if not public.account_unlimited(new.account_id) then
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
  end if;

  new.email := lower(trim(new.email));
  if new.empresas is not null and array_length(new.empresas, 1) is null then new.empresas := null; end if;
  perform public.check_team_limit(new.account_id, new.empresas, 1);

  select id into v_user from public.profiles where email = new.email;
  if v_user is not null then
    insert into public.account_members (account_id, user_id, papel, empresas)
    values (new.account_id, v_user, new.papel, new.empresas)
    on conflict (account_id, user_id) do update
      set empresas = case when public.account_members.empresas is null or excluded.empresas is null then null
                          else (select array_agg(distinct e) from unnest(public.account_members.empresas || excluded.empresas) e) end;
    new.aceito := true;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Apps próprios (CRM, automação, ERP…) recebendo avisos do MarketTrace
--    Cada empresa cadastra o endereço (webhook) do seu app e escolhe os
--    eventos. O envio sai do próprio banco (extensão pg_net), assinado
--    com HMAC-SHA256 para o app conferir que veio do MarketTrace.
-- ---------------------------------------------------------------------
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível: os avisos para apps próprios ficam desligados (%).', sqlerrm;
end $$;

create table if not exists public.app_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  nome text not null check (length(nome) between 1 and 80),
  tipo text not null default 'crm' check (tipo in ('crm','automacao','erp','ecommerce','planilha','outro')),
  url text not null check (url ~ '^https://[^\s]+$' and length(url) <= 500),
  segredo text not null default encode(sha256((gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex'),
  eventos text[] not null default array['post.novo','post.alterado'],
  ativo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists app_connections_company on public.app_connections (company_id);

create table if not exists public.app_deliveries (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.app_connections (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  evento text not null,
  request_id bigint,
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists app_deliveries_conn on public.app_deliveries (connection_id, created_at desc);

alter table public.app_connections enable row level security;
alter table public.app_deliveries enable row level security;

-- o segredo só aparece para quem edita a empresa
drop policy if exists "apps: ler" on public.app_connections;
drop policy if exists "apps: criar" on public.app_connections;
drop policy if exists "apps: editar" on public.app_connections;
drop policy if exists "apps: apagar" on public.app_connections;
create policy "apps: ler" on public.app_connections for select using (public.can_edit_company(company_id) or public.is_super_admin());
create policy "apps: criar" on public.app_connections for insert with check (public.can_edit_company(company_id));
create policy "apps: editar" on public.app_connections for update using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "apps: apagar" on public.app_connections for delete using (public.can_edit_company(company_id));

drop policy if exists "envios: ler" on public.app_deliveries;
create policy "envios: ler" on public.app_deliveries for select using (public.can_edit_company(company_id) or public.is_super_admin());
-- envios são gravados só pelo próprio banco (funções abaixo)

grant select, insert, update, delete on public.app_connections to authenticated, service_role;
grant select on public.app_deliveries to authenticated, service_role;

-- envia um evento para um app (não trava a operação principal se algo falhar)
create or replace function public.send_app_event(conn public.app_connections, p_evento text, p_dados jsonb)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  v_body jsonb;
  v_sig text;
  v_req bigint;
begin
  v_body := jsonb_build_object(
    'evento', p_evento,
    'enviado_em', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'empresa', (select jsonb_build_object('id', c.id, 'nome', c.nome) from public.companies c where c.id = conn.company_id),
    'dados', p_dados);
  v_sig := encode(hmac(v_body::text, conn.segredo, 'sha256'), 'hex');
  begin
    select net.http_post(
      url := conn.url,
      body := v_body,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'User-Agent', 'MarketTrace-Webhook/1.0',
        'X-MarketTrace-Evento', p_evento,
        'X-MarketTrace-Assinatura', 'sha256=' || v_sig),
      timeout_milliseconds := 5000) into v_req;
    insert into public.app_deliveries (connection_id, company_id, evento, request_id)
    values (conn.id, conn.company_id, p_evento, v_req);
  exception when others then
    insert into public.app_deliveries (connection_id, company_id, evento, erro)
    values (conn.id, conn.company_id, p_evento, left(sqlerrm, 300));
  end;
  return v_req;
end $$;
revoke execute on function public.send_app_event(public.app_connections, text, jsonb) from public, anon, authenticated;

-- dispara os eventos quando posts, tarefas, campanhas e vendas mudam
create or replace function public.dispatch_app_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prefixo text := case tg_table_name when 'posts' then 'post' when 'tasks' then 'tarefa' when 'campaigns' then 'campanha' when 'sales' then 'venda' end;
  v_acao text := case tg_op when 'INSERT' then 'novo' when 'UPDATE' then 'alterado' else 'apagado' end;
  v_evento text;
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_company uuid := (v_row ->> 'company_id')::uuid;
  c public.app_connections;
begin
  v_evento := v_prefixo || '.' || v_acao;
  -- publicar um post também gera o evento específico
  if tg_table_name = 'posts' and tg_op = 'UPDATE' and v_row ->> 'status' = 'publicado' and (to_jsonb(old) ->> 'status') is distinct from 'publicado' then
    for c in select * from public.app_connections where company_id = v_company and ativo and 'post.publicado' = any (eventos) loop
      perform public.send_app_event(c, 'post.publicado', v_row - 'created_by');
    end loop;
  end if;
  if tg_table_name = 'tasks' and tg_op = 'UPDATE' and v_row ->> 'status' = 'concluido' and (to_jsonb(old) ->> 'status') is distinct from 'concluido' then
    for c in select * from public.app_connections where company_id = v_company and ativo and 'tarefa.concluida' = any (eventos) loop
      perform public.send_app_event(c, 'tarefa.concluida', v_row - 'created_by');
    end loop;
  end if;
  for c in select * from public.app_connections where company_id = v_company and ativo and v_evento = any (eventos) loop
    perform public.send_app_event(c, v_evento, v_row - 'created_by');
  end loop;
  return null;
exception when others then
  return null; -- integração nunca impede salvar o trabalho
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts','tasks','campaigns','sales'] loop
    execute format('drop trigger if exists app_events on public.%I', t);
    execute format('create trigger app_events after insert or update or delete on public.%I for each row execute function public.dispatch_app_events()', t);
  end loop;
end $$;

-- botão "Enviar teste"
create or replace function public.app_send_test(p_connection uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare c public.app_connections;
begin
  select * into c from public.app_connections where id = p_connection;
  if c.id is null or not public.can_edit_company(c.company_id) then
    raise exception 'Você não tem permissão para testar esta integração.';
  end if;
  return public.send_app_event(c, 'teste', jsonb_build_object('mensagem', 'Teste de conexão do MarketTrace. Se chegou, está tudo certo.'));
end $$;

-- histórico com a resposta do app (código HTTP)
create or replace function public.app_delivery_log(p_connection uuid, p_limit int default 20)
returns table (id bigint, evento text, created_at timestamptz, status_code int, erro text)
language plpgsql stable security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.app_connections where app_connections.id = p_connection;
  if v_company is null or not public.can_edit_company(v_company) then return; end if;
  return query
    select d.id, d.evento, d.created_at, r.status_code,
           coalesce(d.erro, r.error_msg, case when r.status_code >= 400 then left(r.content, 200) end)
    from public.app_deliveries d
    left join net._http_response r on r.id = d.request_id
    where d.connection_id = p_connection
    order by d.created_at desc limit least(p_limit, 50);
end $$;

grant execute on function public.account_unlimited(uuid) to authenticated, service_role;
grant execute on function public.app_send_test(uuid) to authenticated;
grant execute on function public.app_delivery_log(uuid, int) to authenticated;
grant execute on function public.admin_set_unlimited(uuid, boolean) to authenticated;
revoke execute on function public.admin_set_unlimited(uuid, boolean) from anon;
revoke execute on function public.app_send_test(uuid) from anon;
revoke execute on function public.app_delivery_log(uuid, int) from anon;
