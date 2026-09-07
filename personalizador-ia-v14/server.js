import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const DEMO_MODE = String(process.env.DEMO_MODE || "false").toLowerCase() === "true";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/reference", express.static(path.join(__dirname, "reference")));

const colorReferences = {
  Rosa: "rosa.jpg",
  Azul: "azul.jpg",
  Verde: "verde.jpg",
  "Lilás": "lilas.jpg",
  Dourado: "dourado.jpg",
  Transparente: "transparente.jpg",
};

const allowedColors = new Set([
  "Rosa",
  "Vermelho",
  "Azul",
  "Verde",
  "Lilás",
  "Dourado",
  "Transparente",
]);

const recentRequests = new Map();
const MIN_INTERVAL_MS = 1500;

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 12);
}

function getReferenceImagePath(color) {
  const file = colorReferences[color];
  return file ? path.join(__dirname, "reference", file) : null;
}

function colorConfig(color) {
  const map = {
    Rosa: { top: "#f22968", mid: "#ff88ad", edge: "#ff4f83" },
    Azul: { top: "#1968d8", mid: "#71aaff", edge: "#3282ef" },
    Verde: { top: "#16964c", mid: "#76cf92", edge: "#28ad63" },
    "Lilás": { top: "#7d35c4", mid: "#bc82ef", edge: "#9957d8" },
    Dourado: { top: "#d59a12", mid: "#ffd96a", edge: "#e7b02b" },
    Transparente: { top: "#eaf3f7", mid: "#ffffff", edge: "#d4e6ee" },
  };
  return map[color] || map.Rosa;
}

function buildDemoPreview(name, color) {
  const c = colorConfig(color);
  const safeName = name.replace(/[<>&\"]/g, "");
  const len = Math.max(1, safeName.length);
  const fontSize = len <= 5 ? 205 : len <= 7 ? 170 : len <= 9 ? 140 : 112;
  const tracking = len <= 6 ? 6 : 2;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff7f8"/>
        <stop offset="1" stop-color="#ecd9d6"/>
      </linearGradient>
      <linearGradient id="letters" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.top}"/>
        <stop offset="0.45" stop-color="${c.mid}" stop-opacity="0.94"/>
        <stop offset="0.62" stop-color="#ffffff" stop-opacity="0.78"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.38"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="glow"><feGaussianBlur stdDeviation="13" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#6f4a43" flood-opacity="0.22"/></filter>
    </defs>

    <rect width="1200" height="800" fill="url(#wall)"/>
    <rect x="0" y="0" width="190" height="800" fill="#fff" opacity="0.8"/>
    <rect x="72" y="0" width="90" height="800" fill="#f6d8dc" opacity="0.7"/>
    <rect x="170" y="268" width="1030" height="280" rx="18" fill="#f8f3f0"/>
    <line x1="170" y1="365" x2="1200" y2="365" stroke="#ddc9c2" stroke-width="3"/>
    <circle cx="382" cy="415" r="8" fill="#d8c2bb"/>
    <circle cx="770" cy="415" r="8" fill="#d8c2bb"/>
    <circle cx="1050" cy="415" r="8" fill="#d8c2bb"/>

    <circle cx="420" cy="185" r="62" fill="#ceb3a5" opacity="0.72"/>
    <circle cx="378" cy="138" r="24" fill="#ceb3a5" opacity="0.72"/>
    <circle cx="462" cy="138" r="24" fill="#ceb3a5" opacity="0.72"/>
    <circle cx="403" cy="177" r="5" fill="#76594f"/>
    <circle cx="437" cy="177" r="5" fill="#76594f"/>
    <ellipse cx="420" cy="197" rx="11" ry="8" fill="#8f695b"/>

    <circle cx="745" cy="115" r="54" fill="#ffd56c" opacity="0.9" filter="url(#glow)"/>
    <circle cx="770" cy="98" r="52" fill="#fff2e6"/>
    <circle cx="680" cy="80" r="5" fill="#f4b5c5"/>
    <circle cx="820" cy="73" r="4" fill="#f4b5c5"/>
    <path d="M588 165 l13 26 29 4-21 20 5 29-26-14-26 14 5-29-21-20 29-4z" fill="#ffd3df" opacity="0.7"/>

    <ellipse cx="600" cy="674" rx="470" ry="35" fill="#f4c86b" opacity="0.28" filter="url(#soft)"/>
    <rect x="115" y="620" width="970" height="108" rx="16" fill="#ffffff" filter="url(#shadow)"/>
    <rect x="145" y="625" width="910" height="9" rx="4" fill="#ffd980" opacity="0.82" filter="url(#glow)"/>

    <text x="600" y="618" text-anchor="middle"
      font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" font-weight="900"
      letter-spacing="${tracking}" fill="url(#letters)" stroke="${c.edge}" stroke-width="3"
      paint-order="stroke" filter="url(#shadow)">${safeName}</text>

    <text x="600" y="762" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#8c7075">
      Prévia de teste • ${color} • sem consumo de créditos
    </text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildPrompt(name, color) {
  return `
A imagem fornecida é a FOTO DE REFERÊNCIA APROVADA da Encanto em Resina para a cor "${color}".

OBJETIVO PRINCIPAL:
Edite essa fotografia preservando o máximo possível o produto, o cenário, a base, a perspectiva e a iluminação. Altere principalmente o nome atual da luminária para o nome exato "${name}".

REGRAS OBRIGATÓRIAS:
- O nome deve ser escrito EXATAMENTE como "${name}", sem letras extras, sem letras faltando e sem trocar a ordem.
- Use uma peça física de resina/acrílico por letra, em caixa alta, apoiada e encaixada visualmente sobre a base.
- Preserve o acabamento e a combinação de cor da FOTO DE REFERÊNCIA APROVADA para "${color}".
- Não invente outra tonalidade e não mude a paleta geral do ambiente.
- Mantenha a base branca retangular com proporção, posição, perspectiva e LED semelhantes à referência escolhida.
- Mantenha cenário infantil, objetos, enquadramento, profundidade de campo e iluminação o mais próximos possível da referência.
- As letras devem parecer peças artesanais reais de resina/acrílico, com transparência e brilho coerentes com a referência.
- A parte inferior das letras deve permanecer majoritariamente transparente quando esse acabamento estiver presente na referência, com apenas um brilho amarelo suave vindo do LED.
- Se a referência tiver borboletas ou se elas forem usadas na nova composição, coloque-as SOMENTE na primeira e na última letra. Nunca nas letras do meio.
- Não adicione textos, logotipos, etiquetas, letras soltas ou objetos estranhos fora da luminária.
- Não deixe as letras flutuando. Todas devem tocar visualmente a base e parecer realmente encaixadas nela.
- A imagem final deve parecer uma fotografia profissional real do produto, não uma montagem digital.

IMPORTANTE:
Priorize fidelidade à referência aprovada da cor "${color}" e altere principalmente o nome para "${name}".
`.trim();
}

app.get("/health", (_req, res) => {
  const references = Object.fromEntries(
    Object.entries(colorReferences).map(([color, file]) => [color, fs.existsSync(path.join(__dirname, "reference", file))])
  );
  res.json({ ok: true, model: MODEL, demo_mode: DEMO_MODE, references, vermelho: "aguardando_foto_aprovada" });
});

app.post("/api/gerar-luminaria", async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const color = String(req.body?.color || "");

    if (!name) return res.status(400).json({ error: "Digite um nome válido." });
    if (!allowedColors.has(color)) return res.status(400).json({ error: "Escolha uma cor válida." });
    if (color === "Vermelho") return res.status(400).json({ error: "A cor Vermelho está aguardando uma foto de referência aprovada." });

    const referenceImagePath = getReferenceImagePath(color);
    if (!referenceImagePath || !fs.existsSync(referenceImagePath)) {
      return res.status(500).json({ error: `A foto de referência aprovada da cor ${color} não foi encontrada no servidor.` });
    }

    if (DEMO_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return res.json({
        ok: true,
        demo: true,
        name,
        color,
        model: MODEL,
        reference: colorReferences[color],
        image_url: buildDemoPreview(name, color),
        message: `Prévia de teste criada para ${name} na cor ${color}. Nenhum crédito foi usado.`
      });
    }

    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "A variável OPENAI_API_KEY ainda não foi configurada no servidor." });

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const last = recentRequests.get(ip) || 0;
    const now = Date.now();
    if (last && now - last < MIN_INTERVAL_MS) return res.status(429).json({ error: "A geração anterior acabou de terminar. Tente novamente em um instante." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const fileName = colorReferences[color];
    const referenceImage = await toFile(await fs.promises.readFile(referenceImagePath), fileName, { type: "image/jpeg" });

    const result = await openai.images.edit({
      model: MODEL,
      image: referenceImage,
      prompt: buildPrompt(name, color),
      size: "1536x1024",
      quality: "high",
      n: 1,
    });

    const first = result?.data?.[0];
    if (!first) throw new Error("A API não retornou uma imagem.");

    let imageUrl = first.url || "";
    if (first.b64_json) imageUrl = `data:image/png;base64,${first.b64_json}`;
    if (!imageUrl) throw new Error("A API retornou uma resposta sem imagem.");

    recentRequests.set(ip, Date.now());
    res.json({ ok: true, demo: false, name, color, model: MODEL, reference: fileName, image_url: imageUrl });
  } catch (error) {
    console.error("Erro ao gerar luminária:", error);
    const message = error?.error?.message || error?.message || "Erro inesperado ao gerar a imagem.";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Encanto IA rodando na porta ${PORT} | modo teste: ${DEMO_MODE}`);
});
