import { useEffect, useState } from "react";
import { configured, supabase } from "./supabase";

export type PortfolioItem = { titulo: string; descricao?: string; link?: string; imagem_url?: string };
export type SiteSettings = {
  hero_titulo: string;
  hero_subtitulo: string;
  contato_nome: string;
  contato_cargo: string;
  contato_email: string;
  contato_whatsapp: string;
  contato_whatsapp_link: string;
  contato_instagram: string;
  contato_linkedin: string;
  portfolio_link: string;
  portfolio: PortfolioItem[];
};

// Valores usados enquanto o banco carrega (os mesmos do script do banco)
export const DEFAULT_SETTINGS: SiteSettings = {
  hero_titulo: "Do dado à decisão.",
  hero_subtitulo:
    "Pesquisa, conteúdo, mídia, orçamento e indicadores no mesmo fluxo de trabalho. Para quem cria, para quem analisa e para quem precisa decidir.",
  contato_nome: "Evelyn Gonçalves",
  contato_cargo: "Profissional de Marketing · idealizadora do MarketTrace",
  contato_email: "evelyngoncalves.marketing@gmail.com",
  contato_whatsapp: "Conversar no WhatsApp",
  contato_whatsapp_link: "https://wa.me/message/QLNPISU2BUG7J1",
  contato_instagram: "@evelyn.namidia",
  contato_linkedin: "https://www.linkedin.com/in/evelyn-goncalves-oficial/",
  portfolio_link: "",
  portfolio: [],
};

let cache: SiteSettings | null = null;

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? DEFAULT_SETTINGS);
  useEffect(() => {
    if (!configured || cache) return;
    supabase.from("site_settings").select("data").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.data) {
        cache = { ...DEFAULT_SETTINGS, ...(data.data as Partial<SiteSettings>) };
        setSettings(cache);
      }
    });
  }, []);
  return settings;
}

export const clearSiteCache = () => { cache = null; };

export const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, "")}`;
