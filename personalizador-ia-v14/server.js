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

const referenceImagePath = path.join(__dirname, "reference", "luminaria-referencia.jpg");

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

const allowedColors = new Set([
  "Rosa",
  "Vermelho",
  "Azul",
  "Verde",
  "Lilás",
  "Dourado",
  "Transparente",
]);

function buildPrompt(name, color) {
  return `
Edite a foto de referência fornecida, preservando o máximo possível da fotografia original.

OBJETIVO PRINCIPAL:
Substitua SOMENTE a luminária personalizada da foto por uma versão com o nome exato "${name}" e na cor "${color}".

REGRAS OBRIGATÓRIAS:
- O nome deve ser escrito EXATAMENTE como "${name}", sem letras extras, sem letras faltando e sem trocar a ordem.
- Use uma letra de resina/acrílico por caractere, em caixa alta, apoiadas sobre a base.
- Mantenha a base branca retangular da foto, com a mesma proporção, posição, perspectiva e iluminação de LED quente.
- Mantenha o cenário infantil, cômoda, urso, lua, cortina, enquadramento, perspectiva, profundidade de campo e iluminação o mais próximos possível da imagem original.
- As letras devem parecer peças físicas reais de resina/acrílico, transparentes na parte inferior e com acabamento artesanal na parte superior.
- Para "${color}", adapte apenas o acabamento/cor das letras; não transforme a cor geral do quarto.
- A parte inferior das letras deve permanecer majoritariamente transparente, com apenas um brilho amarelo suave vindo do LED da base.
- Se usar borboletas decorativas, coloque-as SOMENTE na primeira e na última letra. Não coloque borboletas nas letras do meio.
- Não adicione textos, logotipos, etiquetas, objetos ou letras fora da luminária.
- Não deixe a luminária flutuando: as letras devem tocar visualmente a base e parecer realmente encaixadas nela.
- A imagem final deve parecer uma fotografia profissional real do produto, não uma montagem digital.

IMPORTANTE:
Priorize fidelidade à foto de referência. Preserve cenário e base; altere principalmente o nome e a cor das letras.
`.trim();
}

async function buildDemoImage(name, color) {
  const refB64 = await fs.promises.readFile(referenceImagePath, "base64");
  const safeName = name.replace(/[<>&\"]/g, "");
  const safeColor = color.replace(/[<>&\"]/g, "");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <image href="data:image/jpeg;base64,${refB64}" x="0" y="0" width="1200" height="800" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="650" width="1200" height="150" fill="rgba(65,22,36,0.82)"/>
    <text x="600" y="705" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">MODO TESTE • SEM CRÉDITOS</text>
    <text x="600" y="752" text-anchor="middle" fill="#ffe4ed" font-family="Arial, sans-serif" font-size="28">Nome: ${safeName} • Cor: ${safeColor}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    demo_mode: DEMO_MODE,
    reference_image: fs.existsSync(referenceImagePath),
  });
});

app.post("/api/gerar-luminaria", async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const color = String(req.body?.color || "");

    if (!name) {
      return res.status(400).json({ error: "Digite um nome válido." });
    }
    if (!allowedColors.has(color)) {
      return res.status(400).json({ error: "Escolha uma cor válida." });
    }
    if (!fs.existsSync(referenceImagePath)) {
      return res.status(500).json({
        error: "A imagem de referência não foi encontrada no servidor.",
      });
    }

    // MODO TESTE: não chama a API e não consome créditos.
    if (DEMO_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return res.json({
        ok: true,
        demo: true,
        name,
        color,
        model: MODEL,
        image_url: await buildDemoImage(name, color),
        message: "Modo teste ativo: nenhum crédito foi usado. A imagem exibida serve apenas para testar o fluxo do app.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "A variável OPENAI_API_KEY ainda não foi configurada no servidor.",
      });
    }

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";

    const last = recentRequests.get(ip) || 0;
    const now = Date.now();
    if (last && now - last < MIN_INTERVAL_MS) {
      return res.status(429).json({
        error: "A geração anterior acabou de terminar. Tente novamente em um instante.",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const referenceImage = await toFile(
      await fs.promises.readFile(referenceImagePath),
      "luminaria-referencia.jpg",
      { type: "image/jpeg" }
    );

    const result = await openai.images.edit({
      model: MODEL,
      image: referenceImage,
      prompt: buildPrompt(name, color),
      size: "1536x1024",
      quality: "high",
      n: 1,
    });

    const first = result?.data?.[0];
    if (!first) {
      throw new Error("A API não retornou uma imagem.");
    }

    let imageUrl = first.url || "";
    if (first.b64_json) {
      imageUrl = `data:image/png;base64,${first.b64_json}`;
    }

    if (!imageUrl) {
      throw new Error("A API retornou uma resposta sem URL ou imagem em base64.");
    }

    recentRequests.set(ip, Date.now());

    res.json({
      ok: true,
      demo: false,
      name,
      color,
      model: MODEL,
      image_url: imageUrl,
    });
  } catch (error) {
    console.error("Erro ao gerar luminária:", error);

    const message =
      error?.error?.message ||
      error?.message ||
      "Erro inesperado ao gerar a imagem.";

    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Encanto IA rodando na porta ${PORT} | modo teste: ${DEMO_MODE}`);
});
