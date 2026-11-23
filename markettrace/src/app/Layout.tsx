import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Building2, Calculator, CalendarDays, Headphones, KanbanSquare, LayoutGrid, Lightbulb, LogOut,
  Menu, Palette, Plug, Sparkles, Radar, Send, Settings, ShieldCheck, Store, Users, Wallet,
} from "lucide-react";
import { EmptyState, Loading, Logo, Notice } from "../components/ui";
import { useAuth } from "../lib/auth";
import { date } from "../lib/format";
import { configured, errorMessage, supabase } from "../lib/supabase";
import { useSiteSettings } from "../lib/site";
import { applyBrand } from "../lib/brand";

/* ---------- tema claro/escuro/sistema (vale para app e admin) ---------- */
export type Theme = "system" | "light" | "dark";
export const getTheme = (): Theme => { try { return (localStorage.getItem("mt.theme") as Theme) || "system"; } catch { return "system"; } };
export function applyTheme(t: Theme = getTheme()) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
export function setTheme(t: Theme) { try { localStorage.setItem("mt.theme", t); } catch { /* sem armazenamento */ } applyTheme(t); }

export function useThemeWhileMounted() {
  useEffect(() => {
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme();
    mq.addEventListener("change", onChange);
    return () => { mq.removeEventListener("change", onChange); document.documentElement.dataset.theme = "light"; };
  }, []);
}

export const initials = (name?: string | null) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function SetupScreen() {
  return (
    <div className="setup">
      <Logo />
      <h1>Falta conectar o banco de dados</h1>
      <p className="muted">O site está no ar, mas a área do cliente e o backoffice precisam das chaves do Supabase.</p>
      <ol>
        <li>No Supabase, abra <code>Project Settings → API</code> e copie a <strong>Project URL</strong> e a chave <strong>anon public</strong>.</li>
        <li>Na Vercel, abra o projeto → <code>Settings → Environment Variables</code> e cadastre <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</li>
        <li>Em <code>Deployments</code>, clique em <strong>Redeploy</strong>.</li>
      </ol>
      <Link to="/" className="btn btn-ghost">Voltar ao site</Link>
    </div>
  );
}

/* ---------- guarda: só entra quem está logado ---------- */
export function useGuard() {
  const auth = useAuth();
  const loc = useLocation();
  if (!configured) return <SetupScreen />;
  if (!auth.ready) return <Loading />;
  if (!auth.session) return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!auth.profile && auth.loadError) return (
    <div className="setup">
      <Logo />
      <h1>Não conseguimos carregar sua conta</h1>
      <p className="muted">O servidor respondeu: <code>{auth.loadError}</code></p>
      <div className="form-actions" style={{ justifyContent: "flex-start" }}>
        <button className="btn btn-primary" onClick={() => void auth.reload()}>Tentar de novo</button>
        <a href="mailto:evelyngoncalves.marketing@gmail.com" className="btn btn-ghost">Avisar o suporte</a>
      </div>
    </div>
  );
  if (!auth.profile) return <Loading text="Preparando sua conta…" />;
  return null;
}

function NoAccount() {
  const { profile, reload, signOut } = useAuth();
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.rpc("create_my_account", { p_nome: nome, p_tipo: "profissional" });
    if (err) setError(errorMessage(err)); else await reload();
  };
  return (
    <div className="setup">
      <Logo />
      <h1>Olá, {profile?.nome?.split(" ")[0]}!</h1>
      <p className="muted">Você ainda não faz parte de nenhuma conta. Se alguém te convidou, peça para a pessoa conferir se o convite foi para <strong>{profile?.email}</strong>. Ou crie a sua própria conta:</p>
      <form className="form-stack" onSubmit={create} style={{ marginTop: 16 }}>
        <label className="field"><span>Nome da sua agência, empresa ou trabalho</span><input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <Notice tone="error">{error}</Notice>
        <div className="form-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-primary">Criar minha conta</button>
          {profile?.is_super_admin && <Link to="/admin" className="btn btn-ghost">Ir para o backoffice</Link>}
          <button type="button" className="btn btn-ghost" onClick={signOut}>Sair</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- assinatura de quem criou o MarketTrace (editável no backoffice) ---------- */
export function Signature({ s, className }: { s: ReturnType<typeof useSiteSettings>; className: string }) {
  const nome = s.assinatura_nome || s.contato_nome;
  const body = s.assinatura_estilo === "logo" && s.assinatura_logo_url
    ? <img src={s.assinatura_logo_url} alt={nome} />
    : <strong>{nome}</strong>;
  return (
    <div className={className}>
      {s.assinatura_rotulo && <span>{s.assinatura_rotulo}</span>}
      {s.assinatura_link ? <a href={s.assinatura_link} target="_blank" rel="noreferrer">{body}</a> : body}
    </div>
  );
}

const NAV = [
  { label: "Do dado à decisão", items: [
    { to: "/app", label: "Visão geral", icon: LayoutGrid, end: true },
    { to: "/app/campanhas", label: "Campanhas & métricas", icon: BarChart3 },
    { to: "/app/calculadoras", label: "Calculadoras", icon: Calculator },
  ] },
  { label: "Social media", items: [
    { to: "/app/social", label: "Agendar post", icon: Send },
    { to: "/app/agenda", label: "Agenda editorial", icon: CalendarDays },
  ] },
  { label: "Planejamento", items: [
    { to: "/app/tarefas", label: "Rotinas & tarefas", icon: KanbanSquare },
    { to: "/app/orcamentos", label: "Orçamentos", icon: Wallet },
    { to: "/app/canais-de-venda", label: "Canais de venda", icon: Store },
  ] },
  { label: "Inteligência", items: [
    { to: "/app/ia", label: "Super IA", icon: Sparkles },
    { to: "/app/estudio", label: "Estúdio criativo", icon: Lightbulb },
    { to: "/app/pesquisa", label: "Pesquisa de mercado", icon: Radar },
  ] },
  { label: "Conta", items: [
    { to: "/app/integracoes", label: "Integrações", icon: Plug },
    { to: "/app/empresas", label: "Empresas", icon: Building2 },
    { to: "/app/identidade", label: "Identidade visual", icon: Palette },
    { to: "/app/equipe", label: "Equipe", icon: Users },
    { to: "/app/suporte", label: "Suporte", icon: Headphones },
    { to: "/app/conta", label: "Minha conta", icon: Settings },
  ] },
];
// páginas que funcionam mesmo sem empresa cadastrada
const NO_COMPANY_OK = ["/app/empresas", "/app/equipe", "/app/suporte", "/app/conta", "/app/integracoes", "/app/calculadoras"];

export default function AppLayout() {
  useThemeWhileMounted();
  const blocked = useGuard();
  const auth = useAuth();
  const s = useSiteSettings();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  const c = auth.company;
  useEffect(() => applyBrand(c ? { cor_destaque: c.cor_destaque, cor_apoio: c.cor_apoio, fonte_titulos: c.fonte_titulos, fonte_texto: c.fonte_texto, usar_identidade: c.usar_identidade } : null),
    [c?.id, c?.cor_destaque, c?.cor_apoio, c?.fonte_titulos, c?.fonte_texto, c?.usar_identidade]); // eslint-disable-line react-hooks/exhaustive-deps
  if (blocked) return blocked;
  if (!auth.account) return <NoAccount />;

  const { account, companies, company, profile } = auth;
  const current = NAV.flatMap((g) => g.items).find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));
  const trialOver = account.status === "trial" && account.trial_ate && new Date(account.trial_ate) < new Date(new Date().toDateString());
  const suspended = account.status === "suspensa" || account.status === "cancelada";
  const needsCompany = !company && !NO_COMPANY_OK.includes(loc.pathname);

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/app" className="logo-link" style={{ textDecoration: "none" }}><Logo size={22} light /></Link>

        {auth.accounts.length > 1 && (
          <div className="switcher" title="Conta">
            <span className="switcher-logo">{initials(account.nome)}</span>
            <select value={account.id} onChange={(e) => auth.setAccountId(e.target.value)} aria-label="Conta">
              {auth.accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        )}
        <div className="switcher" title="Empresa em que você está trabalhando">
          <span className="switcher-logo">
            {company?.logo_url ? <img src={company.logo_url} alt="" /> : company?.nome === "MCI Store" ? <img src="/brand/mci-white.png" alt="" /> : initials(company?.nome)}
          </span>
          {companies.length ? (
            <select value={company?.id} onChange={(e) => (e.target.value === "__nova" ? navigate("/app/empresas?nova=1") : auth.setCompanyId(e.target.value))} aria-label="Empresa">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativa ? "" : " (arquivada)"}</option>)}
              {auth.canCreateCompany && <option value="__nova">+ Adicionar empresa</option>}
            </select>
          ) : <Link to="/app/empresas" style={{ color: "var(--papel)", fontSize: 14 }}>Cadastrar empresa</Link>}
        </div>

        {NAV.map((g) => (
          <nav key={g.label} className="side-nav" aria-label={g.label}>
            <span className="side-label">{g.label}</span>
            {g.items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}><i.icon size={17} /> {i.label}</NavLink>)}
          </nav>
        ))}
        {profile?.is_super_admin && (
          <nav className="side-nav"><span className="side-label">MarketTrace</span><NavLink to="/admin"><ShieldCheck size={17} /> Backoffice</NavLink></nav>
        )}

        <div className="side-bottom">
          <Signature s={s} className="side-credit" />
          <div className="user-row">
            <span className="avatar">{initials(profile?.nome)}</span>
            <div><strong>{profile?.nome}</strong><small>{account.nome}</small></div>
            <button className="icon-btn" onClick={auth.signOut} title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="main">
        {suspended && <div className="banner">Esta conta está {account.status}. Os dados continuam salvos. <Link to="/app/suporte">Fale com o suporte</Link></div>}
        {trialOver && !suspended && <div className="banner">Seu teste grátis terminou em {date(account.trial_ate)}. <Link to="/app/suporte">Fale com a gente para ativar seu plano</Link></div>}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <span className="crumb">{company?.nome ?? account.nome} / <strong>{current?.label ?? "MarketTrace"}</strong></span>
          </div>
          <div className="topbar-actions"><Link to="/app/conta" className="avatar" title="Minha conta" style={{ textDecoration: "none" }}>{initials(profile?.nome)}</Link></div>
        </header>
        <div className="content">
          {needsCompany ? (
            <EmptyState title="Cadastre sua primeira empresa" text="Tudo no MarketTrace é organizado por empresa (a sua ou a de cada cliente). Cadastre uma para começar." action={<Link to="/app/empresas" className="btn btn-primary">Cadastrar empresa</Link>} />
          ) : <Outlet />}
        </div>
      </div>
    </div>
  );
}
