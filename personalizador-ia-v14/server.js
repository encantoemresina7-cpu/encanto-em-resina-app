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

async function getReferenceDataUrl(referenceImagePath) {
  const imageBase64 = await fs.promises.readFile(referenceImagePath, "base64");
  return `data:image/jpeg;base64,${imageBase64}`;
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
    Object.entries(colorReferences).map(([color, file]) => [
      color,
      fs.existsSync(path.join(__dirname, "reference", file)),
    ])
  );

  res.json({
    ok: true,
    model: MODEL,
    demo_mode: DEMO_MODE,
    references,
    vermelho: "aguardando_foto_aprovada",
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
    if (color === "Vermelho") {
      return res.status(400).json({
        error: "A cor Vermelho está aguardando uma foto de referência aprovada.",
      });
    }

    const referenceImagePath = getReferenceImagePath(color);
    if (!referenceImagePath || !fs.existsSync(referenceImagePath)) {
      return res.status(500).json({
        error: `A foto de referência aprovada da cor ${color} não foi encontrada no servidor.`,
      });
    }

    if (DEMO_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return res.json({
        ok: true,
        demo: true,
        name,
        color,
        model: MODEL,
        reference: colorReferences[color],
        image_url: await getReferenceDataUrl(referenceImagePath),
        message: `Modo teste: mostrando a foto de referência da cor ${color}. O nome ${name} foi registrado, mas ainda não foi aplicado porque a IA real está desligada. Nenhum crédito foi usado.`,
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
    const fileName = colorReferences[color];
    const referenceImage = await toFile(
      await fs.promises.readFile(referenceImagePath),
      fileName,
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
