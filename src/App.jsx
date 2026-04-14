import { useState, useEffect } from "react";

const BRAND = `Du är en AI-assistent som hjälper med innehållsproduktion för ett nordiskt VC-bolag fokuserat på AI-infrastruktur.

VARUMÄRKESRÖST:
- Trovärdig, analytisk, självsäker men inte arrogant
- Substans före sensation — alltid
- Skriv som en insider som delar med sig, inte en marknadsförare
- Konkreta data och exempel, undvik fluffiga påståenden

POSITIONERING:
- AI-infrastruktur, AI och VC/PE
- 30%+ netto-IRR per år sedan start, 1 miljard SEK i AUM
- Aktivt ägarskap: styrelsearbete, operativt stöd, strategisk positionering

LINKEDIN-FORMAT:
- Stark öppningshook (första 2 raderna avgör)
- Korta stycken (1-3 meningar)
- Luftigt format med radbrytningar
- Avsluta med fråga eller take-away
- Svenska
- Max 3-5 hashtags i slutet`;

const T = {
  bg: "#0a0a0f", sf: "#12121a", bd: "#1e1e2e",
  ac: "#3b82f6", as: "rgba(59,130,246,0.12)",
  tx: "#e4e4ed", tm: "#8888a0", td: "#55556a",
  ok: "#22c55e", os: "rgba(34,197,94,0.12)",
  wn: "#f59e0b", ws: "rgba(245,158,11,0.12)",
  dn: "#ef4444", ds: "rgba(239,68,68,0.12)",
};
const F = `'SF Pro Display',-apple-system,'Segoe UI',sans-serif`;

const Spin = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ animation: "ks 1s linear infinite" }}>
    <circle cx="12" cy="12" r="10" stroke={T.td} strokeWidth="3" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={T.ac} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// NEWS konfiguration
const PROVIDER = "newsdata";

const SEARCH_QUERIES = [
  "artificial intelligence infrastructure",
  "AI chips GPU datacenter",
  "venture capital",
  "AI regulation policy",
];

async function fetchNews(newsApiKey, extraQueries = []) {
  const allQueries = [...SEARCH_QUERIES, ...extraQueries.filter(q => q.trim())];
  const allArticles = [];
  for (const q of allQueries) {
    const url = `/.netlify/functions/news?provider=${PROVIDER}&apikey=${encodeURIComponent(newsApiKey)}&q=${encodeURIComponent(q)}&language=en`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    let articles = [];
    if (PROVIDER === "newsdata") {
      articles = (data.results || []).map(a => ({
        headline: a.title || "Ingen rubrik",
        source: a.source_name || a.source_id || "Okänd",
        date: a.pubDate ? new Date(a.pubDate).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "Okänt datum",
        rawDate: a.pubDate || "",
        summary: a.description || a.content?.substring(0, 200) || "Ingen beskrivning",
        link: a.link || "",
      }));
    } else if (PROVIDER === "gnews") {
      articles = (data.articles || []).map(a => ({
        headline: a.title || "Ingen rubrik",
        source: a.source?.name || "Okänd",
        date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "Okänt datum",
        rawDate: a.publishedAt || "",
        summary: a.description || a.content?.substring(0, 200) || "Ingen beskrivning",
        link: a.url || "",
      }));
    } else if (PROVIDER === "newsapi") {
      articles = (data.articles || []).map(a => ({
        headline: a.title || "Ingen rubrik",
        source: a.source?.name || "Okänd",
        date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "Okänt datum",
        rawDate: a.publishedAt || "",
        summary: a.description || a.content?.substring(0, 200) || "Ingen beskrivning",
        link: a.url || "",
      }));
    }
    allArticles.push(...articles);
  }
  const seen = new Set();
  return allArticles.filter(a => {
    const key = a.headline.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
}

// ═══ API ═══
async function askClaude(apiKey, prompt, sys) {
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey, model: "claude-sonnet-4-20250514", max_tokens: 2048,
      system: sys || BRAND,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

function parseJSON(raw) {
  const c = raw.replace(/```json|```/g, "").trim();
  const m = c.match(/\[[\s\S]*\]/);
  return m ? JSON.parse(m[0]) : null;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{ background: ok ? T.os : T.sf, color: ok ? T.ok : T.tm, border: `1px solid ${ok ? T.ok : T.bd}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: F }}>
      {ok ? "Kopierad" : "Kopiera"}
    </button>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const [keys, setKeys] = useState(null);
  const [newsKey, setNewsKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [tab, setTab] = useState("scan");
  const [news, setNews] = useState([]);
  const [busy1, setBusy1] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [busy2, setBusy2] = useState(false);
  const [postInput, setPostInput] = useState("");
  const [refIdx, setRefIdx] = useState(null);
  const [refText, setRefText] = useState("");
  const [busy3, setBusy3] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [extraQuery, setExtraQuery] = useState("");
  const [selectedNews, setSelectedNews] = useState([]);
  const [rankFocus, setRankFocus] = useState("");

  // ─── TOPLIST STATE ───
  const [toplistPrompt, setToplistPrompt] = useState("");
  const [toplistResults, setToplistResults] = useState([]);
  const [busy4, setBusy4] = useState(false);
  const [toplistSuggestions, setToplistSuggestions] = useState([]);
  const [busySuggestions, setBusySuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  function doLogin() {
    if (!claudeKey.trim() || !newsKey.trim()) return;
    setKeys({ claude: claudeKey.trim(), news: newsKey.trim() });
  }

  // Auto-load suggestions when switching to toplist tab
  useEffect(() => {
    if (tab === "toplist" && !suggestionsLoaded && keys && !busySuggestions) {
      loadToplistSuggestions();
    }
  }, [tab, suggestionsLoaded, keys]);

  // ─── LOGIN ───
  if (!keys) {
    const pName = PROVIDER === "newsdata" ? "NewsData.io" : PROVIDER === "gnews" ? "GNews" : "NewsAPI.org";
    const pUrl = PROVIDER === "newsdata" ? "https://newsdata.io/" : PROVIDER === "gnews" ? "https://gnews.io/" : "https://newsapi.org/";
    return (
      <div style={{ fontFamily: F, background: T.bg, color: T.tx, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes ks { to { transform: rotate(360deg); } }`}</style>
        <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: 40, maxWidth: 500, width: "100%", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, margin: "0 auto 20px", background: `linear-gradient(135deg, ${T.ac}, #60a5fa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>K</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Content Engine</h1>
          <p style={{ fontSize: 13, color: T.tm, marginBottom: 24, lineHeight: 1.5 }}>{pName} for news + Claude for content</p>
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: T.td, fontWeight: 500, display: "block", marginBottom: 4 }}>{pName} API-nyckel <a href={pUrl} target="_blank" rel="noopener" style={{ color: T.ac, textDecoration: "none" }}>(hämta här)</a></label>
            <input type="password" value={newsKey} onChange={e => setNewsKey(e.target.value)} placeholder={PROVIDER === "newsdata" ? "pub_..." : "API key..."}
              style={{ width: "100%", boxSizing: "border-box", background: T.bg, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: F, outline: "none" }} />
          </div>
          <div style={{ textAlign: "left", marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: T.td, fontWeight: 500, display: "block", marginBottom: 4 }}>Anthropic API-nyckel <a href="https://console.anthropic.com/" target="_blank" rel="noopener" style={{ color: T.ac, textDecoration: "none" }}>(hämta här)</a></label>
            <input type="password" value={claudeKey} onChange={e => setClaudeKey(e.target.value)} placeholder="sk-ant-..." onKeyDown={e => e.key === "Enter" && doLogin()}
              style={{ width: "100%", boxSizing: "border-box", background: T.bg, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: F, outline: "none" }} />
          </div>
          <button onClick={doLogin} disabled={!claudeKey.trim() || !newsKey.trim()}
            style={{ width: "100%", background: claudeKey.trim() && newsKey.trim() ? `linear-gradient(135deg, ${T.ac}, #2563eb)` : T.sf, color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 500, cursor: claudeKey.trim() && newsKey.trim() ? "pointer" : "not-allowed", fontFamily: F, opacity: claudeKey.trim() && newsKey.trim() ? 1 : 0.5 }}>
            Starta
          </button>
          <p style={{ fontSize: 11, color: T.td, marginTop: 14 }}>Proxy-server måste köra (node server.js)</p>
        </div>
      </div>
    );
  }

  // ─── SCAN: Fetch + Claude ranking ───
  async function scanNews() {
    setBusy1(true); setNews([]); setSelectedNews([]); setErr("");
    setStatus("Hämtar nyheter...");
    try {
      const extras = extraQuery.trim() ? extraQuery.split(",").map(q => q.trim()) : [];
      const rawArticles = await fetchNews(keys.news, extras);
      if (rawArticles.length === 0) throw new Error("Inga nyheter hittades. Kontrollera din API-nyckel.");

      setStatus("Rankar nyheter med AI (" + rawArticles.length + " artiklar)...");

      const articleList = rawArticles.slice(0, 25).map((a, i) =>
        `${i + 1}. "${a.headline}" (${a.source}, ${a.date}): ${(a.summary || "").substring(0, 150)}`
      ).join("\n");

      const focusInstruction = rankFocus.trim()
        ? `\n\nEXTRA FOKUS: Prioritera nyheter som handlar om eller relaterar till: "${rankFocus.trim()}"`
        : "";

      const ranked = await askClaude(keys.claude,
        `Här är ${Math.min(rawArticles.length, 25)} nyhetsartiklar. Ranka de 10 viktigaste för ett nordiskt VC-bolag fokuserat på AI-infrastruktur.

Bedöm baserat på:
- Relevans för AI-infrastruktur, AI-modeller, VC/PE
- Strategisk betydelse (inte bara intressant, utan affärspåverkande)
- Aktualitet och nyhetsvärde
- Sensationsaktigt potenial att väcka intresse
- Värdeskapande för läsaren
- Potential som LinkedIn-innehåll${focusInstruction}

ARTIKLAR:
${articleList}

Svara BARA med en JSON-array av artikelnumren i rangordning, viktigast först. Exempel: [3, 7, 1, 12, 5, 8, 2, 15, 9, 4]
Ge exakt 10 nummer (eller färre om det inte finns 10 relevanta). BARA JSON-array med siffror.`,
        "Du är en redaktör för ett nordiskt AI-fokuserat VC-bolag. Ranka nyheter efter strategisk relevans. Svara ENBART med en JSON-array av siffror."
      );

      let rankedIndices;
      try {
        const cleaned = ranked.replace(/```json|```/g, "").trim();
        rankedIndices = JSON.parse(cleaned.match(/\[[\s\S]*\]/)?.[0] || "[]");
      } catch {
        rankedIndices = rawArticles.slice(0, 10).map((_, i) => i + 1);
      }

      const rankedArticles = rankedIndices
        .filter(idx => idx >= 1 && idx <= rawArticles.length)
        .map(idx => rawArticles[idx - 1])
        .filter(Boolean);

      setNews(rankedArticles.length > 0 ? rankedArticles : rawArticles.slice(0, 10));
      setStatus("");
    } catch (e) { setErr(e.message); setStatus(""); }
    setBusy1(false);
  }

  // ─── GENERATE ───
  async function generatePost() {
    if (!postInput.trim()) return;
    setBusy2(true); setErr(""); setStatus("Genererar utkast...");
    const newsCtx = selectedNews.length > 0
      ? `\n\nBASERA PÅ ${selectedNews.length === 1 ? "DENNA NYHET" : "DESSA " + selectedNews.length + " NYHETER"}:\n` + selectedNews.map((n, i) => `${i + 1}. "${n.headline}" (${n.source}, ${n.date})\n${n.summary}`).join("\n\n")
      : "";
    try {
      const r = await askClaude(keys.claude,
        `Generera 3 unika LinkedIn-inläggsutkast baserat på:\n\n"${postInput}"${newsCtx}\n\nRegler:\n- Unik vinkel och hook per utkast\n- Första person\n- Korta stycken, luftigt med radbrytningar\n- Max 3-5 hashtags i slutet\n\nSPRÅKKRAV (KRITISKT):\n- Texten MÅSTE vara grammatiskt perfekt — inga stavfel, inga syftningsfel, inga konstiga meningsbyggnader\n- Använd naturligt, professionellt språk — som en erfaren skribent, inte som en AI\n- Om inlägget är på svenska: korrekt svensk grammatik, rätt böjningar, naturliga formuleringar\n- Om inlägget är på engelska: korrekt engelsk grammatik\n- Läs igenom varje mening och verifiera att den är korrekt innan du inkluderar den\n- Undvik upprepningar, klyschor och generiska AI-formuleringar\n\nSvara BARA med JSON:\n[{"title":"kort titel","body":"hela inlägget","reasoning":"varför denna vinkel"}]`,
        BRAND
      );
      setStatus("");
      const p = parseJSON(r);
      setDrafts(prev => [...prev, ...(p || [{ title: "Utkast", body: r, reasoning: "" }])]);
    } catch (e) { setErr(e.message); setStatus(""); }
    setBusy2(false);
  }

  // ─── REFINE ───
  async function refineDraft(d) {
    if (!refText.trim()) return;
    setBusy3(true); setErr("");
    try {
      const r = await askClaude(keys.claude, `LinkedIn-utkast:\n\n${d.body}\n\nFörfina: "${refText}"\nBehåll tonaliteten. Svara BARA med uppdaterat inlägg.`, BRAND);
      setDrafts(prev => prev.map((x, j) => j === refIdx ? { ...x, body: r, title: x.title + " (förfinad)" } : x));
      setRefIdx(null); setRefText("");
    } catch (e) { setErr(e.message); }
    setBusy3(false);
  }

  // ─── TOPLIST: Load suggestions from Claude ───
  async function loadToplistSuggestions() {
    setBusySuggestions(true);
    try {
      const r = await askClaude(keys.claude,
        `Ge mig exakt 5 aktuella och intressanta toppliste-idéer för LinkedIn-innehåll riktat mot nordiska AI/VC-investerare.

Förslagen ska vara:
- Specifika och tidsaktuella (referera till verkliga trender, bolag, händelser)
- Varierande (mix av bolag, trender, investeringar, teknologi, geografier)
- Engagerande som LinkedIn-innehåll
- Fokuserade på Norden/Europa men kan inkludera globala trender som påverkar regionen

Svara BARA med en JSON-array:
[
  {
    "label": "Kort rubrik med emoji i början (max 8 ord)",
    "prompt": "Fullständig, detaljerad prompt som beskriver exakt vad topplistan ska innehålla (2-3 meningar)"
  }
]

BARA JSON, ingen annan text.`,
        "Du är en redaktör och strateg för ett nordiskt AI-fokuserat VC-bolag. Du följer AI-marknaden, VC-deals och tech-trender i Norden och Europa noga. Svara ENBART med JSON."
      );
      const parsed = parseJSON(r);
      if (parsed && parsed.length > 0) {
        setToplistSuggestions(parsed);
      }
      setSuggestionsLoaded(true);
    } catch (e) { setErr(e.message); }
    setBusySuggestions(false);
  }

  // ─── TOPLIST: Generate ───
  async function generateToplist() {
    if (!toplistPrompt.trim()) return;
    setBusy4(true); setErr(""); setStatus("Genererar topplista...");
    try {
      const r = await askClaude(keys.claude,
        `${toplistPrompt}

Svara BARA med en JSON-array med exakt detta format:
[
  {
    "rank": 1,
    "name": "Bolagsnamn",
    "oneliner": "Kort beskrivning av vad bolaget gör (max 15 ord)",
    "reasoning": "Varför bolaget är med på listan — konkret motivering med data/exempel (2-3 meningar)"
  }
]

Regler:
- Ge exakt 5 bolag/poster om inget annat anges
- Basera på aktuell kunskap — senaste finansieringsrundor, produktlanseringar, nyheter
- Var specifik: nämn belopp, investerare, produkter, kunder där det är relevant
- Nordiskt fokus om inget annat specificeras
- BARA JSON, ingen annan text`,
        "Du är en expert på nordisk tech, AI och venture capital. Du har djup kunskap om AI-ekosystemet i Norden och Europa. Svara ENBART med JSON."
      );
      setStatus("");
      const parsed = parseJSON(r);
      if (parsed && parsed.length > 0) {
        setToplistResults(parsed);
      } else {
        setToplistResults([{ rank: 1, name: "Fel", oneliner: "Kunde inte tolka svaret", reasoning: r }]);
      }
    } catch (e) { setErr(e.message); setStatus(""); }
    setBusy4(false);
  }

  function toplistToText() {
    return toplistResults.map(item =>
      `${item.rank}. ${item.name}\n${item.oneliner}\n${item.reasoning}`
    ).join("\n\n");
  }

  function toplistToLinkedIn() {
    const text = toplistResults.map(item =>
      `${item.rank}. ${item.name} — ${item.oneliner}\n${item.reasoning}`
    ).join("\n\n");
    setPostInput(`Skriv ett LinkedIn-inlägg baserat på denna topplista. Gör det engagerande med en stark hook, personlig vinkel och avsluta med en fråga.\n\nTOPPLISTA:\n${text}`);
    setTab("create");
  }

  const tabStyle = (active) => ({
    background: active ? T.as : "transparent", color: active ? T.ac : T.tm,
    border: `1px solid ${active ? T.ac : "transparent"}`, borderRadius: 8,
    padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: F,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ fontFamily: F, background: T.bg, color: T.tx, minHeight: "100vh" }}>
      <style>{`@keyframes ks { to { transform: rotate(360deg); } }`}</style>

      <div style={{ borderBottom: `1px solid ${T.bd}`, padding: "16px 20px", background: T.sf, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.ac}, #60a5fa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>K</div>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Content Engine</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: T.bg, borderRadius: 10, padding: 3 }}>
          <button onClick={() => setTab("scan")} style={tabStyle(tab === "scan")}>Nyhetsscan</button>
          <button onClick={() => setTab("create")} style={tabStyle(tab === "create")}>Skapa inlägg</button>
          <button onClick={() => setTab("toplist")} style={tabStyle(tab === "toplist")}>Topplistor</button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {err && <div style={{ background: T.ds, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.dn, display: "flex", justifyContent: "space-between" }}><span>{err}</span><button onClick={() => setErr("")} style={{ background: "none", border: "none", color: T.dn, cursor: "pointer", fontSize: 16 }}>x</button></div>}
        {status && <div style={{ background: T.as, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.ac, display: "flex", alignItems: "center", gap: 8 }}><Spin s={14} /> {status}</div>}

        {/* SCAN */}
        {tab === "scan" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Nyhetsbevakning</h2>
            <p style={{ fontSize: 13, color: T.tm, margin: "0 0 16px" }}>Hämtar nyheter och rankar de 10 viktigaste med AI</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: T.td, fontWeight: 500, display: "block", marginBottom: 6 }}>Egna sökord (valfritt, kommaseparerade)</label>
              <input value={extraQuery} onChange={e => setExtraQuery(e.target.value)}
                placeholder="T.ex. NVIDIA datacenter, EU AI Act, quantum computing..."
                style={{ width: "100%", boxSizing: "border-box", background: T.sf, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: F, outline: "none" }} />
              <p style={{ fontSize: 11, color: T.td, marginTop: 4 }}>Standard: AI infrastructure, AI chips/GPU, deep tech VC, AI regulation</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: T.td, fontWeight: 500, display: "block", marginBottom: 6 }}>AI-rankningsfokus (valfritt)</label>
              <input value={rankFocus} onChange={e => setRankFocus(e.target.value)}
                placeholder="T.ex. datacenter-investeringar, halvledarindustrin, nordisk VC..."
                style={{ width: "100%", boxSizing: "border-box", background: T.sf, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: F, outline: "none" }} />
              <p style={{ fontSize: 11, color: T.td, marginTop: 4 }}>Styr vad AI:n prioriterar vid rankning av nyheter</p>
            </div>

            <button onClick={scanNews} disabled={busy1} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: busy1 ? T.sf : `linear-gradient(135deg, ${T.ac}, #2563eb)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: busy1 ? "wait" : "pointer", fontFamily: F, marginBottom: 20 }}>
              {busy1 ? <Spin s={16} /> : null} {busy1 ? "Skannar..." : "Starta nyhetsscan"}
            </button>

            {selectedNews.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: T.ac }}>{selectedNews.length} vald{selectedNews.length > 1 ? "a" : ""}</span>
                <button onClick={() => setSelectedNews([])} style={{ background: "none", border: "none", color: T.dn, fontSize: 12, cursor: "pointer", fontFamily: F }}>Avmarkera alla</button>
              </div>
            )}

            {news.map((n, i) => {
              const isSel = selectedNews.some(s => s.headline === n.headline);
              return (
                <div key={i} onClick={() => setSelectedNews(prev => isSel ? prev.filter(s => s.headline !== n.headline) : [...prev, n])}
                  style={{ background: isSel ? T.as : T.sf, border: `1px solid ${isSel ? T.ac : T.bd}`, borderRadius: 10, padding: 14, marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 11, color: isSel ? T.ac : T.td, background: isSel ? T.as : T.bg, border: `1px solid ${isSel ? T.ac : T.bd}`, borderRadius: 3, padding: "2px 6px", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{isSel ? "VALD" : i + 1}</span>
                      <strong style={{ fontSize: 14, lineHeight: 1.4 }}>{n.headline}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginLeft: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: T.ok, background: T.os, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>{n.date}</span>
                      <span style={{ fontSize: 11, color: T.td, background: T.bg, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>{n.source}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: T.tm, margin: "0 0 8px", lineHeight: 1.5, paddingLeft: 36 }}>{(n.summary || "").length > 200 ? n.summary.substring(0, 200) + "..." : n.summary}</p>
                  <div style={{ paddingLeft: 36 }}>
                    {n.link && <a href={n.link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: T.ac, textDecoration: "none" }}>Läs artikeln</a>}
                  </div>
                </div>
              );
            })}
            {news.length > 0 && !busy1 && (
              <div style={{ textAlign: "center", padding: 14, background: T.os, borderRadius: 10 }}>
                <span style={{ color: T.ok, fontSize: 13 }}>
                  {selectedNews.length > 0 ? `${selectedNews.length} vald${selectedNews.length > 1 ? "a" : ""}` : `${news.length} nyheter rankade — klicka för att välja`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CREATE */}
        {tab === "create" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Skapa inlägg</h2>
            <p style={{ fontSize: 13, color: T.tm, margin: "0 0 16px" }}>Beskriv vad inlägget ska handla om</p>

            {selectedNews.length > 0 && (
              <div style={{ background: T.as, border: `1px solid ${T.ac}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.ac, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: selectedNews.length > 1 ? 8 : 0 }}>
                  <span>{selectedNews.length} nyhet{selectedNews.length > 1 ? "er" : ""} som kontext</span>
                  <button onClick={() => setSelectedNews([])} style={{ background: "none", border: "none", color: T.ac, cursor: "pointer", fontSize: 12, fontFamily: F }}>Rensa</button>
                </div>
                {selectedNews.map((n, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
                    <span style={{ color: T.tx }}>{n.headline.substring(0, 70)}{n.headline.length > 70 ? "..." : ""}</span>
                    <button onClick={() => setSelectedNews(prev => prev.filter(s => s.headline !== n.headline))} style={{ background: "none", border: "none", color: T.dn, cursor: "pointer", fontSize: 14, fontFamily: F, flexShrink: 0 }}>x</button>
                  </div>
                ))}
              </div>
            )}
            {news.length > 0 && selectedNews.length === 0 && <div style={{ background: T.ws, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: T.wn, marginBottom: 14 }}>Ingen nyhet vald — välj i Nyhetsscan eller skriv fritt</div>}

            <textarea value={postInput} onChange={e => setPostInput(e.target.value)}
              placeholder={"Beskriv vad inlägget ska handla om...\n\nExempel:\n- Skriv om NVIDIA och vad det betyder för AI-infrastruktur\n- Personligt inlägg om AI-investeringar långsiktigt\n- Kommentera EU AI Act och konsekvenser för nordiska tech-bolag\n- Utbildande inlägg: hur familjekontor bör tänka kring AI-allokering"}
              rows={5} style={{ width: "100%", boxSizing: "border-box", background: T.sf, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, fontFamily: F, outline: "none", resize: "vertical", lineHeight: 1.5 }} />
            <button onClick={generatePost} disabled={busy2 || !postInput.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, background: busy2 || !postInput.trim() ? T.sf : `linear-gradient(135deg, ${T.ac}, #2563eb)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: busy2 || !postInput.trim() ? "not-allowed" : "pointer", fontFamily: F, marginBottom: 20, opacity: !postInput.trim() ? 0.5 : 1 }}>
              {busy2 ? <Spin s={16} /> : null} {busy2 ? "Genererar..." : "Generera 3 utkast"}
            </button>

            {drafts.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><span style={{ fontSize: 13, color: T.tm }}>{drafts.length} utkast</span><button onClick={() => { if (confirm("Rensa alla?")) setDrafts([]); }} style={{ background: "none", border: "none", color: T.dn, fontSize: 12, cursor: "pointer", fontFamily: F }}>Rensa alla</button></div>}

            {drafts.map((d, i) => (
              <div key={i} style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{i + 1}. {d.title}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <CopyBtn text={d.body} />
                    <button onClick={() => setRefIdx(refIdx === i ? null : i)} style={{ background: refIdx === i ? T.ws : T.sf, color: refIdx === i ? T.wn : T.tm, border: `1px solid ${refIdx === i ? T.wn : T.bd}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: F }}>Förfina</button>
                    <button onClick={() => setDrafts(prev => prev.filter((_, j) => j !== i))} style={{ background: T.sf, color: T.dn, border: `1px solid ${T.bd}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: F }}>x</button>
                  </div>
                </div>
                <div style={{ padding: 14 }}><pre style={{ fontFamily: F, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{d.body}</pre></div>
                {d.reasoning && <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.bd}`, fontSize: 12, color: T.td, background: T.bg }}><strong style={{ color: T.tm }}>Vinkel: </strong>{d.reasoning}</div>}
                {refIdx === i && (
                  <div style={{ padding: 14, borderTop: `1px solid ${T.bd}`, background: T.bg }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input value={refText} onChange={e => setRefText(e.target.value)} placeholder="T.ex. starkare hook, mer data..."
                        style={{ flex: 1, background: T.sf, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, fontFamily: F, outline: "none" }}
                        onKeyDown={e => e.key === "Enter" && !busy3 && refineDraft(d)} />
                      <button onClick={() => refineDraft(d)} disabled={busy3 || !refText.trim()}
                        style={{ background: T.ac, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: F, opacity: busy3 || !refText.trim() ? 0.5 : 1 }}>
                        {busy3 ? <Spin s={14} /> : "Kör"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {["Starkare hook", "Mer data", "Personligare", "Kortare", "Lägg till CTA", "Mer kontroversielt"].map(q => (
                        <button key={q} onClick={() => setRefText(q)} style={{ background: T.sf, color: T.tm, border: `1px solid ${T.bd}`, borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: F }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TOPLIST */}
        {tab === "toplist" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Topplistor</h2>
            <p style={{ fontSize: 13, color: T.tm, margin: "0 0 16px" }}>Generera topplistor för LinkedIn — bolag, trender, investeringar</p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: T.td, fontWeight: 500 }}>AI-förslag — klicka för att använda, eller skriv eget nedan</label>
                <button onClick={() => { setSuggestionsLoaded(false); setToplistSuggestions([]); loadToplistSuggestions(); }} disabled={busySuggestions}
                  style={{ background: "none", border: `1px solid ${T.bd}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.tm, cursor: busySuggestions ? "wait" : "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}>
                  {busySuggestions ? <Spin s={12} /> : null} {busySuggestions ? "Laddar..." : "Nya förslag"}
                </button>
              </div>

              {busySuggestions && toplistSuggestions.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: T.sf, borderRadius: 8, fontSize: 13, color: T.tm }}>
                  <Spin s={14} /> Hämtar aktuella förslag från AI...
                </div>
              )}

              {toplistSuggestions.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {toplistSuggestions.map((sug, i) => (
                    <button key={i} onClick={() => setToplistPrompt(sug.prompt)}
                      style={{
                        background: toplistPrompt === sug.prompt ? T.as : T.sf,
                        color: toplistPrompt === sug.prompt ? T.ac : T.tm,
                        border: `1px solid ${toplistPrompt === sug.prompt ? T.ac : T.bd}`,
                        borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: F,
                        transition: "all 0.15s", textAlign: "left",
                      }}>
                      {sug.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: T.td, fontWeight: 500, display: "block", marginBottom: 6 }}>Toppliste-prompt</label>
              <textarea value={toplistPrompt} onChange={e => setToplistPrompt(e.target.value)}
                placeholder={"Skriv din egen toppliste-idé eller klicka ett förslag ovan...\n\nExempel:\n- 5 hetaste AI-bolagen i Norden just nu\n- Top 3 europeiska GPU-molntjänster\n- 5 mest intressanta AI-förvärv senaste kvartalet"}
                rows={4} style={{ width: "100%", boxSizing: "border-box", background: T.sf, color: T.tx, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, fontFamily: F, outline: "none", resize: "vertical", lineHeight: 1.5 }} />
            </div>

            <button onClick={generateToplist} disabled={busy4 || !toplistPrompt.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: busy4 || !toplistPrompt.trim() ? T.sf : `linear-gradient(135deg, ${T.ac}, #2563eb)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: busy4 || !toplistPrompt.trim() ? "not-allowed" : "pointer", fontFamily: F, marginBottom: 20, opacity: !toplistPrompt.trim() ? 0.5 : 1 }}>
              {busy4 ? <Spin s={16} /> : null} {busy4 ? "Genererar..." : "Generera topplista"}
            </button>

            {toplistResults.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: T.tm }}>{toplistResults.length} poster</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <CopyBtn text={toplistToText()} />
                    <button onClick={toplistToLinkedIn}
                      style={{ background: T.as, color: T.ac, border: `1px solid ${T.ac}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: F }}>
                      Skapa LinkedIn-inlägg
                    </button>
                    <button onClick={() => setToplistResults([])}
                      style={{ background: T.sf, color: T.dn, border: `1px solid ${T.bd}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: F }}>
                      Rensa
                    </button>
                  </div>
                </div>

                {toplistResults.map((item, i) => (
                  <div key={i} style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 10, padding: 16, marginBottom: 10, transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: i === 0 ? "linear-gradient(135deg, #f59e0b, #d97706)" : i === 1 ? "linear-gradient(135deg, #94a3b8, #64748b)" : i === 2 ? "linear-gradient(135deg, #cd7c2f, #a3621d)" : `linear-gradient(135deg, ${T.ac}, #2563eb)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: "#fff",
                      }}>
                        {item.rank || i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: T.ac, marginBottom: 8 }}>{item.oneliner}</div>
                        <div style={{ fontSize: 13, color: T.tm, lineHeight: 1.5 }}>{item.reasoning}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ textAlign: "center", padding: 14, background: T.as, borderRadius: 10, marginTop: 4 }}>
                  <span style={{ color: T.ac, fontSize: 13 }}>Klicka "Skapa LinkedIn-inlägg" för att göra ett inlägg av topplistan</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
