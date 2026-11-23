-- =====================================================================
-- MarketTrace · 0003 · Equipe por empresa (até 8 pessoas por empresa)
-- Rode no SQL Editor DEPOIS do 0002. Pode rodar mais de uma vez.
-- Cada pessoa da conta pode ter acesso a TODAS as empresas (empresas = null)
-- ou só a algumas (lista de ids). O dono(a) sempre vê todas.
-- =====================================================================

alter table public.account_members add column if not exists empresas uuid[];
alter table public.invitations add column if not exists empresas uuid[];

-- Limite de pessoas por empresa (mude o número aqui quando quiser)
create or replace function public.team_limit() returns int language sql immutable as $$ select 8 $$;

-- Quem enxerga e quem edita cada empresa
create or replace function public.can_see_company(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.companies c
    join public.account_members m on m.account_id = c.account_id
    where c.id = cid and m.user_id = auth.uid()
      and (m.papel = 'owner' or m.empresas is null or cid = any (m.empresas)));
$$;

create or replace function public.can_edit_company(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.companies c
    join public.account_members m on m.account_id = c.account_id
    where c.id = cid and m.user_id = auth.uid() and m.papel in ('owner','editor')
      and (m.papel = 'owner' or m.empresas is null or cid = any (m.empresas)));
$$;

-- pode criar empresas novas: dono(a) ou editor com acesso a todas
create or replace function public.can_edit_all(acc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_members
                 where account_id = acc and user_id = auth.uid()
                   and (papel = 'owner' or (papel = 'editor' and empresas is null)));
$$;

-- Quantas pessoas têm acesso a uma empresa (incluindo convites pendentes)
create or replace function public.company_people(cid uuid)
returns int language sql stable security definer set search_path = public as $$
  select (select count(*) from public.account_members m join public.companies c on c.account_id = m.account_id
          where c.id = cid and (m.papel = 'owner' or m.empresas is null or cid = any (m.empresas)))::int
       + (select count(*) from public.invitations i join public.companies c on c.account_id = i.account_id
          where c.id = cid and not i.aceito and (i.empresas is null or cid = any (i.empresas)))::int;
$$;

-- verifica o limite para as empresas afetadas
create or replace function public.check_team_limit(acc uuid, emp uuid[], extra int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, nome from public.companies
           where account_id = acc and ativa and (emp is null or id = any (emp)) loop
    if public.company_people(r.id) + extra > public.team_limit() then
      raise exception 'A empresa % já tem % pessoas com acesso (limite atual).', r.nome, public.team_limit();
    end if;
  end loop;
end $$;

-- Convites: guardam as empresas, respeitam o limite e entram na hora para quem já tem cadastro
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

-- Novo usuário: aceita convites levando as empresas de cada convite
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

  insert into public.account_members (account_id, user_id, papel, empresas)
  select i.account_id, new.id, i.papel, i.empresas from public.invitations i
  where lower(i.email) = lower(new.email) and not i.aceito
  on conflict do nothing;
  update public.invitations set aceito = true where lower(email) = lower(new.email);

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

-- Dono(a) muda o acesso de alguém: confere o limite das empresas que a pessoa passa a ver
create or replace function public.check_member_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare novas uuid[];
begin
  if new.empresas is not null and array_length(new.empresas, 1) is null then new.empresas := null; end if;
  if new.papel = 'owner' then new.empresas := null; end if;
  if new.empresas is distinct from old.empresas then
    if new.empresas is null then
      select array_agg(id) into novas from public.companies
      where account_id = new.account_id and ativa and not (old.empresas is null or id = any (old.empresas));
    elsif old.empresas is null then
      novas := '{}';
    else
      select array_agg(e) into novas from unnest(new.empresas) e where not (e = any (old.empresas));
    end if;
    if novas is not null and array_length(novas, 1) > 0 then
      perform public.check_team_limit(new.account_id, novas, 1);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists before_member_update on public.account_members;
create trigger before_member_update before update on public.account_members
for each row execute function public.check_member_update();

-- Regras de acesso: agora por empresa
drop policy if exists "empresas: ler" on public.companies;
drop policy if exists "empresas: criar" on public.companies;
drop policy if exists "empresas: editar" on public.companies;
create policy "empresas: ler" on public.companies for select
  using (public.can_see_company(id) or public.is_super_admin());
create policy "empresas: criar" on public.companies for insert with check (public.can_edit_all(account_id));
create policy "empresas: editar" on public.companies for update
  using (public.can_edit_company(id)) with check (public.can_edit_company(id));

do $$
declare t text;
begin
  foreach t in array array['campaigns','metrics','posts','tasks','budgets','expenses','sales','ideas','brand_profiles','competitors','social_profiles'] loop
    execute format('drop policy if exists "ler" on public.%I', t);
    execute format('drop policy if exists "criar" on public.%I', t);
    execute format('drop policy if exists "editar" on public.%I', t);
    execute format('drop policy if exists "apagar" on public.%I', t);
    execute format('create policy "ler" on public.%I for select using (public.can_see_company(company_id) or public.is_super_admin())', t);
    execute format('create policy "criar" on public.%I for insert with check (public.can_edit_company(company_id))', t);
    execute format('create policy "editar" on public.%I for update using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id))', t);
    execute format('create policy "apagar" on public.%I for delete using (public.can_edit_company(company_id))', t);
  end loop;
end $$;

drop policy if exists "atividades: ler" on public.activities;
create policy "atividades: ler" on public.activities for select
  using (public.is_super_admin() or (company_id is null and public.is_member(account_id)) or public.can_see_company(company_id));

-- Mídias: a pasta é midias/<conta>/<empresa>/...; só quem edita aquela empresa envia
drop policy if exists "midias: membros enviam" on storage.objects;
drop policy if exists "midias: membros atualizam" on storage.objects;
drop policy if exists "midias: membros apagam" on storage.objects;
create policy "midias: membros enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.can_edit_company(((storage.foldername(name))[2])::uuid));
create policy "midias: membros atualizam" on storage.objects for update to authenticated
  using (bucket_id = 'midias' and public.can_edit_company(((storage.foldername(name))[2])::uuid));
create policy "midias: membros apagam" on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and public.can_edit_company(((storage.foldername(name))[2])::uuid));
