# Encanto em Resina — Personalizador IA V14

Este projeto já junta **frontend + backend** no mesmo serviço.

Fluxo final:

1. Digitar o nome.
2. Escolher a cor.
3. Clicar em **Gerar imagem com IA**.
4. O backend envia a foto de referência + instruções para a API de imagens.
5. A imagem pronta volta para a tela.
6. Baixar ou compartilhar.

## Estrutura

- `public/index.html` — app que você usa no navegador.
- `server.js` — backend.
- `reference/luminaria-referencia.jpg` — foto aprovada usada como referência.
- `render.yaml` — configuração pronta para Render.
- `.env.example` — mostra quais variáveis configurar.

## Importante sobre a chave da API

Nunca coloque sua chave da OpenAI no HTML ou no GitHub.

No Render, adicione a chave em:

**Environment → Add Environment Variable**

Nome:
`OPENAI_API_KEY`

Valor:
sua chave da API.

A assinatura do ChatGPT e a API são cobranças separadas. Você precisa de uma conta de API habilitada para o modelo de imagens.

## Publicar no Render

Como este projeto está dentro da pasta `personalizador-ia-v14`, configure o Render com:

- Root Directory: `personalizador-ia-v14`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Em **Environment**, adicione:

- `OPENAI_API_KEY` = sua chave
- `OPENAI_IMAGE_MODEL` = `gpt-image-2`

Depois faça o deploy.

## Teste rápido

Abra:

`https://SEU-ENDERECO.onrender.com/health`

Deve aparecer algo parecido com:

```json
{
  "ok": true,
  "model": "gpt-image-2",
  "reference_image": true
}
```

Depois abra a página principal e gere um nome.

## O endpoint

O frontend chama:

`POST /api/gerar-luminaria`

JSON:

```json
{
  "name": "TIAGO",
  "color": "Rosa"
}
```

O servidor devolve:

```json
{
  "ok": true,
  "image_url": "data:image/png;base64,..."
}
```

## Ajustando a foto de referência

Se quiser trocar a foto oficial no futuro, substitua:

`reference/luminaria-referencia.jpg`

por outra imagem com o mesmo nome.

## Observação de qualidade

A IA pode variar um pouco a cada geração. O prompt foi escrito para preservar cenário, base e composição e alterar principalmente o nome/cor, mas resultados gerativos não são matematicamente idênticos em todas as tentativas.
