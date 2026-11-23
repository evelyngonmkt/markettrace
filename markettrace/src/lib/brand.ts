/* =====================================================================
   Identidade visual por empresa: cores, fontes e contraste automático
   ===================================================================== */

export type FontCat = "Sem serifa" | "Com serifa" | "Display" | "Manuscrita" | "Sistema";
export type FontDef = { name: string; cat: FontCat; weights?: string };

/** Fontes oferecidas. As do Google Fonts carregam só quando alguém usa. */
export const FONTS: FontDef[] = [
  // padrão MarketTrace
  { name: "Bricolage Grotesque", cat: "Sem serifa", weights: "400;600;700;800" },
  { name: "Instrument Sans", cat: "Sem serifa", weights: "400;500;600;700" },
  // sem serifa mais usadas no mundo
  { name: "Inter", cat: "Sem serifa", weights: "400;500;600;700" },
  { name: "Roboto", cat: "Sem serifa", weights: "400;500;700" },
  { name: "Open Sans", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Montserrat", cat: "Sem serifa", weights: "400;600;700;800" },
  { name: "Poppins", cat: "Sem serifa", weights: "400;500;600;700" },
  { name: "Lato", cat: "Sem serifa", weights: "400;700;900" },
  { name: "Nunito", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Raleway", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Noto Sans", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Source Sans 3", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Work Sans", cat: "Sem serifa", weights: "400;500;600;700" },
  { name: "DM Sans", cat: "Sem serifa", weights: "400;500;700" },
  { name: "Rubik", cat: "Sem serifa", weights: "400;500;700" },
  { name: "Ubuntu", cat: "Sem serifa", weights: "400;500;700" },
  { name: "Fira Sans", cat: "Sem serifa", weights: "400;600;700" },
  { name: "IBM Plex Sans", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Manrope", cat: "Sem serifa", weights: "400;600;700;800" },
  { name: "Outfit", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Sora", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Space Grotesk", cat: "Sem serifa", weights: "400;500;700" },
  { name: "Quicksand", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Josefin Sans", cat: "Sem serifa", weights: "400;600;700" },
  { name: "Archivo", cat: "Sem serifa", weights: "400;600;700;800" },
  // com serifa
  { name: "Playfair Display", cat: "Com serifa", weights: "400;600;700;800" },
  { name: "Merriweather", cat: "Com serifa", weights: "400;700;900" },
  { name: "Lora", cat: "Com serifa", weights: "400;600;700" },
  { name: "PT Serif", cat: "Com serifa", weights: "400;700" },
  { name: "Libre Baskerville", cat: "Com serifa", weights: "400;700" },
  { name: "Cormorant Garamond", cat: "Com serifa", weights: "400;600;700" },
  { name: "EB Garamond", cat: "Com serifa", weights: "400;600;700" },
  { name: "DM Serif Display", cat: "Com serifa", weights: "400" },
  // display (títulos de impacto)
  { name: "Oswald", cat: "Display", weights: "400;500;700" },
  { name: "Bebas Neue", cat: "Display", weights: "400" },
  { name: "Anton", cat: "Display", weights: "400" },
  { name: "Abril Fatface", cat: "Display", weights: "400" },
  { name: "Archivo Black", cat: "Display", weights: "400" },
  // manuscritas
  { name: "Dancing Script", cat: "Manuscrita", weights: "400;600;700" },
  { name: "Pacifico", cat: "Manuscrita", weights: "400" },
  { name: "Caveat", cat: "Manuscrita", weights: "400;600;700" },
  { name: "Great Vibes", cat: "Manuscrita", weights: "400" },
  { name: "Satisfy", cat: "Manuscrita", weights: "400" },
  // já instaladas nos computadores (não precisam carregar)
  { name: "Arial", cat: "Sistema" },
  { name: "Helvetica", cat: "Sistema" },
  { name: "Verdana", cat: "Sistema" },
  { name: "Trebuchet MS", cat: "Sistema" },
  { name: "Georgia", cat: "Sistema" },
  { name: "Times New Roman", cat: "Sistema" },
];

export const FONT_CATS: FontCat[] = ["Sem serifa", "Com serifa", "Display", "Manuscrita", "Sistema"];
/** categorias boas para texto corrido (manuscritas e display cansam a leitura) */
export const TEXT_CATS: FontCat[] = ["Sem serifa", "Com serifa", "Sistema"];

export const BRAND_DEFAULT = {
  destaque: "#A866FF",
  apoio: "#2F6B78",
  titulos: "Bricolage Grotesque",
  texto: "Instrument Sans",
};

// superfícies do app usadas no cálculo de contraste
const SURFACE_LIGHT = "#FBF9F4";
const SURFACE_DARK = "#17231F";
const TINTA = "#14201C";

const findFont = (name?: string | null) => FONTS.find((f) => f.name === name);

export function fontStack(name?: string | null, fallbackCat: FontCat = "Sem serifa"): string {
  const f = findFont(name);
  const cat = f?.cat ?? fallbackCat;
  const tail = cat === "Com serifa" ? "Georgia, serif" : cat === "Manuscrita" ? "cursive" : "Arial, sans-serif";
  return name ? `"${name}", ${tail}` : tail;
}

const loaded = new Set<string>();
/** Carrega fontes do Google Fonts (uma única folha de estilo por chamada) */
export function loadFonts(names: Array<string | null | undefined>) {
  const fams = names
    .map((n) => findFont(n))
    .filter((f): f is FontDef => !!f && !!f.weights && !loaded.has(f.name));
  if (!fams.length || typeof document === "undefined") return;
  fams.forEach((f) => loaded.add(f.name));
  const q = fams.map((f) => `family=${encodeURIComponent(f.name).replace(/%20/g, "+")}:wght@${f.weights}`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
  document.head.appendChild(link);
}

/* ---------- cores ---------- */
export const isHex = (v?: string | null): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
/** aceita #RGB, #RRGGBB, RRGGBB e rgb(r, g, b) */
export function normalizeColor(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^#?([0-9a-f]{6})$/i);
  if (m) return `#${m[1].toUpperCase()}`;
  m = s.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
  m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

function channel(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
export function luminance(hex: string) { const [r, g, b] = hexToRgb(hex); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); }
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function mix(hex: string, target: string, t: number) {
  const [a, b] = [hexToRgb(hex), hexToRgb(target)];
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
/** Escurece (fundo claro) ou clareia (fundo escuro) a cor até atingir o contraste mínimo */
export function readableOn(hex: string, bg: string, min = 4.5) {
  if (contrast(hex, bg) >= min) return hex.toUpperCase();
  const toward = luminance(bg) > 0.5 ? "#000000" : "#FFFFFF";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(hex, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}
/** Cor do texto em cima da cor de destaque (botões): Tinta ou branco, o que ler melhor */
export const textOn = (hex: string) => (contrast(hex, TINTA) >= contrast(hex, "#FFFFFF") ? TINTA : "#FFFFFF");

export type BrandInput = { cor_destaque?: string | null; cor_apoio?: string | null; fonte_titulos?: string | null; fonte_texto?: string | null; usar_identidade?: boolean | null };

/** Variáveis CSS calculadas para uma identidade (usadas no app e na pré-visualização) */
export function brandVars(b: BrandInput): Record<string, string> {
  const destaque = isHex(b.cor_destaque) ? b.cor_destaque : BRAND_DEFAULT.destaque;
  const apoio = isHex(b.cor_apoio) ? b.cor_apoio : BRAND_DEFAULT.apoio;
  return {
    "--sinal": destaque,
    "--on-sinal": textOn(destaque),
    "--brand-txt-l": readableOn(destaque, SURFACE_LIGHT),
    "--brand-txt-d": readableOn(destaque, SURFACE_DARK),
    "--mare": readableOn(apoio, SURFACE_LIGHT),
    "--brand-apoio-d": readableOn(apoio, SURFACE_DARK),
    "--f-display": fontStack(b.fonte_titulos || BRAND_DEFAULT.titulos),
    "--f-text": fontStack(b.fonte_texto || BRAND_DEFAULT.texto),
  };
}

export function contrastReport(b: BrandInput) {
  const destaque = isHex(b.cor_destaque) ? b.cor_destaque : BRAND_DEFAULT.destaque;
  const v = brandVars(b);
  return {
    botao: contrast(destaque, v["--on-sinal"]),
    textoClaro: contrast(v["--brand-txt-l"], SURFACE_LIGHT),
    ajustado: v["--brand-txt-l"].toUpperCase() !== destaque.toUpperCase() || v["--brand-txt-d"].toUpperCase() !== destaque.toUpperCase(),
  };
}

/** Aplica a identidade da empresa no documento inteiro; devolve a função que desfaz */
export function applyBrand(b: BrandInput | null) {
  const root = document.documentElement;
  if (!b || b.usar_identidade === false) return () => undefined;
  const vars = brandVars(b);
  loadFonts([b.fonte_titulos, b.fonte_texto]);
  Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));
  root.classList.add("branded");
  return () => {
    Object.keys(vars).forEach((k) => root.style.removeProperty(k));
    root.classList.remove("branded");
  };
}
