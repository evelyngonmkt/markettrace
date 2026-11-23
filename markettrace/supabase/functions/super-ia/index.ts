// =====================================================================
// MarketTrace · Super IA (Edge Function do Supabase, nome: super-ia)
// Recebe a pergunta do app, confere acesso e cota, chama o provedor
// configurado no backoffice e grava a conversa. A chave nunca sai daqui.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Msg = { role: "user" | "assistant"; content: string };
type Fonte = { titulo: string; url: string };
type Resposta = { texto: string; fontes: Fonte[] };

const SISTEMA = (empresa: string) => `Você é a Super IA do MarketTrace: estrategista sênior de marketing (digital, serviços, campanhas, ações de trade e eventos, conteúdo e mídia paga).
Responda sempre em português do Brasil, de forma objetiva e prática, com passos que a equipe consiga executar.
${empresa}
Regras:
- Nunca invente números, dados de mercado, resultados ou fatos. Se não souber ou não tiver fonte, diga e sugira como descobrir.
- Ao falar de tendências e assuntos do momento, use a pesquisa na web quando disponível e cite as fontes.
- Ao sugerir posts, traga: formato (Reels, carrossel, stories…), gancho inicial, roteiro ou estrutura, legenda curta e chamada para ação.
- Ao planejar campanhas, traga objetivo, público, mensagem, canais, cronograma, verba sugerida em faixas e indicadores (ROAS, CPA, CPL, CTR).
- Use listas curtas e títulos simples. Sem rodeios.`;

async function chamarAnthropic(chave: string, modelo: string, sistema: string, msgs: Msg[], web: boolean): Promise<Resposta> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: modelo, max_tokens: 2000, system: sistema, messages: msgs,
      ...(web ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message ?? `Erro ${r.status} no provedor`);
  const fontes: Fonte[] = [];
  let texto = "";
  for (const b of d.content ?? []) {
    if (b.type === "text") {
      texto += b.text;
      for (const c of b.citations ?? []) if (c.url) fontes.push({ titulo: c.title ?? c.url, url: c.url });
    }
  }
  return { texto: texto.trim(), fontes };
}

async function chamarOpenAI(chave: string, modelo: string, sistema: string, msgs: Msg[], web: boolean): Promise<Resposta> {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify({ model: modelo, instructions: sistema, input: msgs, ...(web ? { tools: [{ type: "web_search" }] } : {}) }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message ?? `Erro ${r.status} no provedor`);
  const fontes: Fonte[] = [];
  let texto = "";
  for (const item of d.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text") {
        texto += c.text;
        for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) fontes.push({ titulo: a.title ?? a.url, url: a.url });
      }
    }
  }
  return { texto: texto.trim(), fontes };
}

async function chamarGemini(chave: string, modelo: string, sistema: string, msgs: Msg[], web: boolean): Promise<Resposta> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": chave, "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sistema }] },
      contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      ...(web ? { tools: [{ google_search: {} }] } : {}),
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message ?? `Erro ${r.status} no provedor`);
  const cand = d.candidates?.[0];
  const texto = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  const fontes: Fonte[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .filter((c: { web?: { uri?: string } }) => c.web?.uri)
    .map((c: { web: { uri: string; title?: string } }) => ({ titulo: c.web.title ?? c.web.uri, url: c.web.uri }));
  return { texto, fontes };
}

const PROVEDORES = { anthropic: chamarAnthropic, openai: chamarOpenAI, gemini: chamarGemini };

// chaves do projeto: formato antigo (anon/service_role) ou novo (publishable/secret)
function chaveProjeto(antiga: string, nova: string) {
  const v = Deno.env.get(antiga);
  if (v) return v;
  try { const o = JSON.parse(Deno.env.get(nova) ?? "{}"); return (o.default ?? Object.values(o)[0]) as string; } catch { return Deno.env.get(nova) ?? ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const usuario = createClient(url, chaveProjeto("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, chaveProjeto("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"));

    const { data: u } = await usuario.auth.getUser();
    if (!u?.user) return json({ erro: "Entre na sua conta para usar a Super IA." }, 401);

    const body = await req.json().catch(() => ({}));
    const { data: cfg } = await admin.from("ai_settings").select("*").eq("id", 1).single();

    // teste de conexão do backoffice
    if (body.teste) {
      const { data: perfil } = await admin.from("profiles").select("is_super_admin").eq("id", u.user.id).single();
      if (!perfil?.is_super_admin) return json({ erro: "Só a administração pode testar." }, 403);
      if (!cfg?.chave) return json({ erro: "Nenhuma chave cadastrada." }, 400);
      const r = await PROVEDORES[cfg.provedor as keyof typeof PROVEDORES](cfg.chave, cfg.modelo, "Responda apenas: OK", [{ role: "user", content: "Teste de conexão." }], false);
      return json({ ok: true, resposta: r.texto.slice(0, 200) });
    }

    const mensagem = String(body.mensagem ?? "").trim().slice(0, 4000);
    const companyId = String(body.company_id ?? "");
    if (!mensagem) return json({ erro: "Escreva sua pergunta." }, 400);
    if (!cfg?.ativo || !cfg.chave) return json({ erro: "A Super IA ainda não foi ativada." }, 503);

    // acesso à empresa (regras do próprio banco, com o login da pessoa)
    const { data: empresa } = await usuario.from("companies").select("id, account_id, nome, segmento, site, instagram").eq("id", companyId).maybeSingle();
    if (!empresa) return json({ erro: "Você não tem acesso a esta empresa." }, 403);

    const { data: cota } = await usuario.rpc("ai_quota", { p_account: empresa.account_id }).single();
    const q = cota as { usadas: number; limite: number | null } | null;
    if (q && q.limite !== null && q.usadas >= q.limite) {
      return json({ erro: q.limite === 0 ? "O plano da sua conta não inclui a Super IA." : `Sua conta usou as ${q.limite} mensagens de IA deste mês. Fale com o suporte para ampliar.` }, 429);
    }

    const { data: marca } = await admin.from("brand_profiles").select("ramo, publico_alvo, objetivos, tensao, conteudos").eq("company_id", empresa.id).maybeSingle();
    const contexto = [
      `Empresa: ${empresa.nome}${empresa.segmento ? ` (segmento: ${empresa.segmento})` : ""}.`,
      empresa.site ? `Site: ${empresa.site}.` : "", empresa.instagram ? `Instagram: ${empresa.instagram}.` : "",
      marca?.ramo ? `Ramo: ${marca.ramo}.` : "", marca?.publico_alvo ? `Público-alvo: ${marca.publico_alvo}.` : "",
      marca?.objetivos?.length ? `Objetivos: ${marca.objetivos.join(", ")}.` : "",
      marca?.tensao ? `Tensão/dor do público: ${marca.tensao}.` : "", marca?.conteudos ? `Linha de conteúdo: ${marca.conteudos}.` : "",
    ].filter(Boolean).join(" ");

    const historico: Msg[] = (Array.isArray(body.historico) ? body.historico : [])
      .filter((m: Msg) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8).map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const msgs: Msg[] = [...historico, { role: "user", content: mensagem }];

    const r = await PROVEDORES[cfg.provedor as keyof typeof PROVEDORES](cfg.chave, cfg.modelo, SISTEMA(contexto), msgs, cfg.pesquisa_web);
    const fontes = r.fontes.filter((f, i, a) => a.findIndex((x) => x.url === f.url) === i).slice(0, 8);

    await admin.from("ai_messages").insert({
      account_id: empresa.account_id, company_id: empresa.id, user_id: u.user.id,
      pergunta: mensagem, resposta: r.texto, fontes, provedor: cfg.provedor, modelo: cfg.modelo,
    });
    return json({ resposta: r.texto, fontes, usadas: (q?.usadas ?? 0) + 1, limite: q?.limite ?? null });
  } catch (e) {
    return json({ erro: `Não foi possível responder agora: ${(e as Error).message}` }, 502);
  }
});
