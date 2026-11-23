import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Download, Send, Share, Smartphone, SquarePlus } from "lucide-react";
import { Badge, Notice, PageHeader, Panel, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows } from "../lib/data";
import { currentSubscription, disablePush, enablePush, pushSupported, useInstall } from "../lib/pwa";
import { errorMessage, supabase } from "../lib/supabase";

/** Bloco de instalação do app (usado no app e no site) */
export function InstallBlock({ compact = false }: { compact?: boolean }) {
  const { canPrompt, installed, ios, install } = useInstall();
  if (installed) return <p className="device-ok"><CheckCircle2 size={16} /> Você está usando o app instalado.</p>;
  if (canPrompt) return <button className={`btn btn-primary ${compact ? "btn-sm" : ""}`} onClick={() => void install()}><Download size={16} /> Instalar o app</button>;
  if (ios) return (
    <ol className="device-steps">
      <li><Share size={15} /> No Safari, toque em <strong>Compartilhar</strong></li>
      <li><SquarePlus size={15} /> Escolha <strong>Adicionar à Tela de Início</strong></li>
      <li><Smartphone size={15} /> Abra o MarketTrace pelo ícone novo</li>
    </ol>
  );
  return <p className="muted small">No celular, abra <strong>markettrace-pi.vercel.app</strong> no Chrome (Android) ou no Safari (iPhone) e toque em <strong>Instalar app</strong> ou <strong>Adicionar à Tela de Início</strong>. No computador, use o ícone de instalar na barra de endereço do Chrome ou do Edge.</p>;
}

export default function Device() {
  const { companies, profile } = useAuth();
  const toast = useToast();
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const prefs = useRows({ table: "notification_prefs", order: ["company_id"] });
  const bloqueado = typeof Notification !== "undefined" && Notification.permission === "denied";

  useEffect(() => { currentSubscription().then((s) => setLigado(!!s)).catch(() => setLigado(false)); }, []);

  const ligar = async () => {
    setBusy(true); setErro("");
    const r = await enablePush();
    setBusy(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível ativar.");
    setLigado(true); toast("Notificações ativadas neste aparelho");
  };
  const desligar = async () => { setBusy(true); await disablePush(); setBusy(false); setLigado(false); toast("Notificações desligadas neste aparelho"); };
  const teste = async () => {
    setBusy(true); setErro("");
    const { data, error } = await supabase.functions.invoke("notificar", { body: { teste: true } });
    setBusy(false);
    const e = data?.erro ?? (error ? await (error as { context?: Response }).context?.json?.().then((j: { erro?: string }) => j.erro).catch(() => null) ?? errorMessage(error) : null);
    if (e) setErro(e); else toast(data?.enviados ? "Notificação de teste enviada" : "Nenhum aparelho com notificações ligadas");
  };
  const valor = (cid: string, campo: "hora_publicar" | "tarefas_hoje") => {
    const p = prefs.rows.find((r) => r.company_id === cid);
    return p ? p[campo] !== false : true;
  };
  const trocar = async (cid: string, campo: "hora_publicar" | "tarefas_hoje", v: boolean) => {
    const atual = { hora_publicar: valor(cid, "hora_publicar"), tarefas_hoje: valor(cid, "tarefas_hoje"), [campo]: v };
    const { error } = await supabase.from("notification_prefs").upsert({ user_id: profile!.id, company_id: cid, ...atual });
    if (error) toast(errorMessage(error), "error"); else await prefs.reload();
  };

  return (
    <>
      <PageHeader kicker="Conta" title="App e notificações" text="Instale o MarketTrace no celular e receba os avisos das suas empresas: hora de publicar, tarefas do dia e respostas do suporte." />
      <div className="grid-2-even">
        <Panel title="App no celular">
          <div className="stack">
            <p className="muted">Fica com ícone na tela inicial, abre em tela cheia e recebe notificações, como um aplicativo.</p>
            <InstallBlock />
          </div>
        </Panel>
        <Panel title="Notificações neste aparelho">
          <div className="stack">
            {!pushSupported() ? <Notice>Este navegador não recebe notificações. No iPhone, instale o app pela Tela de Início e ative por lá.</Notice>
              : bloqueado ? <Notice tone="warn">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.</Notice>
              : (
                <div className="device-row">
                  {ligado ? <Badge tone="ok">Ligadas</Badge> : <Badge>Desligadas</Badge>}
                  {ligado
                    ? <><button className="btn btn-ghost btn-sm" onClick={teste} disabled={busy}><Send size={14} /> Enviar teste</button><button className="btn btn-ghost btn-sm" onClick={desligar} disabled={busy}><BellOff size={14} /> Desligar</button></>
                    : <button className="btn btn-primary btn-sm" onClick={ligar} disabled={busy || ligado === null}><Bell size={14} /> Ativar notificações</button>}
                </div>
              )}
            <Notice tone="error">{erro}</Notice>
            <small className="muted">Ative em cada aparelho que quiser usar: celular, notebook e computador do trabalho.</small>
          </div>
        </Panel>
      </div>
      <Panel title="O que receber de cada empresa" className="mt">
        {companies.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Empresa</th><th>Hora de publicar</th><th>Tarefas do dia</th></tr></thead>
            <tbody>{companies.filter((c) => c.ativa).map((c) => (
              <tr key={c.id}>
                <td data-label="Empresa"><strong>{c.nome}</strong></td>
                <td data-label="Hora de publicar"><label className="check"><input type="checkbox" checked={valor(c.id, "hora_publicar")} onChange={(e) => trocar(c.id, "hora_publicar", e.target.checked)} /> Avisar quando um post agendado chegar na hora</label></td>
                <td data-label="Tarefas do dia"><label className="check"><input type="checkbox" checked={valor(c.id, "tarefas_hoje")} onChange={(e) => trocar(c.id, "tarefas_hoje", e.target.checked)} /> Resumo às 9h com as tarefas que vencem hoje</label></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">Cadastre uma empresa para escolher os avisos.</p>}
        <p className="muted small" style={{ marginTop: 10 }}>As respostas do suporte chegam sempre que suas notificações estiverem ligadas.</p>
      </Panel>
    </>
  );
}
