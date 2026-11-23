/* =====================================================================
   Calendário em formato .ics (abre no Google Agenda, Outlook e Apple)
   ===================================================================== */
export type CalEvent = { uid: string; start: Date; end?: Date; title: string; description?: string; url?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

// linhas de no máximo 75 bytes, como pede o padrão
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(name: string, events: CalEvent[]) {
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MarketTrace//Agenda editorial//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
  ];
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + 30 * 60000);
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@markettrace`, `DTSTAMP:${now}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Link que abre o Google Agenda já com o evento preenchido (a pessoa só confirma) */
export function googleCalendarUrl(e: CalEvent) {
  const end = e.end ?? new Date(e.start.getTime() + 30 * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(end)}`, details: [e.description, e.url].filter(Boolean).join("\n\n") });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
