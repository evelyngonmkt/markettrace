import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import { EmptyState, Loading, PageHeader, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { errorMessage, supabase } from "../lib/supabase";
import { Markdown } from "../lib/md";

type Fonte = { titulo: string; url: string };
type Turno = { id?: number; pergunta: string; resposta?: string; fontes?: Fonte[]; erro?: string; pendente?: boolean };

const ATALHOS = [
  "Me dê 5 ideias de posts para esta semana, com formato e gancho",
  "Quais assuntos estão em alta agora no meu segmento?",
  "Monte um plano de campanha de 30 dias para gerar leads",
  "Sugira uma ação de marketing para a próxima data comemorativa",
  "Como melhorar meu ROAS nas campanhas de Meta Ads?",
  "Crie um calendário editorial do mês para o Instagram",
];

export default function SuperIA() {
  const { company, account } = useAuth();
  const toast = useToast();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [quota, setQuota] = useState<{ disponivel: boolean; usadas: number; limite: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const fim = useRef<HTMLDivElement>(null);
  const enviando = turnos.some((t) => t.pendente);

  useEffect(() => {
    if (!company || !account) return;
    setLoading(true);
    Promise.all([
      supabase.rpc("ai_quota", { p_account: account.id }).single(),
      supabase.from("ai_messages").select("id, pergunta, resposta, fontes").eq("company_id", company.id).order("created_at", { ascending: false }).limit(12),
    ]).then(([q, h]) => {
      setQuota((q.data as typeof quota) ?? { disponivel: false, usadas: 0, limite: 0 });
      setTurnos(((h.data ?? []) as Turno[]).reverse());
      setLoading(false);
    });
  }, [company?.id, account?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turnos.length, enviando]);

  if (!company) return <EmptyState title="Selecione uma empresa" />;
  if (loading) return <Loading />;

  const esgotou = quota?.limite != null && quota.usadas >= quota.limite;
  const enviar = async (pergunta: string) => {
    const p = pergunta.trim();
    if (!p || enviando) return;
    setTexto("");
    const historico = turnos.filter((t) => t.resposta).slice(-4).flatMap((t) => [{ role: "user", content: t.pergunta }, { role: "assistant", content: t.resposta! }]);
    setTurnos((ts) => [...ts, { pergunta: p, pendente: true }]);
    const { data, error } = await supabase.functions.invoke("super-ia", { body: { company_id: company.id, mensagem: p, historico } });
    let erro: string | null = data?.erro ?? null;
    if (!erro && error) erro = await (error as { context?: Response }).context?.json?.().then((j: { erro?: string }) => j.erro ?? null).catch(() => null) ?? errorMessage(error);
    setTurnos((ts) => ts.map((t, i) => (i === ts.length - 1 ? { pergunta: p, resposta: data?.resposta, fontes: data?.fontes ?? [], erro: erro ?? undefined } : t)));
    if (!erro && data) setQuota((q) => (q ? { ...q, usadas: data.usadas ?? q.usadas + 1 } : q));
  };
  const limpar = async () => {
    if (!window.confirm("Apagar suas conversas com a Super IA nesta empresa?")) return;
    const { error } = await supabase.from("ai_messages").delete().eq("company_id", company.id);
    if (error) toast(errorMessage(error), "error"); else setTurnos([]);
  };

  return (
    <>
      <PageHeader kicker="Inteligência" title="Super IA"
        text={`Especialista em marketing digital, serviços, campanhas e ações, já sabendo quem é a ${company.nome}. Pede ideias de posts, assuntos do momento no seu segmento, planos de campanha e análises.`}
        actions={turnos.length > 0 && <button className="btn btn-ghost btn-sm" onClick={limpar}><Trash2 size={14} /> Limpar conversa</button>} />

      {!quota?.disponivel ? (
        <EmptyState title="A Super IA está chegando" text="Ela ainda está sendo ativada pela equipe MarketTrace. Assim que estiver no ar, aparece aqui." />
      ) : (
        <div className="ia">
          <div className="ia-chat">
            {turnos.length === 0 && (
              <div className="ia-hello">
                <span className="ia-badge"><Sparkles size={18} /></span>
                <h2>Por onde começamos?</h2>
                <div className="ia-shortcuts">{ATALHOS.map((a) => <button key={a} onClick={() => enviar(a)} disabled={esgotou}>{a}</button>)}</div>
              </div>
            )}
            {turnos.map((t, i) => (
              <div key={t.id ?? `n${i}`} className="ia-turn">
                <div className="ia-q">{t.pergunta}</div>
                <div className="ia-a">
                  <span className="ia-badge sm"><Sparkles size={14} /></span>
                  <div>
                    {t.pendente ? <p className="muted"><Loader2 size={15} className="spin" /> Pensando{quota.disponivel ? " e pesquisando" : ""}…</p>
                      : t.erro ? <p className="ia-err">{t.erro}</p>
                      : <Markdown text={t.resposta ?? ""} />}
                    {!!t.fontes?.length && (
                      <div className="ia-sources"><span className="data-label">Fontes</span>
                        {t.fontes.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {f.titulo}</a>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={fim} />
          </div>
          <form className="ia-input" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
            <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={esgotou}
              placeholder={esgotou ? "Limite de mensagens do mês atingido." : "Pergunte qualquer coisa sobre o marketing da empresa…"}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }} />
            <button className="btn btn-primary" disabled={!texto.trim() || enviando || esgotou} aria-label="Enviar"><ArrowUp size={18} /></button>
          </form>
          <p className="muted small ia-foot">
            {quota.limite == null ? "Uso sem limite nesta conta." : `${quota.usadas} de ${quota.limite} mensagens usadas neste mês.`} A IA pode errar: confira números e fontes antes de publicar.
          </p>
        </div>
      )}
    </>
  );
}
