-- =====================================================================
-- MarketTrace · 0004 · Permissões básicas da API
-- Projetos novos do Supabase não liberam as tabelas para a API sozinhos.
-- Aqui liberamos o acesso; QUEM vê O QUÊ continua definido pelas regras RLS.
-- Pode rodar mais de uma vez.
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- tabelas e funções criadas depois já nascem liberadas (as regras RLS continuam valendo)
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- conferência: toda tabela do schema public precisa ter RLS ligado
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'Tabela sem RLS: %', t;
  end loop;
end $$;
