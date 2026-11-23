-- =====================================================================
-- MarketTrace · 0002 · Agendador de posts (Social Media)
-- Rode no SQL Editor DEPOIS do 0001. Pode rodar mais de uma vez.
-- =====================================================================

-- 1. Perfis de redes sociais de cada empresa
create table if not exists public.social_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  rede text not null default 'instagram',
  nome text not null,
  usuario text,
  avatar_url text,
  assinatura text,            -- hashtags e assinatura que entram em todo post deste perfil
  ativo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists social_profiles_company_idx on public.social_profiles (company_id);

-- 2. Novos campos do post agendado
alter table public.posts add column if not exists profile_id uuid references public.social_profiles (id) on delete set null;
alter table public.posts add column if not exists canal text not null default 'feed';
alter table public.posts add column if not exists midias jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists assinatura text;
alter table public.posts add column if not exists grupo_id uuid;
alter table public.posts add column if not exists publicado_em timestamptz;
do $$ begin
  alter table public.posts add constraint posts_canal_check check (canal in ('feed','stories','reels','post'));
exception when duplicate_object then null; end $$;
create index if not exists posts_profile_idx on public.posts (profile_id);

-- 3. Regras de acesso dos perfis (mesmas das outras tabelas de trabalho)
alter table public.social_profiles enable row level security;
drop policy if exists "ler" on public.social_profiles;
drop policy if exists "criar" on public.social_profiles;
drop policy if exists "editar" on public.social_profiles;
drop policy if exists "apagar" on public.social_profiles;
create policy "ler" on public.social_profiles for select using (public.is_member(account_id) or public.is_super_admin());
create policy "criar" on public.social_profiles for insert with check (public.can_edit(account_id));
create policy "editar" on public.social_profiles for update using (public.can_edit(account_id)) with check (public.can_edit(account_id));
create policy "apagar" on public.social_profiles for delete using (public.can_edit(account_id));

drop trigger if exists check_company on public.social_profiles;
create trigger check_company before insert or update on public.social_profiles
for each row execute function public.check_company_account();

-- 4. Armazenamento das imagens e vídeos dos posts
--    Arquivos ficam em midias/<id-da-conta>/... ; só membros da conta enviam ou apagam.
--    A leitura é pública por link (o Instagram e a pré-visualização precisam abrir a imagem).
insert into storage.buckets (id, name, public, file_size_limit)
values ('midias', 'midias', true, 104857600)
on conflict (id) do update set public = true, file_size_limit = 104857600;

drop policy if exists "midias: membros enviam" on storage.objects;
drop policy if exists "midias: membros apagam" on storage.objects;
drop policy if exists "midias: membros atualizam" on storage.objects;
create policy "midias: membros enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.can_edit(((storage.foldername(name))[1])::uuid));
create policy "midias: membros atualizam" on storage.objects for update to authenticated
  using (bucket_id = 'midias' and public.can_edit(((storage.foldername(name))[1])::uuid));
create policy "midias: membros apagam" on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and public.can_edit(((storage.foldername(name))[1])::uuid));
