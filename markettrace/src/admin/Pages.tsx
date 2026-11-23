import { Signature } from "../app/Layout";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Plus, Trash2 } from "lucide-react";
import { Crud, type FieldDef } from "../components/Crud";
import { TicketThread } from "../components/Tickets";
import { Badge, EmptyState, Loading, Modal, Notice, PageHeader, Panel, Stat, Tabs, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { date, dateTime, firstOfMonth, integer, label, money, options, timeAgo } from "../lib/format";
import { clearSiteCache, DEFAULT_SETTINGS, type PortfolioItem, type SiteSettings } from "../lib/site";
import { errorMessage, supabase } from "../lib/supabase";
import { ticketTone } from "../app/Account";

const statusTone = (s: string) => (s === "ativa" ? "ok" : s === "trial" ? "info" : s === "suspensa" ? "warn" : "bad") as "ok" | "info" | "warn" | "bad";

/* ======================= CENTRAL ======================= */
export function AdminHome() {
  const accounts = useRows({ table: "accounts", select: "id,nome,status,ciclo,created_at, plans(nome,preco_mensal,preco_anual)", order: ["created_at", false] });
  const tickets = useRows({ table: "support_tickets", select: "id,assunto,status,prioridade,updated_at, accounts(nome)", order: ["updated_at", false], limit: 6 });
  const leads = useRows({ table: "contact_leads", select: "id,nome,empresa,status,created_at", order: ["created_at", false], limit: 6 });
  const lgpd = useRows({ table: "lgpd_requests", select: "id,status", eq: {} });
  const openTickets = useRows({ table: "support_tickets", select: "id", eq: { status: "aberto" } });

  const a = accounts.rows;
  const month = firstOfMonth();
  const mrr = a.filter((x) => x.status === "ativa" && x.plans).reduce((t, x) => t + (x.ciclo === "anual" && x.plans.preco_anual ? x.plans.preco_anual / 12 : Number(x.plans.preco_mensal)), 0);
  if (accounts.loading) return <Loading />;
  return (
    <>
      <PageHeader kicker="Controle da plataforma" title="Central" text="Uma visão operacional dos assinantes, do atendimento e dos pedidos de privacidade." />
      <Notice tone="error">{accounts.error}</Notice>
      <div className="stats">
        <Stat label="Assinantes" value={integer(a.length)} note={`${a.filter((x) => x.created_at >= month).length} novos neste mês`} />
        <Stat label="Contas ativas" value={integer(a.filter((x) => x.status === "ativa").length)} />
        <Stat label="Em teste grátis" value={integer(a.filter((x) => x.status === "trial").length)} />
        <Stat label="Suspensas / canceladas" value={integer(a.filter((x) => x.status === "suspensa" || x.status === "cancelada").length)} />
        <Stat label="Receita mensal prevista" value={money(mrr)} note="contas ativas × preço do plano" />
        <Stat label="Chamados abertos" value={integer(openTickets.rows.length)} tone={openTickets.rows.length ? "signal" : undefined} />
        <Stat label="Contatos novos" value={integer(leads.rows.filter((l) => l.status === "novo").length)} />
        <Stat label="LGPD pendentes" value={integer(lgpd.rows.filter((r) => r.status === "aberta" || r.status === "em_andamento").length)} />
      </div>
      <div className="grid-2-even">
        <Panel kicker="Clientes" title="Cadastros recentes" actions={<Link to="/admin/assinantes" className="btn btn-ghost btn-sm">Ver todos</Link>}>
          {a.length ? <div className="list">{a.slice(0, 6).map((x) => (
            <div className="list-item" key={x.id}><div><strong>{x.nome}</strong><small>{x.plans?.nome ?? "sem plano"} · {date(x.created_at)}</small></div><Badge tone={statusTone(x.status)}>{label("status_conta", x.status)}</Badge></div>
          ))}</div> : <EmptyState title="Nenhum assinante ainda" />}
        </Panel>
        <Panel kicker="Atendimento" title="Últimos chamados" actions={<Link to="/admin/suporte" className="btn btn-ghost btn-sm">Abrir suporte</Link>}>
          {tickets.rows.length ? <div className="list">{tickets.rows.map((t) => (
            <div className="list-item" key={t.id}><div><strong>{t.assunto}</strong><small>{t.accounts?.nome} · {timeAgo(t.updated_at)}</small></div><Badge tone={ticketTone(t.status)}>{label("status_ticket", t.status)}</Badge></div>
          ))}</div> : <EmptyState title="Nenhum chamado" />}
        </Panel>
      </div>
      <Panel kicker="Site" title="Contatos recebidos" actions={<Link to="/admin/contatos" className="btn btn-ghost btn-sm">Ver contatos</Link>}>
        {leads.rows.length ? <div className="list">{leads.rows.map((l) => (
          <div className="list-item" key={l.id}><div><strong>{l.nome}</strong><small>{l.empresa ?? "—"} · {timeAgo(l.created_at)}</small></div><Badge tone={l.status === "novo" ? "signal" : "neutral"}>{label("status_lead", l.status)}</Badge></div>
        ))}</div> : <EmptyState title="Nenhum contato pelo site ainda" />}
      </Panel>
    </>
  );
}

/* ======================= ASSINANTES ======================= */
function AccountDetail({ acc, plans, onClose, onSaved }: { acc: Row; plans: Row[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ status: acc.status, plan_id: acc.plan_id ?? "", trial_ate: acc.trial_ate ?? "", ciclo: acc.ciclo, ilimitado: !!acc.ilimitado });
  const [error, setError] = useState("");
  const companies = useRows({ table: "companies", select: "id,nome,segmento,ativa", eq: { account_id: acc.id }, order: ["nome"] });
  const members = useRows({ table: "account_members", select: "papel, profiles(nome,email)", eq: { account_id: acc.id } });
  const tickets = useRows({ table: "support_tickets", select: "id,assunto,status,created_at", eq: { account_id: acc.id }, order: ["created_at", false] });
  const save = async () => {
    const { error: err } = await supabase.rpc("admin_update_account", { p_account: acc.id, p_status: f.status, p_plan: f.plan_id || null, p_trial_ate: f.trial_ate || null, p_ciclo: f.ciclo });
    if (err) return setError(errorMessage(err));
    if (f.ilimitado !== !!acc.ilimitado) {
      const r = await supabase.rpc("admin_set_unlimited", { p_account: acc.id, p_value: f.ilimitado });
      if (r.error) return setError(errorMessage(r.error));
    }
    toast("Conta atualizada"); onSaved(); onClose();
  };
  return (
    <Modal title={acc.nome} onClose={onClose} wide>
      <p className="muted small">{label("tipo_conta", acc.tipo)} · dono(a): {acc.owner?.nome} ({acc.owner?.email}) · desde {date(acc.created_at)}</p>
      <div className="form-grid" style={{ margin: "16px 0" }}>
        <label className="field half"><span>Status</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{options("status_conta").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <label className="field half"><span>Plano</span><select value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: e.target.value })}><option value="">Sem plano</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? "" : " (inativo)"}</option>)}</select></label>
        <label className="field half"><span>Teste grátis até</span><input type="date" value={f.trial_ate} onChange={(e) => setF({ ...f, trial_ate: e.target.value })} /></label>
        <label className="field half"><span>Cobrança</span><select value={f.ciclo} onChange={(e) => setF({ ...f, ciclo: e.target.value })}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label>
        <label className="check full"><input type="checkbox" checked={f.ilimitado} onChange={(e) => setF({ ...f, ilimitado: e.target.checked })} /> Conta ilimitada: sem limite de empresas, usuários e pessoas por empresa (ex.: sua conta e cortesias)</label>
        <div className="full"><Notice tone="error">{error}</Notice></div>
        <div className="full form-actions"><button className="btn btn-primary" onClick={save}>Salvar alterações</button></div>
      </div>
      <div className="grid-2-even">
        <div><span className="data-label">Empresas ({companies.rows.length})</span>
          <div className="list">{companies.rows.map((c) => <div className="list-item" key={c.id}><div><strong>{c.nome}</strong><small>{c.segmento ?? "—"}{c.ativa ? "" : " · arquivada"}</small></div></div>)}</div></div>
        <div><span className="data-label">Pessoas ({members.rows.length})</span>
          <div className="list">{members.rows.map((m, i) => <div className="list-item" key={i}><div><strong>{m.profiles?.nome}</strong><small>{m.profiles?.email}</small></div><Badge>{label("papel", m.papel)}</Badge></div>)}</div></div>
      </div>
      <span className="data-label" style={{ marginTop: 16 }}>Chamados ({tickets.rows.length})</span>
      <div className="list">{tickets.rows.map((t) => <div className="list-item" key={t.id}><div><strong>{t.assunto}</strong><small>{date(t.created_at)}</small></div><Badge tone={ticketTone(t.status)}>{label("status_ticket", t.status)}</Badge></div>)}</div>
    </Modal>
  );
}

function People() {
  const toast = useToast();
  const { profile } = useAuth();
  const { rows, loading, reload } = useRows({ table: "profiles", select: "id,nome,email,telefone,is_super_admin,created_at", order: ["created_at", false] });
  const [q, setQ] = useState("");
  const toggle = async (p: Row) => {
    if (!window.confirm(p.is_super_admin ? `Remover o acesso de admin de ${p.nome}?` : `Dar acesso TOTAL de admin a ${p.nome}? Essa pessoa verá todos os clientes.`)) return;
    const { error } = await supabase.rpc("admin_set_super_admin", { p_user: p.id, p_value: !p.is_super_admin });
    if (error) toast(errorMessage(error), "error"); else { toast("Acesso atualizado"); await reload(); }
  };
  const list = rows.filter((p) => !q || `${p.nome} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel title="Pessoas cadastradas" actions={<input className="btn btn-ghost btn-sm" placeholder="Buscar nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />}>
      {loading ? <Loading /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Cadastro</th><th>Acesso</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}>
              <td data-label="Nome"><strong>{p.nome}</strong></td><td data-label="E-mail">{p.email}</td><td data-label="WhatsApp">{p.telefone ?? "—"}</td><td data-label="Cadastro">{date(p.created_at)}</td>
              <td data-label="Acesso">{p.id === profile?.id ? <Badge tone="signal">Admin (você)</Badge> : <button className="btn btn-ghost btn-sm" onClick={() => toggle(p)}>{p.is_super_admin ? "Admin · remover" : "Tornar admin"}</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Panel>
  );
}

export function AdminAccounts() {
  const [tab, setTab] = useState<"contas" | "pessoas">("contas");
  const [status, setStatus] = useState("todas");
  const { rows, loading, error, reload } = useRows({ table: "accounts", select: "*, plans(nome), owner:profiles!accounts_owner_id_fkey(nome,email), companies(count), account_members(count)", order: ["created_at", false] });
  const plans = useRows({ table: "plans", order: ["ordem"] });
  const [open, setOpen] = useState<Row | null>(null);
  const list = rows.filter((r) => status === "todas" || r.status === status);
  return (
    <>
      <PageHeader kicker="Clientes" title="Assinantes" text="Todas as contas da plataforma. Ative, suspenda, troque o plano ou estenda o teste grátis."
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: "contas", label: "Contas" }, { value: "pessoas", label: "Pessoas" }]} />} />
      {tab === "pessoas" ? <People /> : (
        <Panel actions={<select className="btn btn-ghost btn-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar status"><option value="todas">Todos os status</option>{options("status_conta").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>} title={`${list.length} conta(s)`}>
          <Notice tone="error">{error}</Notice>
          {loading ? <Loading /> : list.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Conta</th><th>Dono(a)</th><th>Plano</th><th>Status</th><th>Empresas</th><th>Pessoas</th><th>Cadastro</th></tr></thead>
              <tbody>{list.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r)}>
                  <td data-label="Conta"><strong>{r.nome}</strong><br /><small className="muted">{label("tipo_conta", r.tipo)}</small></td>
                  <td data-label="Dono(a)">{r.owner?.nome}<br /><small className="muted">{r.owner?.email}</small></td>
                  <td data-label="Plano">{r.plans?.nome ?? "—"}</td>
                  <td data-label="Status"><Badge tone={statusTone(r.status)}>{label("status_conta", r.status)}</Badge>{r.status === "trial" && r.trial_ate ? <><br /><small className="muted">até {date(r.trial_ate)}</small></> : null}</td>
                  <td data-label="Empresas" className="num">{r.companies?.[0]?.count ?? 0}</td>
                  <td data-label="Pessoas" className="num">{r.account_members?.[0]?.count ?? 0}</td>
                  <td data-label="Cadastro">{date(r.created_at)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState title="Nenhuma conta com esse filtro" />}
        </Panel>
      )}
      {open && <AccountDetail acc={open} plans={plans.rows} onClose={() => setOpen(null)} onSaved={reload} />}
    </>
  );
}

/* ======================= CONTATOS DO SITE ======================= */
export function AdminLeads() {
  const [status, setStatus] = useState("todos");
  const waLink = (tel?: string) => (tel ? `https://wa.me/55${tel.replace(/\D/g, "").replace(/^55/, "")}` : "");
  const fields: FieldDef[] = [
    { key: "nome", label: "Nome", list: true, readOnly: true, format: (v, r) => <><strong>{String(v)}</strong><br /><small className="muted">{r.email}</small></> },
    { key: "email", label: "E-mail", readOnly: true, half: true },
    { key: "telefone", label: "WhatsApp", readOnly: true, half: true, list: true },
    { key: "empresa", label: "Empresa", readOnly: true, half: true, list: true },
    { key: "plano_interesse", label: "Plano de interesse", readOnly: true, half: true, list: true },
    { key: "mensagem", label: "Mensagem", type: "textarea", readOnly: true },
    { key: "status", label: "Status", type: "select", options: options("status_lead"), required: true, half: true, list: true,
      format: (v) => <Badge tone={v === "novo" ? "signal" : v === "convertido" ? "ok" : v === "perdido" ? "neutral" : "warn"}>{label("status_lead", String(v))}</Badge> },
    { key: "created_at", label: "Recebido em", type: "datetime", readOnly: true, half: true, list: true },
    { key: "anotacoes", label: "Anotações internas", type: "textarea" },
  ];
  return (
    <>
      <PageHeader kicker="Site" title="Contatos do site" text="Mensagens do formulário de contato. Abra para ler, anotar e mudar o status."
        actions={<Tabs value={status} onChange={setStatus} items={[{ value: "todos", label: "Todos" }, ...options("status_lead")]} />} />
      <Crud table="contact_leads" scope="none" canEdit noCreate fields={fields} eq={{ status: status === "todos" ? undefined : status }}
        empty={{ title: "Nenhum contato aqui", text: "Quando alguém enviar o formulário do site, aparece nesta lista." }}
        rowActions={(r) => <>
          <a className="icon-btn" title="Responder por e-mail" href={`mailto:${r.email}?subject=MarketTrace`}><Mail size={15} /></a>
          {r.telefone && <a className="icon-btn" title="Chamar no WhatsApp" href={waLink(r.telefone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /></a>}
        </>} />
    </>
  );
}

/* ======================= SUPORTE ======================= */
export function AdminTickets() {
  const toast = useToast();
  const [status, setStatus] = useState("abertos");
  const { rows, loading, reload } = useRows({ table: "support_tickets", select: "*, accounts(nome), profiles(nome,email)", order: ["updated_at", false] });
  const [open, setOpen] = useState<Row | null>(null);
  const list = rows.filter((t) => status === "todos" || (status === "abertos" ? ["aberto", "em_andamento"].includes(t.status) : t.status === status));
  useEffect(() => { if (open) setOpen(rows.find((r) => r.id === open.id) ?? open); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = async (patch: Row) => {
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", open!.id);
    if (error) toast(errorMessage(error), "error"); else { toast("Chamado atualizado"); await reload(); }
  };
  return (
    <>
      <PageHeader kicker="Atendimento" title="Suporte" text="Chamados de todos os assinantes. Responda por aqui: o cliente vê a resposta dentro do app."
        actions={<Tabs value={status} onChange={setStatus} items={[{ value: "abertos", label: "Em aberto" }, { value: "resolvido", label: "Resolvidos" }, { value: "fechado", label: "Fechados" }, { value: "todos", label: "Todos" }]} />} />
      <div className="grid-2">
        <Panel title={`${list.length} chamado(s)`}>
          {loading ? <Loading /> : list.length ? (
            <div className="list">{list.map((t) => (
              <button key={t.id} className="list-item" onClick={() => setOpen(t)} style={{ textAlign: "left", background: open?.id === t.id ? "var(--surface-2)" : "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", padding: "11px 8px", borderRadius: 8 }}>
                <div><strong>{t.assunto}</strong><small>{t.accounts?.nome} · {label("categoria_ticket", t.categoria)} · {label("prioridade", t.prioridade)} · {timeAgo(t.updated_at)}</small></div>
                <Badge tone={ticketTone(t.status)}>{label("status_ticket", t.status)}</Badge>
              </button>
            ))}</div>
          ) : <EmptyState title="Nenhum chamado aqui" />}
        </Panel>
        <Panel title={open ? open.assunto : "Conversa"} kicker={open ? `${open.accounts?.nome} · ${open.profiles?.nome} (${open.profiles?.email})` : undefined}>
          {open ? (
            <>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label className="field"><span>Status</span><select value={open.status} onChange={(e) => update({ status: e.target.value })}>{options("status_ticket").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                <label className="field"><span>Prioridade</span><select value={open.prioridade} onChange={(e) => update({ prioridade: e.target.value })}>{options("prioridade").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
              </div>
              <TicketThread ticket={open} onChange={reload} />
            </>
          ) : <EmptyState title="Selecione um chamado" />}
        </Panel>
      </div>
    </>
  );
}

/* ======================= PLANOS ======================= */
export function AdminPlans() {
  const fields: FieldDef[] = [
    { key: "nome", label: "Nome do plano", required: true, list: true },
    { key: "descricao", label: "Descrição curta", placeholder: "Para quem é este plano?" },
    { key: "preco_mensal", label: "Preço mensal (R$)", type: "money", required: true, half: true, list: true },
    { key: "preco_anual", label: "Preço anual total (R$)", type: "money", half: true, list: true, help: "Opcional. Se preenchido, o site mostra a opção anual." },
    { key: "limite_empresas", label: "Limite de empresas", type: "number", half: true, list: true, help: "Vazio = ilimitado", format: (v) => (v == null ? "Ilimitado" : String(v)) },
    { key: "limite_usuarios", label: "Limite de usuários", type: "number", half: true, list: true, help: "Vazio = ilimitado", format: (v) => (v == null ? "Ilimitado" : String(v)) },
    { key: "ia_mensagens_mes", label: "Mensagens de IA por mês", type: "number", half: true, list: true, help: "Vazio = ilimitado · 0 = plano sem IA", format: (v) => (v == null ? "Ilimitado" : v === 0 ? "Sem IA" : String(v)) },
    { key: "recursos", label: "Recursos (separe por vírgula)", type: "tags", placeholder: "Calculadoras, Agenda editorial, Suporte prioritário" },
    { key: "ordem", label: "Ordem no site", type: "number", half: true },
    { key: "destaque", label: "Destacar como “mais escolhido”", type: "checkbox", half: true },
    { key: "ativo", label: "Visível no site e no cadastro", type: "checkbox", list: true, format: (v) => <Badge tone={v ? "ok" : "neutral"}>{v ? "Ativo" : "Oculto"}</Badge> },
  ];
  return (
    <>
      <PageHeader kicker="Comercial" title="Planos" text="O que você salvar aqui aparece na página de planos do site e no cadastro. Planos ocultos continuam valendo para quem já assinou." />
      <Crud table="plans" scope="none" canEdit fields={fields} order={["ordem"]} newLabel="Novo plano" defaults={{ ativo: true, ordem: 0, recursos: [] }}
        empty={{ title: "Nenhum plano criado", text: "Crie os planos e preços. Enquanto não houver plano ativo, o site mostra “planos em definição” com link para contato." }} />
    </>
  );
}

/* ======================= CONTEÚDO DO SITE ======================= */
const SITE_FIELDS: Array<{ key: keyof SiteSettings; label: string; textarea?: boolean }> = [
  { key: "hero_titulo", label: "Título principal da página inicial" },
  { key: "hero_subtitulo", label: "Subtítulo da página inicial", textarea: true },
  { key: "hero_video_url", label: "Vídeo do topo (opcional): link do YouTube, Vimeo ou arquivo .mp4. Vazio = animação do produto" },
  { key: "contato_nome", label: "Nome" },
  { key: "contato_cargo", label: "Cargo / descrição" },
  { key: "contato_email", label: "E-mail de contato" },
  { key: "contato_whatsapp", label: "WhatsApp (como aparece no site)" },
  { key: "contato_whatsapp_link", label: "Link do WhatsApp (wa.me)" },
  { key: "contato_instagram", label: "Instagram (@)" },
  { key: "contato_linkedin", label: "Link do LinkedIn" },
  { key: "portfolio_link", label: "Link do portfólio completo / site pessoal" },
];

export function AdminSite() {
  const toast = useToast();
  const [data, setData] = useState<SiteSettings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("site_settings").select("data").eq("id", 1).maybeSingle().then(({ data: d }) => setData({ ...DEFAULT_SETTINGS, ...((d?.data as Partial<SiteSettings>) ?? {}) }));
  }, []);
  if (!data) return <Loading />;
  const setItem = (i: number, k: keyof PortfolioItem, v: string) => setData({ ...data, portfolio: data.portfolio.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const save = async () => {
    setError("");
    const portfolio = data.portfolio.filter((p) => p.titulo?.trim());
    const { error: err } = await supabase.from("site_settings").update({ data: { ...data, portfolio }, updated_at: new Date().toISOString() }).eq("id", 1);
    if (err) setError(errorMessage(err)); else { clearSiteCache(); toast("Site atualizado. Recarregue o site para ver."); }
  };
  return (
    <>
      <PageHeader kicker="Site" title="Conteúdo do site" text="Textos da página inicial, seus dados de contato e o portfólio. Muda no site sem mexer no código." actions={<button className="btn btn-primary" onClick={save}>Salvar</button>} />
      <Notice tone="error">{error}</Notice>
      <div className="grid-2-even">
        <Panel title="Textos e contato">
          <div className="form-stack">
            {SITE_FIELDS.map((f) => (
              <label className="field" key={f.key}><span>{f.label}</span>
                {f.textarea
                  ? <textarea rows={3} value={String(data[f.key] ?? "")} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
                  : <input value={String(data[f.key] ?? "")} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />}
              </label>
            ))}
          </div>
        </Panel>
        <Panel title="Assinatura" kicker="Rodapé do menu do app e do site">
          <div className="form-stack">
            <label className="field"><span>Frase antes do nome</span><input value={data.assinatura_rotulo} onChange={(e) => setData({ ...data, assinatura_rotulo: e.target.value })} placeholder="Ex.: Uma criação de, Desenvolvido por, Por" /></label>
            <label className="field"><span>Nome que aparece</span><input value={data.assinatura_nome} onChange={(e) => setData({ ...data, assinatura_nome: e.target.value })} placeholder="Seu nome ou o nome do seu estúdio" /></label>
            <label className="field"><span>Como mostrar</span>
              <select value={data.assinatura_estilo} onChange={(e) => setData({ ...data, assinatura_estilo: e.target.value as "texto" | "logo" })}>
                <option value="texto">Só o nome, em texto</option>
                <option value="logo">Logomarca (imagem)</option>
              </select></label>
            {data.assinatura_estilo === "logo" && <label className="field"><span>Endereço da logomarca (clara, para fundo escuro)</span><input value={data.assinatura_logo_url} onChange={(e) => setData({ ...data, assinatura_logo_url: e.target.value })} placeholder="https://" /></label>}
            <label className="field"><span>Link ao clicar (opcional)</span><input type="url" value={data.assinatura_link} onChange={(e) => setData({ ...data, assinatura_link: e.target.value })} placeholder="https:// (portfólio, site ou Instagram)" /></label>
            <div className="side-preview"><Signature s={data} className="side-credit" /></div>
          </div>
        </Panel>
        <Panel title="Portfólio" actions={<button className="btn btn-ghost btn-sm" onClick={() => setData({ ...data, portfolio: [...data.portfolio, { titulo: "" }] })}><Plus size={14} /> Adicionar trabalho</button>}>
          {data.portfolio.length === 0 && <EmptyState title="Nenhum trabalho no portfólio" text="Adicione projetos com título, descrição, link e uma imagem (endereço de imagem já publicada)." />}
          <div className="stack">
            {data.portfolio.map((p, i) => (
              <div className="card" key={i}>
                <div className="card-foot"><span className="data-label">Trabalho {i + 1}</span><button className="icon-btn danger" onClick={() => setData({ ...data, portfolio: data.portfolio.filter((_, j) => j !== i) })} title="Remover"><Trash2 size={15} /></button></div>
                <label className="field"><span>Título</span><input value={p.titulo} onChange={(e) => setItem(i, "titulo", e.target.value)} /></label>
                <label className="field"><span>Descrição</span><textarea rows={2} value={p.descricao ?? ""} onChange={(e) => setItem(i, "descricao", e.target.value)} /></label>
                <label className="field"><span>Link do projeto</span><input type="url" value={p.link ?? ""} onChange={(e) => setItem(i, "link", e.target.value)} placeholder="https://" /></label>
                <label className="field"><span>Imagem (link)</span><input type="url" value={p.imagem_url ?? ""} onChange={(e) => setItem(i, "imagem_url", e.target.value)} placeholder="https://" /></label>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ======================= LGPD ======================= */
export function AdminLgpd() {
  const fields: FieldDef[] = [
    { key: "profiles", label: "Titular", list: true, listOnly: true, format: (v) => { const p = v as Row | null; return p ? <><strong>{p.nome}</strong><br /><small className="muted">{p.email}</small></> : "—"; } },
    { key: "tipo", label: "Pedido", type: "select", options: options("tipo_lgpd"), readOnly: true, list: true },
    { key: "detalhes", label: "Detalhes", type: "textarea", readOnly: true },
    { key: "created_at", label: "Recebido", type: "datetime", readOnly: true, list: true, half: true },
    { key: "prazo", label: "Prazo", type: "date", list: true, half: true },
    { key: "status", label: "Status", type: "select", options: options("status_lgpd"), required: true, list: true,
      format: (v) => <Badge tone={v === "concluida" ? "ok" : v === "negada" ? "bad" : "warn"}>{label("status_lgpd", String(v))}</Badge> },
    { key: "resposta", label: "Resposta ao titular", type: "textarea", help: "O titular vê esta resposta em Minha conta → Privacidade." },
  ];
  return (
    <>
      <PageHeader kicker="Privacidade" title="Solicitações LGPD" text="Pedidos de acesso, correção, portabilidade e exclusão de dados. O prazo padrão é de 15 dias." />
      <Crud table="lgpd_requests" scope="none" canEdit noCreate noDelete select="*, profiles(nome,email)" fields={fields} order={["created_at", false]}
        empty={{ title: "Nenhuma solicitação", text: "Os pedidos feitos pelos usuários aparecem aqui." }} />
    </>
  );
}

/* ======================= AUDITORIA ======================= */
export function AdminAudit() {
  const [table, setTable] = useState("");
  const { rows, loading } = useRows({ table: "audit_log", eq: { tabela: table || undefined }, order: ["created_at", false], limit: 300 });
  const people = useRows({ table: "profiles", select: "id,nome" });
  const names = useMemo(() => Object.fromEntries(people.rows.map((p) => [p.id, p.nome])), [people.rows]);
  const [open, setOpen] = useState<Row | null>(null);
  const TABLES: Record<string, string> = { accounts: "Contas", plans: "Planos", companies: "Empresas", account_members: "Membros", invitations: "Convites", support_tickets: "Chamados", contact_leads: "Contatos", lgpd_requests: "LGPD", site_settings: "Site" };
  const ACTIONS: Record<string, string> = { insert: "criou", update: "alterou", delete: "apagou" };
  return (
    <>
      <PageHeader kicker="Segurança" title="Auditoria" text="Registro automático de quem criou, alterou ou apagou contas, planos, empresas, chamados e conteúdo do site (últimos 300)."
        actions={<select className="btn btn-ghost btn-sm" value={table} onChange={(e) => setTable(e.target.value)} aria-label="Filtrar"><option value="">Tudo</option>{Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>} />
      <Panel>
        {loading ? <Loading /> : rows.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Onde</th><th>Registro</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setOpen(r)}>
                <td data-label="Quando">{dateTime(r.created_at)}</td>
                <td data-label="Quem">{r.actor_id ? names[r.actor_id] ?? "Usuário" : "Sistema"}</td>
                <td data-label="Ação">{ACTIONS[r.acao] ?? r.acao}</td>
                <td data-label="Onde">{TABLES[r.tabela] ?? r.tabela}</td>
                <td data-label="Registro">{r.detalhes?.nome ?? r.detalhes?.assunto ?? r.detalhes?.email ?? String(r.registro_id).slice(0, 8)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <EmptyState title="Nada registrado ainda" />}
      </Panel>
      {open && <Modal title="Detalhes do registro" onClose={() => setOpen(null)} wide><pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, fontFamily: "var(--f-mono)" }}>{JSON.stringify(open.detalhes, null, 2)}</pre></Modal>}
    </>
  );
}
