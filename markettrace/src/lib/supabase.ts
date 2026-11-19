import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as duas chaves públicas do Supabase estão cadastradas na Vercel */
export const configured = Boolean(url && key);

// Quando não há chaves, criamos um cliente "vazio" para o site institucional
// continuar abrindo; as telas que dependem de dados mostram um aviso.
export const supabase: SupabaseClient = createClient(
  url || "https://configurar.supabase.co",
  key || "chave-nao-configurada",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

/** Traduz as mensagens de erro mais comuns do Supabase para português */
export function errorMessage(err: unknown): string {
  const raw = typeof err === "string" ? err : (err as { message?: string })?.message || "Algo deu errado.";
  const map: Array<[RegExp, string]> = [
    [/Invalid login credentials/i, "E-mail ou senha incorretos."],
    [/Email not confirmed/i, "Confirme seu e-mail pelo link que enviamos antes de entrar."],
    [/User already registered/i, "Este e-mail já tem cadastro. Tente entrar ou recuperar a senha."],
    [/Password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
    [/rate limit/i, "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
    [/row-level security|permission denied/i, "Você não tem permissão para fazer isso."],
    [/Failed to fetch|NetworkError/i, "Sem conexão com o servidor. Verifique a internet e tente de novo."],
  ];
  for (const [re, msg] of map) if (re.test(raw)) return msg;
  return raw;
}
