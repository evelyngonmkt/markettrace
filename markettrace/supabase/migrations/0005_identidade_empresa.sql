-- =====================================================================
-- MarketTrace · 0005 · Identidade visual por empresa
-- Cada empresa pode ter cor de destaque, cor de apoio, fonte dos títulos
-- e fonte do texto. Quem edita: dono(a) e editores com acesso à empresa
-- (a regra "empresas: editar" do 0003 já cuida disso).
-- Pode rodar mais de uma vez.
-- =====================================================================
alter table public.companies add column if not exists cor_destaque text;
alter table public.companies add column if not exists cor_apoio text;
alter table public.companies add column if not exists fonte_titulos text;
alter table public.companies add column if not exists fonte_texto text;
alter table public.companies add column if not exists usar_identidade boolean not null default true;

alter table public.companies drop constraint if exists companies_cor_destaque_hex;
alter table public.companies add constraint companies_cor_destaque_hex check (cor_destaque is null or cor_destaque ~ '^#[0-9A-Fa-f]{6}$');
alter table public.companies drop constraint if exists companies_cor_apoio_hex;
alter table public.companies add constraint companies_cor_apoio_hex check (cor_apoio is null or cor_apoio ~ '^#[0-9A-Fa-f]{6}$');
alter table public.companies drop constraint if exists companies_fontes_tamanho;
alter table public.companies add constraint companies_fontes_tamanho check (coalesce(length(fonte_titulos), 0) <= 60 and coalesce(length(fonte_texto), 0) <= 60);

grant select, insert, update, delete on public.companies to anon, authenticated, service_role;
