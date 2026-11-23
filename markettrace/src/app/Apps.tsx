import { useEffect, useState } from "react";
import { Copy, History, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Badge, EmptyState, Loading, Modal, Notice, Panel, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { dateTime } from "../lib/format";
import { errorMessage, supabase } from "../lib/supabase";

export const APP_TIPOS = [
  { value: "crm", label: "CRM" },
  { value: "automacao", label: "Automação" },
  { value: "erp", label: "ERP / gestão" },
  { value: "ecommerce", label: "Loja virtual" },
  { value: "planilha", label: "Planilha / Make / Zapier / n8n" },
  { value: "outro", label: "Outro" },
];

export const APP_EVENTOS: Array<{ grupo: string; itens: Array<{ value: string; label: string }> }> = [
  { grupo: "Posts", itens: [
    { value: "post.novo", label: "Post criado ou agendado" },
    { value: "post.alterado", label: "Post alterado" },
    { value: "post.publicado", label: "Post marcado como publicado" },
    { value: "post.apagado", label: "Post apagado" },
  ] },
  { grupo: "Tarefas", itens: [
    { value: "tarefa.novo", label: "Tarefa criada" },
    { value: "tarefa.alterado", label: "Tarefa alterada" },
    { value: "tarefa.concluida", label: "Tarefa concluída" },
  ] },
  { grupo: "Campanhas", itens: [
    { value: "campanha.novo", label: "Campanha criada" },
    { value: "campanha.alterado", label: "Campanha alterada" },
  ] },
  { grupo: "Vendas", itens: [
    { value: "venda.novo", label: "Venda registrada" },
  ] },
];

const tipoLabel = (v: string) => APP_TIPOS.find((t) => t.value === v)?.label ?? v;

function AppModal({ initial, onClose, onSaved }: { initial: Row; onClose: () => void; onSaved: (row: Row) => void }) {
  const { account, company } = useAuth();
  const [f, setF] = useState({ nome: initial.nome ?? "", tipo: initial.tipo ?? "crm", url: initial.url ?? "", eventos: (initial.eventos as string[]) ?? ["post.novo", "post.publicado"], ativo: initial.ativo ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (v: string) => setF({ ...f, eventos: f.eventos.includes(v) ? f.eventos.filter((e) => e !== v) : [...f.eventos, v] });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https:\/\/\S+$/.test(f.url.trim())) return setError("Use um endereço seguro, começando com https://");
    if (!f.eventos.length) return setError("Escolha pelo menos um evento.");
    setBusy(true); setError("");
    const values = { ...f, url: f.url.trim(), nome: f.nome.trim() };
    const res = initial.id
      ? await supabase.from("app_connections").update(values).eq("id", initial.id).select().single()
      : await supabase.from("app_connections").insert({ ...values, account_id: account!.id, company_id: company!.id }).select().single();
    setBusy(false);
    if (res.error) return setError(errorMessage(res.error));
    onSaved(res.data);
  };
  return (
    <Modal title={initial.id ? `Editar ${initial.nome}` : "Conectar app próprio"} onClose={onClose} wide>
      <form className="form-grid" onSubmit={submit}>
        <label className="field half"><span>Nome do app *</span><input required maxLength={80} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: CRM MCI" /></label>
        <label className="field half"><span>Tipo</span><select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{APP_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="field full"><span>Endereço que recebe os avisos (webhook) *</span><input required type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://seu-app.com/webhooks/markettrace" />
          <small>Peça esse endereço para quem cuida do app. Precisa começar com https://</small></label>
        <div className="field full"><span>Quando avisar o app</span>
          <div className="event-grid">
            {APP_EVENTOS.map((g) => (
              <div key={g.grupo}><span className="data-label">{g.grupo}</span>
                {g.itens.map((i) => <label className="check" key={i.value}><input type="checkbox" checked={f.eventos.includes(i.value)} onChange={() => toggle(i.value)} /> {i.label}</label>)}
              </div>
            ))}
          </div>
        </div>
        <label className="check full"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Conexão ativa</label>
        <div className="full"><Notice tone="error">{error}</Notice></div>
        <div className="full form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar conexão"}</button></div>
      </form>
    </Modal>
  );
}

function HowTo({ app }: { app: Row }) {
  const toast = useToast();
  const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => toast(`${what} copiado`)); };
  const exemplo = `{
  "evento": "post.publicado",
  "enviado_em": "2026-11-23T14:00:00Z",
  "empresa": { "id": "…", "nome": "…" },
  "dados": { "id": "…", "titulo": "…", "rede": "instagram", "status": "publicado", "data_hora": "…" }
}`;
  const codigo = `// Node.js: confira se o aviso veio mesmo do MarketTrace
const crypto = require("crypto");
const esperado = "sha256=" + crypto.createHmac("sha256", SEGREDO).update(corpoBruto).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(req.headers["x-markettrace-assinatura"]));`;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="secret-row">
        <div><span className="data-label">Chave secreta desta conexão</span><code className="secret">{app.segredo}</code></div>
        <button className="btn btn-ghost btn-sm" onClick={() => copy(app.segredo, "Chave")}><Copy size={14} /> Copiar</button>
      </div>
      <details className="howto">
        <summary>Como o app recebe e confere os avisos (para o time técnico)</summary>
        <p className="muted small">A cada evento escolhido, o MarketTrace envia um <code>POST</code> em JSON para o endereço cadastrado, com os cabeçalhos <code>X-MarketTrace-Evento</code> e <code>X-MarketTrace-Assinatura</code>. A assinatura é um HMAC-SHA256 do corpo recebido, feito com a chave secreta acima. O app deve responder com código 2xx em até 5 segundos.</p>
        <pre>{exemplo}</pre>
        <pre>{codigo}</pre>
        <button className="btn btn-ghost btn-sm" onClick={() => copy(`${exemplo}\n\n${codigo}`, "Exemplo")}><Copy size={14} /> Copiar exemplo</button>
      </details>
    </div>
  );
}

function LogModal({ app, onClose }: { app: Row; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.rpc("app_delivery_log", { p_connection: app.id, p_limit: 30 }).then(({ data, error: err }) => {
      if (err) setError(errorMessage(err)); else setRows(data ?? []);
    });
  }, [app.id]);
  return (
    <Modal title={`Avisos enviados para ${app.nome}`} onClose={onClose} wide>
      <Notice tone="error">{error}</Notice>
      {!rows ? (!error && <Loading />) : rows.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Evento</th><th>Quando</th><th>Resposta do app</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td data-label="Evento"><code>{r.evento}</code></td>
              <td data-label="Quando">{dateTime(r.created_at)}</td>
              <td data-label="Resposta">{r.status_code
                ? <Badge tone={r.status_code < 300 ? "ok" : "bad"}>{r.status_code < 300 ? `Recebido (${r.status_code})` : `Erro ${r.status_code}`}</Badge>
                : r.erro ? <Badge tone="bad">Falhou</Badge> : <Badge>Enviando…</Badge>}
                {r.erro && <small className="muted" style={{ display: "block" }}>{r.erro}</small>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="Nenhum aviso enviado ainda" text="Use “Enviar teste” ou crie um post para ver o primeiro envio aqui." />}
      <p className="muted small" style={{ marginTop: 10 }}>A resposta do app pode levar alguns segundos para aparecer. Feche e abra de novo para atualizar.</p>
    </Modal>
  );
}

/** Integração com apps próprios da empresa (CRM, automação, ERP) por webhook */
export function OwnApps() {
  const { company, canEdit } = useAuth();
  const toast = useToast();
  const apps = useRows({ table: "app_connections", eq: { company_id: company?.id }, order: ["created_at"], skip: !company || !canEdit });
  const [editing, setEditing] = useState<Row | null>(null);
  const [log, setLog] = useState<Row | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const test = async (a: Row) => {
    const { error } = await supabase.rpc("app_send_test", { p_connection: a.id });
    if (error) toast(errorMessage(error), "error"); else toast("Teste enviado. Veja a resposta em “Histórico”.");
  };
  const remove = async (a: Row) => {
    if (!window.confirm(`Desconectar ${a.nome}? O app deixa de receber avisos.`)) return;
    const { error } = await supabase.from("app_connections").delete().eq("id", a.id);
    if (error) toast(errorMessage(error), "error"); else { toast("App desconectado"); await apps.reload(); }
  };
  const toggleAtivo = async (a: Row) => {
    const { error } = await supabase.from("app_connections").update({ ativo: !a.ativo }).eq("id", a.id);
    if (error) toast(errorMessage(error), "error"); else await apps.reload();
  };

  return (
    <Panel kicker="Seus apps" title={`Apps próprios${company ? ` da ${company.nome}` : ""}`}
      actions={canEdit && company ? <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Conectar app</button> : undefined}>
      <p className="muted small" style={{ marginBottom: 12 }}>Conecte o CRM, a automação ou qualquer sistema da empresa. O MarketTrace avisa o app na hora em que um post é agendado ou publicado, uma tarefa é concluída, uma campanha muda ou uma venda é registrada.</p>
      {!company ? <EmptyState title="Selecione uma empresa" />
        : !canEdit ? <Notice>Só editores e o dono(a) da conta conectam apps.</Notice>
        : apps.loading ? <Loading />
        : apps.rows.length ? (
          <div className="stack">{apps.rows.map((a) => (
            <div className="app-card" key={a.id}>
              <div className="app-card-head">
                <div><strong>{a.nome}</strong> <Badge tone="info">{tipoLabel(a.tipo)}</Badge> {a.ativo ? <Badge tone="ok">Ativo</Badge> : <Badge>Pausado</Badge>}
                  <small className="muted app-url">{a.url}</small>
                  <small className="muted">{(a.eventos as string[]).length} evento(s): {(a.eventos as string[]).join(", ")}</small></div>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => test(a)} disabled={!a.ativo}><Send size={14} /> Enviar teste</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setLog(a)}><History size={14} /> Histórico</button>
                  <button className="icon-btn" title="Editar" onClick={() => setEditing(a)}><Pencil size={15} /></button>
                  <button className="icon-btn danger" title="Desconectar" onClick={() => remove(a)}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="app-card-foot">
                <label className="check"><input type="checkbox" checked={a.ativo} onChange={() => toggleAtivo(a)} /> Enviar avisos</label>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Esconder chave e instruções" : "Chave e instruções para o time técnico"}</button>
              </div>
              {open === a.id && <HowTo app={a} />}
            </div>
          ))}</div>
        ) : <EmptyState title="Nenhum app conectado" text="Cadastre o endereço de webhook do seu CRM ou automação para começar." />}
      {editing && <AppModal initial={editing} onClose={() => setEditing(null)} onSaved={async (row) => { const novo = !editing.id; setEditing(null); await apps.reload(); toast(novo ? "App conectado. Copie a chave secreta para o time técnico." : "Conexão atualizada"); if (novo) setOpen(row.id); }} />}
      {log && <LogModal app={log} onClose={() => setLog(null)} />}
    </Panel>
  );
}
