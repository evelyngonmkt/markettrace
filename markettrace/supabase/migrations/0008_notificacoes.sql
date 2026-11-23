-- =====================================================================
-- MarketTrace · 0008 · App no celular e notificações por empresa
-- Cada pessoa liga as notificações em cada aparelho e escolhe, por empresa,
-- o que quer receber. Quem envia é a função "notificar" (Edge Function).
-- Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: os meus" on public.push_subscriptions;
create policy "push: os meus" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push: apagar os meus" on public.push_subscriptions;
create policy "push: apagar os meus" on public.push_subscriptions for delete using (user_id = auth.uid());
revoke insert, update on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- grava (ou troca de dono) a assinatura deste aparelho
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if p_endpoint !~ '^https://' then raise exception 'Endereço de notificação inválido.'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, aparelho)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_aparelho, 200))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, aparelho = excluded.aparelho;
end $$;

-- o que cada pessoa quer receber, por empresa
create table if not exists public.notification_prefs (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  hora_publicar boolean not null default true,
  tarefas_hoje boolean not null default true,
  primary key (user_id, company_id)
);
alter table public.notification_prefs enable row level security;
drop policy if exists "prefs: as minhas" on public.notification_prefs;
create policy "prefs: as minhas" on public.notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_company(company_id));
grant select, insert, update, delete on public.notification_prefs to authenticated;

-- registro do que já foi enviado (evita repetir)
create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  tipo text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, tipo, ref)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- configuração privada do envio (token que só o banco e a função conhecem)
create table if not exists public.push_settings (
  id int primary key default 1 check (id = 1),
  token text not null default encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex'),
  funcao_url text
);
insert into public.push_settings (id) values (1) on conflict do nothing;
alter table public.push_settings enable row level security;
revoke all on public.push_settings from anon, authenticated;

-- chama a função "notificar" (usado pelo agendamento e pelos gatilhos)
create or replace function public.push_dispatch(p_tipo text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.push_settings;
begin
  select * into s from public.push_settings where id = 1;
  if s.funcao_url is null then return; end if;
  begin
    perform net.http_post(
      url := s.funcao_url,
      body := jsonb_build_object('tipo', p_tipo, 'ref', p_ref),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-markettrace-token', s.token),
      timeout_milliseconds := 10000);
  exception when others then null;
  end;
end $$;
revoke execute on function public.push_dispatch(text, text) from public, anon, authenticated;

-- resposta do suporte: avisa na hora quem abriu o chamado
create or replace function public.push_on_ticket_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.do_admin then perform public.push_dispatch('suporte', new.id::text); end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists push_ticket_reply on public.ticket_messages;
create trigger push_ticket_reply after insert on public.ticket_messages
for each row execute function public.push_on_ticket_reply();

-- agendamentos: posts na hora (a cada 5 min) e tarefas do dia (9h de Brasília = 12h UTC)
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron indisponível: os lembretes automáticos ficam desligados (%).', sqlerrm;
end $$;
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('mt-hora-publicar', 'mt-tarefas-hoje');
  perform cron.schedule('mt-hora-publicar', '*/5 * * * *', $c$ select public.push_dispatch('hora_publicar') $c$);
  perform cron.schedule('mt-tarefas-hoje', '0 12 * * *', $c$ select public.push_dispatch('tarefas_hoje') $c$);
exception when others then
  raise notice 'Agendamentos não criados (%).', sqlerrm;
end $$;

grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
revoke execute on function public.push_subscribe(text, text, text, text) from anon;
