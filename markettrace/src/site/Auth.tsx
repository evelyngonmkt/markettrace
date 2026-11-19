import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo, Notice } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows } from "../lib/data";
import { money } from "../lib/format";
import { configured, errorMessage, supabase } from "../lib/supabase";

function AuthCard({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="auth">
      <div className="auth-card">
        <Link to="/" className="auth-logo"><Logo size={24} /></Link>
        <h1>{title}</h1>
        {text && <p className="muted">{text}</p>}
        {!configured && <Notice tone="warn">O banco de dados ainda não foi conectado a este site. Siga o guia de publicação para cadastrar as chaves do Supabase na Vercel.</Notice>}
        {children}
      </div>
    </section>
  );
}

export function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = params.get("voltar") || "/app";

  useEffect(() => { if (session) nav(next, { replace: true }); }, [session, nav, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(errorMessage(err)); else nav(next, { replace: true });
  };
  return (
    <AuthCard title="Entrar" text="Acesse sua conta MarketTrace.">
      <form className="form-stack" onSubmit={submit}>
        <label className="field"><span>E-mail</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Senha</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <Notice tone="error">{error}</Notice>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
      <div className="auth-links">
        <Link to="/recuperar-senha">Esqueci minha senha</Link>
        <Link to="/cadastro">Criar conta</Link>
      </div>
    </AuthCard>
  );
}

type Plan = { id: string; nome: string; preco_mensal: number; preco_anual: number | null };

export function Signup() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { rows: plans } = useRows<Plan>({ table: "plans", eq: { ativo: true }, order: ["ordem"] });
  const [convidado, setConvidado] = useState(params.get("convite") === "1");
  const [f, setF] = useState({
    nome: "", email: "", telefone: "", password: "",
    conta_nome: "", conta_tipo: "profissional", plan_id: params.get("plano") || "", ciclo: params.get("ciclo") || "mensal",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const data: Record<string, string> = { nome: f.nome.trim(), telefone: f.telefone.trim() };
    if (!convidado) Object.assign(data, { conta_nome: f.conta_nome.trim() || f.nome.trim(), conta_tipo: f.conta_tipo, plan_id: f.plan_id, ciclo: f.ciclo });
    const { data: res, error: err } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data, emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    if (res.session) nav("/app", { replace: true }); else setDone(true);
  };

  if (done)
    return (
      <AuthCard title="Confirme seu e-mail" text={`Enviamos um link de confirmação para ${f.email}. Abra o e-mail e clique no link para ativar sua conta.`}>
        <Link to="/entrar" className="btn btn-ghost btn-block">Já confirmei, quero entrar</Link>
      </AuthCard>
    );

  return (
    <AuthCard title="Criar conta" text="14 dias de teste grátis. Sem cartão.">
      <form className="form-stack" onSubmit={submit}>
        <label className="check"><input type="checkbox" checked={convidado} onChange={(e) => setConvidado(e.target.checked)} /> Fui convidado(a) para a equipe de alguém</label>
        <label className="field"><span>Seu nome *</span><input required value={f.nome} onChange={set("nome")} autoComplete="name" /></label>
        <label className="field"><span>E-mail *</span><input required type="email" value={f.email} onChange={set("email")} autoComplete="email" />{convidado && <small>Use o mesmo e-mail que recebeu o convite.</small>}</label>
        <label className="field"><span>WhatsApp</span><input value={f.telefone} onChange={set("telefone")} autoComplete="tel" /></label>
        <label className="field"><span>Senha *</span><input required type="password" minLength={6} value={f.password} onChange={set("password")} autoComplete="new-password" /><small>Mínimo de 6 caracteres.</small></label>
        {!convidado && (
          <>
            <label className="field"><span>Nome da agência, empresa ou do seu trabalho *</span><input required value={f.conta_nome} onChange={set("conta_nome")} /></label>
            <label className="field"><span>Você é</span>
              <select value={f.conta_tipo} onChange={set("conta_tipo")}>
                <option value="profissional">Profissional autônomo(a)</option>
                <option value="agencia">Agência</option>
                <option value="empresa">Empresa / time interno</option>
              </select>
            </label>
            {plans.length > 0 && (
              <div className="form-row">
                <label className="field"><span>Plano</span>
                  <select value={f.plan_id} onChange={set("plan_id")}>
                    <option value="">Decidir depois</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.nome} · {money(p.preco_mensal)}/mês</option>)}
                  </select>
                </label>
                <label className="field"><span>Cobrança</span>
                  <select value={f.ciclo} onChange={set("ciclo")}><option value="mensal">Mensal</option><option value="anual">Anual</option></select>
                </label>
              </div>
            )}
          </>
        )}
        <Notice tone="error">{error}</Notice>
        <p className="muted small">Ao criar a conta você concorda com a <Link to="/privacidade">política de privacidade</Link>.</p>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
      </form>
      <div className="auth-links"><span>Já tem conta?</span><Link to="/entrar">Entrar</Link></div>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-senha` });
    if (err) setError(errorMessage(err)); else setSent(true);
  };
  return (
    <AuthCard title="Recuperar senha" text={sent ? "Se este e-mail tiver cadastro, você vai receber um link para criar uma nova senha." : "Informe o e-mail da sua conta."}>
      {!sent && (
        <form className="form-stack" onSubmit={submit}>
          <label className="field"><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <Notice tone="error">{error}</Notice>
          <button className="btn btn-primary btn-block">Enviar link</button>
        </form>
      )}
      <div className="auth-links"><Link to="/entrar">Voltar para entrar</Link></div>
    </AuthCard>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const { session, ready } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(errorMessage(err)); else nav("/app", { replace: true });
  };
  return (
    <AuthCard title="Nova senha" text={ready && !session ? "Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." : "Escolha a nova senha da sua conta."}>
      {session && (
        <form className="form-stack" onSubmit={submit}>
          <label className="field"><span>Nova senha</span><input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
          <Notice tone="error">{error}</Notice>
          <button className="btn btn-primary btn-block">Salvar nova senha</button>
        </form>
      )}
    </AuthCard>
  );
}
