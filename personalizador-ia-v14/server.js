import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const referenceImagePath = path.join(__dirname, "reference", "luminaria-referencia.jpg");

// Proteção simples contra cliques repetidos e custos acidentais.
// Em produção maior, troque por Redis/Upstash ou outro rate limiter persistente.
const recentRequests = new Map();
const MIN_INTERVAL_MS = 8000;

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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "A variável OPENAI_API_KEY ainda não foi configurada no servidor.",
      });
    }
    if (!fs.existsSync(referenceImagePath)) {
      return res.status(500).json({
        error: "A imagem de referência não foi encontrada no servidor.",
      });
    }

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";

    const last = recentRequests.get(ip) || 0;
    const now = Date.now();
    if (now - last < MIN_INTERVAL_MS) {
      const wait = Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000);
      return res.status(429).json({
        error: `Aguarde ${wait}s antes de gerar outra imagem.`,
      });
    }
    recentRequests.set(ip, now);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const result = await openai.images.edit({
      model: MODEL,
      image: fs.createReadStream(referenceImagePath),
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

    res.json({
      ok: true,
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
  console.log(`Encanto IA rodando na porta ${PORT}`);
});
