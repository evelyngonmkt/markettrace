-- =====================================================================
-- MarketTrace · 0007 · Super IA (assistente de marketing)
-- A chave do provedor fica só no banco: nenhuma tela consegue lê-la.
-- Quem usa a chave é a função "super-ia" (Edge Function do Supabase).
-- Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.ai_settings (
  id int primary key default 1 check (id = 1),
  provedor text not null default 'anthropic' check (provedor in ('anthropic','openai','gemini')),
  modelo text not null default 'claude-sonnet-5-5',
  chave text,
  chave_final text,
  pesquisa_web boolean not null default true,
  ativo boolean not null default false,
  limite_sem_plano int not null default 20,
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (1) on conflict do nothing;
alter table public.ai_settings enable row level security;
-- sem regras de acesso: ninguém lê ou grava direto, só pelas funções abaixo
revoke all on public.ai_settings from anon, authenticated;

alter table public.plans add column if not exists ia_mensagens_mes int default 50;
comment on column public.plans.ia_mensagens_mes is 'Mensagens da Super IA por mês (vazio = ilimitado, 0 = sem IA)';

create table if not exists public.ai_messages (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  pergunta text not null,
  resposta text,
  fontes jsonb not null default '[]'::jsonb,
  provedor text,
  modelo text,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conta_mes on public.ai_messages (account_id, created_at desc);
alter table public.ai_messages enable row level security;
drop policy if exists "ia: ler as próprias" on public.ai_messages;
create policy "ia: ler as próprias" on public.ai_messages for select
  using (user_id = auth.uid() or public.is_super_admin());
drop policy if exists "ia: apagar as próprias" on public.ai_messages;
create policy "ia: apagar as próprias" on public.ai_messages for delete using (user_id = auth.uid());
revoke insert, update on public.ai_messages from anon, authenticated;
grant select, delete on public.ai_messages to authenticated;

-- ---------- backoffice ----------
create or replace function public.admin_ai_status()
returns table (provedor text, modelo text, configurada boolean, chave_final text, pesquisa_web boolean, ativo boolean, limite_sem_plano int, mensagens_mes bigint, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Acesso restrito à administração do MarketTrace.'; end if;
  return query select s.provedor, s.modelo, s.chave is not null, s.chave_final, s.pesquisa_web, s.ativo, s.limite_sem_plano,
    (select count(*) from public.ai_messages m where m.created_at >= date_trunc('month', now())), s.updated_at
  from public.ai_settings s where s.id = 1;
end $$;

-- p_chave vazio = mantém a chave atual; p_remover_chave = apaga
create or replace function public.admin_ai_save(p_provedor text, p_modelo text, p_chave text, p_pesquisa_web boolean, p_ativo boolean, p_limite_sem_plano int, p_remover_chave boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_chave text := nullif(trim(coalesce(p_chave, '')), '');
begin
  if not public.is_super_admin() then raise exception 'Acesso restrito à administração do MarketTrace.'; end if;
  if p_provedor not in ('anthropic','openai','gemini') then raise exception 'Provedor inválido.'; end if;
  if coalesce(trim(p_modelo), '') = '' then raise exception 'Informe o modelo.'; end if;
  update public.ai_settings set
    provedor = p_provedor,
    modelo = trim(p_modelo),
    chave = case when p_remover_chave then null when v_chave is not null then v_chave else chave end,
    chave_final = case when p_remover_chave then null when v_chave is not null then right(v_chave, 4) else chave_final end,
    pesquisa_web = p_pesquisa_web,
    ativo = p_ativo and (case when p_remover_chave then false else (v_chave is not null or chave is not null) end),
    limite_sem_plano = greatest(0, coalesce(p_limite_sem_plano, 0)),
    updated_at = now()
  where id = 1;
  insert into public.audit_log (actor_id, acao, tabela, registro_id, detalhes)
  values (auth.uid(), 'update', 'ai_settings', '1', jsonb_build_object('provedor', p_provedor, 'modelo', p_modelo, 'chave_trocada', v_chave is not null, 'chave_removida', p_remover_chave, 'ativo', p_ativo));
end $$;

-- ---------- app: situação da IA e cota da conta ----------
create or replace function public.ai_quota(p_account uuid)
returns table (disponivel boolean, usadas bigint, limite int)
language plpgsql stable security definer set search_path = public as $$
declare v_lim int; v_ok boolean;
begin
  if not (public.is_member(p_account) or public.is_super_admin()) then return; end if;
  select s.ativo and s.chave is not null into v_ok from public.ai_settings s where s.id = 1;
  if public.account_unlimited(p_account) then
    v_lim := null;
  else
    select case when a.plan_id is null then (select limite_sem_plano from public.ai_settings where id = 1) else p.ia_mensagens_mes end
      into v_lim from public.accounts a left join public.plans p on p.id = a.plan_id where a.id = p_account;
  end if;
  return query select coalesce(v_ok, false),
    (select count(*) from public.ai_messages m where m.account_id = p_account and m.created_at >= date_trunc('month', now())),
    v_lim;
end $$;

revoke execute on function public.admin_ai_status() from anon;
revoke execute on function public.admin_ai_save(text, text, text, boolean, boolean, int, boolean) from anon;
revoke execute on function public.ai_quota(uuid) from anon;
grant execute on function public.admin_ai_status() to authenticated;
grant execute on function public.admin_ai_save(text, text, text, boolean, boolean, int, boolean) to authenticated;
grant execute on function public.ai_quota(uuid) to authenticated;
