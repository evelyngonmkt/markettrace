import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";

export type Profile = { id: string; nome: string; email: string; telefone: string | null; is_super_admin: boolean };
export type Account = {
  id: string; nome: string; tipo: string; status: string; trial_ate: string | null; ciclo: string;
  plan_id: string | null; owner_id: string; papel: string; empresas: string[] | null; ilimitado?: boolean;
  plans?: { nome: string; limite_empresas: number | null; limite_usuarios: number | null } | null;
};
export type Company = { id: string; account_id: string; nome: string; segmento: string | null; site: string | null; instagram: string | null; logo_url: string | null; ativa: boolean;
  cor_destaque?: string | null; cor_apoio?: string | null; fonte_titulos?: string | null; fonte_texto?: string | null; usar_identidade?: boolean };

type AuthState = {
  ready: boolean;
  loadError: string | null;
  session: Session | null;
  profile: Profile | null;
  accounts: Account[];
  account: Account | null;
  companies: Company[];
  company: Company | null;
  canEdit: boolean;
  isOwner: boolean;
  canCreateCompany: boolean;
  /** conta sem limites de empresas, usuários e equipe (administração e cortesias) */
  unlimited: boolean;
  setAccountId: (id: string) => void;
  setCompanyId: (id: string) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

// guarda a última conta/empresa escolhida neste navegador
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!configured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accountId, setAccountIdState] = useState<string | null>(store.get("mt.account"));
  const [companyId, setCompanyIdState] = useState<string | null>(store.get("mt.company"));

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setAccounts([]); setCompanies([]); return; }
    const uid = s.user.id;
    const [p, m] = await Promise.all([
      supabase.from("profiles").select("id,nome,email,telefone,is_super_admin").eq("id", uid).maybeSingle(),
      supabase.from("account_members")
        .select("papel, empresas, accounts(id,nome,tipo,status,trial_ate,ciclo,plan_id,owner_id,ilimitado, plans(nome,limite_empresas,limite_usuarios))")
        .eq("user_id", uid),
    ]);
    setLoadError(p.error ? p.error.message : m.error ? m.error.message : null);
    setProfile((p.data as Profile) ?? null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accs = ((m.data ?? []) as any[]).filter((r) => r.accounts).map((r) => ({ ...r.accounts, papel: r.papel, empresas: r.empresas ?? null })) as Account[];
    accs.sort((a, b) => a.nome.localeCompare(b.nome));
    setAccounts(accs);
    const ids = accs.map((a) => a.id);
    if (ids.length) {
      const c = await supabase.from("companies").select("*").in("account_id", ids).order("nome");
      setCompanies((c.data as Company[]) ?? []);
    } else setCompanies([]);
  }, []);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // adia para fora do callback, como recomenda o Supabase
        setTimeout(() => { void load(s); }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const account = useMemo(() => accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null, [accounts, accountId]);
  const accountCompanies = useMemo(() => companies.filter((c) => c.account_id === account?.id), [companies, account]);
  const company = useMemo(
    () => accountCompanies.find((c) => c.id === companyId) ?? accountCompanies.find((c) => c.ativa) ?? accountCompanies[0] ?? null,
    [accountCompanies, companyId],
  );

  const value: AuthState = {
    ready, loadError, session, profile, accounts, account,
    companies: accountCompanies, company,
    canEdit: account ? ["owner", "editor"].includes(account.papel) : false,
    isOwner: account?.papel === "owner",
    unlimited: !!account && (!!account.ilimitado || (!!profile?.is_super_admin && account.owner_id === profile.id)),
    canCreateCompany: account ? account.papel === "owner" || (account.papel === "editor" && !account.empresas) : false,
    setAccountId: (id) => { store.set("mt.account", id); setAccountIdState(id); },
    setCompanyId: (id) => { store.set("mt.company", id); setCompanyIdState(id); },
    reload: () => load(session),
    signOut: async () => { await supabase.auth.signOut(); setSession(null); await load(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}
