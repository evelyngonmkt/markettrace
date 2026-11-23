import { useEffect, useState } from "react";
import { KeyRound, PlugZap, Trash2 } from "lucide-react";
import { Badge, Loading, Notice, PageHeader, Panel, useToast } from "../components/ui";
import { errorMessage, supabase } from "../lib/supabase";
import { dateTime } from "../lib/format";

const PROVEDORES = [
  { value: "anthropic", nome: "Claude", empresa: "Anthropic", modelo: "claude-sonnet-5-5", chave: "https://console.anthropic.com/settings/keys" },
  { value: "openai", nome: "ChatGPT", empresa: "OpenAI", modelo: "gpt-5", chave: "https://platform.openai.com/api-keys" },
  { value: "gemini", nome: "Gemini", empresa: "Google", modelo: "gemini-2.5-flash", chave: "https://aistudio.google.com/app/apikey" },
] as const;

type Status = { provedor: string; modelo: string; configurada: boolean; chave_final: string | null; pesquisa_web: boolean; ativo: boolean; limite_sem_plano: number; mensagens_mes: number; updated_at: string };

export function AdminAI() {
  const toast = useToast();
  const [st, setSt] = useState<Status | null>(null);
  const [f, setF] = useState({ provedor: "anthropic", modelo: "", chave: "", pesquisa_web: true, ativo: false, limite_sem_plano: 20 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_ai_status").single();
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    const s = data as Status;
    setSt(s);
    setF({ provedor: s.provedor, modelo: s.modelo, chave: "", pesquisa_web: s.pesquisa_web, ativo: s.ativo, limite_sem_plano: s.limite_sem_plano });
  };
  useEffect(() => { void load(); }, []);
  if (!st) return msg ? <Notice tone="error">{msg.text}</Notice> : <Loading />;

  const prov = PROVEDORES.find((p) => p.value === f.provedor)!;
  const save = async (remover = false) => {
    if (!remover && !st.configurada && !f.chave.trim() && f.ativo) return setMsg({ tone: "error", text: "Cole a chave do provedor para ativar a IA." });
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("admin_ai_save", {
      p_provedor: f.provedor, p_modelo: f.modelo || prov.modelo, p_chave: f.chave, p_pesquisa_web: f.pesquisa_web,
      p_ativo: remover ? false : f.ativo, p_limite_sem_plano: f.limite_sem_plano, p_remover_chave: remover,
    });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    toast(remover ? "Chave removida" : "Configuração salva");
    await load();
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("super-ia", { body: { teste: true } });
    setBusy(false);
    const erro = data?.erro ?? (error ? await (error as { context?: Response }).context?.json?.().then((j: { erro?: string }) => j.erro).catch(() => null) ?? error.message : null);
    if (erro) setMsg({ tone: "error", text: /Failed to send|FunctionsFetchError|not found|404/i.test(erro) ? "A função “super-ia” ainda não está publicada no Supabase." : erro });
    else setMsg({ tone: "ok", text: `Conexão funcionando. Resposta do provedor: “${data?.resposta ?? "OK"}”` });
  };

  const situacao = !st.configurada ? <Badge>Sem chave</Badge> : st.ativo ? <Badge tone="ok">Ativa</Badge> : <Badge tone="warn">Desligada</Badge>;

  return (
    <>
      <PageHeader kicker="Configuração" title="Inteligência artificial"
        text="Escolha o provedor, cole a chave e ative. A chave fica guardada só no servidor: depois de salva, ninguém consegue vê-la pelo site." />

      <div className="ai-status">
        <div><span className="data-label">Situação</span>{situacao}</div>
        <div><span className="data-label">Provedor</span><strong>{PROVEDORES.find((p) => p.value === st.provedor)?.nome}</strong><small className="muted">{st.modelo}</small></div>
        <div><span className="data-label">Chave</span><strong>{st.configurada ? `•••• ${st.chave_final}` : "—"}</strong></div>
        <div><span className="data-label">Mensagens neste mês</span><strong>{st.mensagens_mes}</strong></div>
      </div>

      <Panel title="Configurar" className="mt">
        <div className="form-stack">
          <div className="field"><span>Provedor</span>
            <div className="ai-prov">
              {PROVEDORES.map((p) => (
                <label key={p.value} className={f.provedor === p.value ? "active" : ""}>
                  <input type="radio" name="prov" checked={f.provedor === p.value} onChange={() => setF({ ...f, provedor: p.value, modelo: p.modelo, chave: "" })} />
                  <strong>{p.nome}</strong><small>{p.empresa}</small>
                </label>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <label className="field half"><span>Modelo</span><input value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} placeholder={prov.modelo} />
              <small>Sugestão: {prov.modelo}. Confira o nome exato no site do provedor.</small></label>
            <label className="field half"><span>Chave da API</span>
              <input type="password" autoComplete="off" value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value })}
                placeholder={st.configurada && st.provedor === f.provedor ? `Em branco = manter •••• ${st.chave_final}` : "Cole a chave aqui"} />
              <small><a href={prov.chave} target="_blank" rel="noreferrer">Onde pegar a chave do {prov.nome}</a></small></label>
            <label className="field half"><span>Mensagens por mês para contas sem plano</span><input type="number" min={0} value={f.limite_sem_plano} onChange={(e) => setF({ ...f, limite_sem_plano: Number(e.target.value) })} />
              <small>Contas com plano seguem o limite do plano (em Planos). Contas ilimitadas não têm limite.</small></label>
            <div className="field half" style={{ justifyContent: "center", gap: 10 }}>
              <label className="check"><input type="checkbox" checked={f.pesquisa_web} onChange={(e) => setF({ ...f, pesquisa_web: e.target.checked })} /> Pesquisar na web (assuntos do momento, com fontes)</label>
              <label className="check"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> IA ativa para os clientes</label>
            </div>
          </div>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-primary" onClick={() => save()} disabled={busy}><KeyRound size={15} /> Salvar</button>
            <button className="btn btn-ghost" onClick={test} disabled={busy || !st.configurada}><PlugZap size={15} /> Testar conexão</button>
            {st.configurada && <button className="btn btn-danger" onClick={() => window.confirm("Remover a chave? A IA fica desligada.") && save(true)} disabled={busy}><Trash2 size={15} /> Remover chave</button>}
          </div>
          <small className="muted">Última alteração: {dateTime(st.updated_at)}. O custo de cada mensagem é cobrado pelo provedor na sua conta dele.</small>
        </div>
      </Panel>
    </>
  );
}
