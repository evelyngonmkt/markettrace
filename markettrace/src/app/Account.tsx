import { useState } from "react";
import { Link } from "react-router-dom";
import { Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { FormModal, type FieldDef } from "../components/Crud";
import { TicketThread } from "../components/Tickets";
import { Badge, EmptyState, Loading, Notice, PageHeader, Panel, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { date, dateTime, label, options } from "../lib/format";
import { errorMessage, supabase } from "../lib/supabase";
import { getTheme, setTheme, type Theme } from "./Layout";

/* ======================= INTEGRAÇÕES ======================= */
const INTEGRATIONS = [
  { name: "Instagram", cat: "Social", text: "Posts, Reels, Stories e insights" },
  { name: "Facebook", cat: "Social", text: "Páginas e publicações" },
  { name: "TikTok", cat: "Social", text: "Vídeos e métricas do perfil" },
  { name: "LinkedIn", cat: "Social", text: "Página da empresa e publicações" },
  { name: "YouTube", cat: "Social", text: "Vídeos, visualizações e inscritos" },
  { name: "Pinterest", cat: "Social", text: "Pins e alcance" },
  { name: "Meta Ads", cat: "Mídia paga", text: "Campanhas, conjuntos e anúncios" },
  { name: "Google Ads", cat: "Mídia paga", text: "Pesquisa, Display e YouTube" },
  { name: "TikTok Ads", cat: "Mídia paga", text: "Campanhas e criativos" },
  { name: "Google Analytics 4", cat: "Dados", text: "Sessões, eventos e conversões" },
  { name: "Mercado Livre", cat: "Marketplace", text: "Pedidos, taxas e catálogo" },
  { name: "Amazon", cat: "Marketplace", text: "Pedidos, taxas e estoque" },
  { name: "Google Agenda", cat: "Produtividade", text: "Rotinas e compromissos do time" },
  { name: "WhatsApp", cat: "Atendimento", text: "Conversas e automações" },
  { name: "RD Station", cat: "Automação", text: "Leads e funis" },
];

export function Integrations() {
  const { account, profile } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState<string[]>([]);
  const interest = async (name: string) => {
    const { data, error } = await supabase.from("support_tickets").insert({ account_id: account!.id, assunto: `Interesse na integração: ${name}`, categoria: "sugestao", prioridade: "baixa" }).select("id").single();
    if (error) return toast(errorMessage(error), "error");
    await supabase.from("ticket_messages").insert({ ticket_id: data.id, mensagem: `${profile?.nome} tem interesse na integração com ${name}.` });
    setSent([...sent, name]);
    toast("Interesse registrado. Avisaremos quando estiver disponível.");
  };
  return (
    <>
      <PageHeader kicker="Conexões" title="Integrações" text="As conexões com redes sociais, anúncios e marketplaces estão em desenvolvimento. Marque as que você mais precisa: isso define a ordem de lançamento." />
      <div className="int-grid">
        {INTEGRATIONS.map((i) => (
          <article className="int-card" key={i.name}>
            <Badge>Em breve</Badge>
            <span className="data-label">{i.cat}</span>
            <h3>{i.name}</h3>
            <p>{i.text}</p>
            <button className="btn btn-ghost btn-sm" disabled={sent.includes(i.name)} onClick={() => interest(i.name)}>{sent.includes(i.name) ? "Interesse registrado" : "Tenho interesse"}</button>
          </article>
        ))}
      </div>
    </>
  );
}

/* ======================= EQUIPE ======================= */
export function Team() {
  const { account, isOwner, profile } = useAuth();
  const toast = useToast();
  const members = useRows({ table: "account_members", select: "user_id,papel,created_at, profiles(nome,email)", eq: { account_id: account?.id }, order: ["created_at"], skip: !account });
  const invites = useRows({ table: "invitations", eq: { account_id: account?.id, aceito: false }, order: ["created_at", false], skip: !account || !isOwner });
  const [inviting, setInviting] = useState(false);

  const invite = async (v: Row) => {
    const { error } = await supabase.from("invitations").insert({ account_id: account!.id, email: v.email, papel: v.papel });
    if (error) throw error;
    toast("Convite registrado");
    await Promise.all([members.reload(), invites.reload()]);
  };
  const changeRole = async (userId: string, papel: string) => {
    const { error } = await supabase.from("account_members").update({ papel }).eq("account_id", account!.id).eq("user_id", userId);
    if (error) toast(errorMessage(error), "error"); else { toast("Papel atualizado"); await members.reload(); }
  };
  const removeMember = async (userId: string, nome: string) => {
    if (!window.confirm(`Remover ${nome} da equipe?`)) return;
    const { error } = await supabase.from("account_members").delete().eq("account_id", account!.id).eq("user_id", userId);
    if (error) toast(errorMessage(error), "error"); else { toast("Pessoa removida"); await members.reload(); }
  };
  const cancelInvite = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast(errorMessage(error), "error"); else await invites.reload();
  };
  const limit = account?.plans?.limite_usuarios;
  const signupLink = `${window.location.origin}/cadastro?convite=1`;

  return (
    <>
      <PageHeader kicker="Conta" title="Equipe" text="Quem trabalha nesta conta. Editores criam e alteram dados; leitores só consultam."
        actions={isOwner && <button className="btn btn-primary btn-sm" onClick={() => setInviting(true)}><Plus size={15} /> Convidar pessoa</button>} />
      {limit ? <Notice>Seu plano permite até {limit} usuário(s), contando convites pendentes.</Notice> : null}
      <Panel title="Pessoas" className="mt">
        {members.loading ? <Loading /> : (
          <div className="list">{members.rows.map((m) => (
            <div className="list-item" key={m.user_id}>
              <div><strong>{m.profiles?.nome}{m.user_id === profile?.id ? " (você)" : ""}</strong><small>{m.profiles?.email} · desde {date(m.created_at)}</small></div>
              {isOwner && m.papel !== "owner" ? (
                <>
                  <select value={m.papel} onChange={(e) => changeRole(m.user_id, e.target.value)} aria-label="Papel" className="btn btn-ghost btn-sm">
                    <option value="editor">Editor</option><option value="leitor">Leitor</option>
                  </select>
                  <button className="icon-btn danger" title="Remover" onClick={() => removeMember(m.user_id, m.profiles?.nome)}><Trash2 size={15} /></button>
                </>
              ) : <Badge tone={m.papel === "owner" ? "signal" : "neutral"}>{label("papel", m.papel)}</Badge>}
            </div>
          ))}</div>
        )}
      </Panel>
      {isOwner && (
        <Panel title="Convites pendentes" className="mt">
          {invites.rows.length ? (
            <div className="list">{invites.rows.map((i) => (
              <div className="list-item" key={i.id}><div><strong>{i.email}</strong><small>{label("papel", i.papel)} · enviado em {date(i.created_at)}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={() => cancelInvite(i.id)}>Cancelar</button></div>
            ))}</div>
          ) : <EmptyState title="Nenhum convite pendente" />}
          <p className="muted small" style={{ marginTop: 12 }}>Depois de convidar, mande este link para a pessoa criar a conta com o mesmo e-mail: <code>{signupLink}</code>. Quem já tem cadastro entra na equipe na hora.</p>
        </Panel>
      )}
      {inviting && (
        <FormModal title="Convidar pessoa" submitLabel="Convidar" onClose={() => setInviting(false)} onSubmit={invite} initial={{ papel: "editor" }}
          fields={[
            { key: "email", label: "E-mail", type: "email", required: true },
            { key: "papel", label: "Papel", type: "select", required: true, options: [{ value: "editor", label: "Editor (cria e altera)" }, { value: "leitor", label: "Leitor (só consulta)" }] },
          ]} />
      )}
    </>
  );
}

/* ======================= SUPORTE ======================= */
const ticketFields: FieldDef[] = [
  { key: "assunto", label: "Assunto", required: true },
  { key: "categoria", label: "Categoria", type: "select", options: options("categoria_ticket"), required: true, half: true },
  { key: "prioridade", label: "Prioridade", type: "select", options: options("prioridade"), required: true, half: true },
  { key: "mensagem", label: "Descreva o que aconteceu ou o que precisa", type: "textarea", required: true },
];
export const ticketTone = (s: string) => (s === "aberto" ? "signal" : s === "em_andamento" ? "warn" : s === "resolvido" ? "ok" : "neutral") as "signal" | "warn" | "ok" | "neutral";

export function Support() {
  const { account } = useAuth();
  const toast = useToast();
  const { rows, loading, reload } = useRows({ table: "support_tickets", eq: { account_id: account?.id }, order: ["updated_at", false], skip: !account });
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Row | null>(null);
  const create = async (v: Row) => {
    const { data, error } = await supabase.from("support_tickets").insert({ account_id: account!.id, assunto: v.assunto, categoria: v.categoria, prioridade: v.prioridade }).select().single();
    if (error) throw error;
    const m = await supabase.from("ticket_messages").insert({ ticket_id: data.id, mensagem: v.mensagem });
    if (m.error) throw m.error;
    toast("Chamado aberto. Você recebe a resposta aqui mesmo.");
    await reload();
    setOpen(data);
  };
  return (
    <>
      <PageHeader kicker="Conta" title="Suporte" text="Dúvidas, problemas ou sugestões: abra um chamado e acompanhe a conversa com a equipe MarketTrace."
        actions={<button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={15} /> Abrir chamado</button>} />
      <div className="grid-2">
        <Panel title="Seus chamados">
          {loading ? <Loading /> : rows.length ? (
            <div className="list">{rows.map((t) => (
              <button key={t.id} className="list-item" onClick={() => setOpen(t)} style={{ textAlign: "left", background: open?.id === t.id ? "var(--surface-2)" : "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", padding: "11px 8px", borderRadius: 8 }}>
                <div><strong>{t.assunto}</strong><small>{label("categoria_ticket", t.categoria)} · atualizado {dateTime(t.updated_at)}</small></div>
                <Badge tone={ticketTone(t.status)}>{label("status_ticket", t.status)}</Badge>
              </button>
            ))}</div>
          ) : <EmptyState title="Nenhum chamado" text="Quando precisar de ajuda, abra um chamado por aqui." />}
        </Panel>
        <Panel title={open ? open.assunto : "Conversa"}>
          {open ? <TicketThread ticket={open} onChange={reload} /> : <EmptyState title="Selecione um chamado" text="A conversa aparece aqui." />}
        </Panel>
      </div>
      {creating && <FormModal title="Abrir chamado" submitLabel="Abrir chamado" fields={ticketFields} initial={{ categoria: "duvida", prioridade: "normal" }} onSubmit={create} onClose={() => setCreating(false)} />}
    </>
  );
}

/* ======================= MINHA CONTA ======================= */
export function MyAccount() {
  const { profile, account, isOwner, reload, signOut } = useAuth();
  const toast = useToast();
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [telefone, setTelefone] = useState(profile?.telefone ?? "");
  const [conta, setConta] = useState(account?.nome ?? "");
  const [pass, setPass] = useState("");
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const lgpd = useRows({ table: "lgpd_requests", eq: { user_id: profile?.id }, order: ["created_at", false], skip: !profile });
  const [asking, setAsking] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ nome, telefone: telefone || null }).eq("id", profile!.id);
    if (!error && isOwner && conta !== account?.nome) {
      const r = await supabase.from("accounts").update({ nome: conta }).eq("id", account!.id);
      if (r.error) return setMsg({ tone: "error", text: errorMessage(r.error) });
    }
    if (error) setMsg({ tone: "error", text: errorMessage(error) }); else { setMsg({ tone: "ok", text: "Dados salvos." }); await reload(); }
  };
  const savePass = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) toast(errorMessage(error), "error"); else { toast("Senha alterada"); setPass(""); }
  };
  const ask = async (v: Row) => {
    const { error } = await supabase.from("lgpd_requests").insert({ user_id: profile!.id, tipo: v.tipo, detalhes: v.detalhes });
    if (error) throw error;
    toast("Solicitação registrada. Respondemos em até 15 dias.");
    await lgpd.reload();
  };
  const pick = (t: Theme) => { setTheme(t); setThemeState(t); };

  return (
    <>
      <PageHeader kicker="Conta" title="Minha conta" actions={<button className="btn btn-ghost btn-sm" onClick={signOut}>Sair</button>} />
      <div className="grid-2-even">
        <Panel title="Seus dados">
          <form className="form-stack" onSubmit={saveProfile}>
            <label className="field"><span>Nome</span><input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
            <label className="field"><span>E-mail</span><input value={profile?.email ?? ""} disabled /></label>
            <label className="field"><span>WhatsApp</span><input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></label>
            {isOwner && <label className="field"><span>Nome da conta</span><input required value={conta} onChange={(e) => setConta(e.target.value)} /></label>}
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <div><button className="btn btn-primary">Salvar</button></div>
          </form>
        </Panel>
        <div className="stack">
          <Panel title="Plano e conta">
            <div className="list">
              <div className="list-item"><div><strong>{account?.nome}</strong><small>{label("tipo_conta", account?.tipo)}</small></div><Badge tone={account?.status === "ativa" ? "ok" : account?.status === "trial" ? "info" : "bad"}>{label("status_conta", account?.status)}</Badge></div>
              <div className="list-item"><div><strong>Plano</strong><small>{account?.plans?.nome ?? "Sem plano definido"} · cobrança {account?.ciclo}</small></div></div>
              {account?.status === "trial" && <div className="list-item"><div><strong>Teste grátis até</strong><small>{date(account.trial_ate)}</small></div></div>}
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>Para trocar de plano ou ativar a conta, <Link to="/app/suporte">abra um chamado</Link>.</p>
          </Panel>
          <Panel title="Aparência">
            <div className="chips">
              {([["system", "Sistema", Monitor], ["light", "Claro", Sun], ["dark", "Escuro", Moon]] as const).map(([k, l, Icon]) => (
                <button key={k} className={`chip ${theme === k ? "active" : ""}`} onClick={() => pick(k)}><Icon size={14} /> {l}</button>
              ))}
            </div>
          </Panel>
          <Panel title="Senha">
            <form className="form-row" onSubmit={savePass}>
              <label className="field"><span>Nova senha</span><input type="password" minLength={6} required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></label>
              <div style={{ alignSelf: "end" }}><button className="btn btn-ghost">Alterar senha</button></div>
            </form>
          </Panel>
        </div>
      </div>
      <Panel title="Privacidade e seus dados (LGPD)" className="mt" actions={<button className="btn btn-ghost btn-sm" onClick={() => setAsking(true)}>Fazer solicitação</button>}>
        <p className="muted small" style={{ marginBottom: 12 }}>Peça acesso, correção, portabilidade ou exclusão dos seus dados. Leia a <Link to="/privacidade" target="_blank">política de privacidade</Link>.</p>
        {lgpd.rows.length ? (
          <div className="list">{lgpd.rows.map((r) => (
            <div className="list-item" key={r.id}><div><strong>{label("tipo_lgpd", r.tipo)}</strong><small>{date(r.created_at)} · prazo {date(r.prazo)}{r.resposta ? ` · resposta: ${r.resposta}` : ""}</small></div>
              <Badge tone={r.status === "concluida" ? "ok" : r.status === "negada" ? "bad" : "warn"}>{label("status_lgpd", r.status)}</Badge></div>
          ))}</div>
        ) : <EmptyState title="Nenhuma solicitação" />}
      </Panel>
      {asking && <FormModal title="Solicitação sobre meus dados" submitLabel="Enviar solicitação" onClose={() => setAsking(false)} onSubmit={ask} initial={{ tipo: "acesso" }}
        fields={[{ key: "tipo", label: "O que você precisa?", type: "select", options: options("tipo_lgpd"), required: true }, { key: "detalhes", label: "Detalhes (opcional)", type: "textarea" }]} />}
    </>
  );
}
