(() => {
  "use strict";

  const VALOR_BASE = 89.99;
  const LIMITE_BASE = 5;
  const API_FRETE_URL = "https://calculadora-aurora.onrender.com/calcular-frete";

  const $ = (id) => document.getElementById(id);
  const cliente = $("cliente");
  const listaLuminarias = $("listaLuminarias");
  const modeloLuminaria = $("modeloLuminaria");
  const cepDestino = $("cepDestino");
  const frete = $("frete");
  const statusFrete = $("statusFrete");
  const opcoesFrete = $("opcoesFrete");
  const btnFrete = $("btnFrete");

  let proximoId = 1;
  let servicoFreteSelecionado = "";
  let prazoFreteSelecionado = null;

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function contarLetras(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .length;
  }

  function formatarCep(valor) {
    const numeros = String(valor || "").replace(/\D/g, "").slice(0, 8);
    return numeros.length > 5 ? numeros.slice(0, 5) + "-" + numeros.slice(5) : numeros;
  }

  function lerFrete() {
    const numero = Number(frete.value.trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }
function calcularValor(qtdLetras) {
  if (!Number.isInteger(qtdLetras) || qtdLetras <= 0) {
    return { extras: 0, adicional: 0, valor: 0 };
  }

  const extras = Math.max(0, qtdLetras - LIMITE_BASE);
  let adicional = 0;

  if (qtdLetras >= 6) adicional += 5;
  if (qtdLetras >= 7) adicional += 5;
  if (qtdLetras >= 8) adicional += 7;
  if (qtdLetras >= 9) adicional += 7;
  if (qtdLetras >= 10) adicional += 9;

  if (qtdLetras > 10) {
    adicional += (qtdLetras - 10) * 10;
  }

  return {
    extras,
    adicional,
    valor: VALOR_BASE + adicional
  };
}


  function obterCards() {
    return [...listaLuminarias.querySelectorAll(".luminaria-card")];
  }

  function obterItens() {
    return obterCards().map((card, indice) => {
      const nomeInput = card.querySelector(".nome-luminaria");
      const quantidadeInput = card.querySelector(".quantidade-letras");
      const qtd = Number(quantidadeInput.value) || 0;
      return {
        numero: indice + 1,
        nome: nomeInput.value.trim(),
        cor: card.dataset.cor || "Transparente",
        qtd,
        ...calcularValor(qtd)
      };
    });
  }

  function obterDimensoesEmbalagem() {
    const qtd = Math.max(1, obterCards().length);
    const tabela = {
      1: { altura: 8, largura: 10, comprimento: 30 },
      2: { altura: 16, largura: 10, comprimento: 30 },
      3: { altura: 24, largura: 30, comprimento: 30 },
      4: { altura: 16, largura: 20, comprimento: 30 }
    };
    return tabela[qtd] || { altura: Math.min(50, 8 * Math.ceil(qtd / 2)), largura: 20, comprimento: 30 };
  }

  function textoDimensoes() {
    const d = obterDimensoesEmbalagem();
    return `${d.altura} × ${d.largura} × ${d.comprimento} cm`;
  }

  function mostrarStatus(tipo, mensagem) {
    statusFrete.className = "status-frete " + tipo;
    statusFrete.textContent = mensagem;
  }

  function limparStatus() {
    statusFrete.className = "status-frete";
    statusFrete.textContent = "";
  }

  function limparOpcoesFrete() {
    opcoesFrete.innerHTML = "";
    frete.value = "0,00";
    servicoFreteSelecionado = "";
    prazoFreteSelecionado = null;
  }

  function invalidarFrete() {
    limparStatus();
    limparOpcoesFrete();
  }

  function atualizarNumeracao() {
    const cards = obterCards();
    cards.forEach((card, indice) => {
      card.querySelector(".numero-luminaria").textContent = String(indice + 1);
      card.querySelector(".btn-remover").hidden = cards.length === 1;
    });
  }

  function atualizarResumo() {
    const itens = obterItens();
    const subtotal = itens.reduce((soma, item) => soma + item.valor, 0);
    const valorDoFrete = lerFrete();
    const total = subtotal + valorDoFrete;

    $("resLuminarias").textContent = String(itens.length);
    $("resEmbalagem").textContent = textoDimensoes();
    $("resSubtotal").textContent = moeda(subtotal);
    $("resFrete").textContent = moeda(valorDoFrete);
    $("resTotal").textContent = moeda(total);

    $("resItens").innerHTML = itens.map((item) => `
      <div class="resumo-item">
        <div class="resumo-item-topo">
          <strong>${item.numero}. ${item.nome || "Nome não informado"}</strong>
          <strong>${moeda(item.valor)}</strong>
        </div>
        <small>${item.cor} • ${item.qtd} ${item.qtd === 1 ? "letra" : "letras"}</small>
      </div>
    `).join("");
  }

  function atualizarCard(card) {
    const qtd = Number(card.querySelector(".quantidade-letras").value) || 0;
    const nome = card.querySelector(".nome-luminaria").value.trim() || "Alice";
    card.querySelector(".valor-item").textContent = moeda(calcularValor(qtd).valor);
    card.querySelector(".nome-previa").textContent = nome;
    atualizarResumo();
  }

  function adicionarLuminaria(dados = {}) {
    const fragmento = modeloLuminaria.content.cloneNode(true);
    const card = fragmento.querySelector(".luminaria-card");
    const nomeInput = card.querySelector(".nome-luminaria");
    const quantidadeInput = card.querySelector(".quantidade-letras");

    card.dataset.id = String(proximoId++);
    card.dataset.cor = dados.cor || "Transparente";
    nomeInput.value = dados.nome || "";

    const qtdInicial = dados.qtd || contarLetras(nomeInput.value);
    quantidadeInput.value = qtdInicial > 0 ? String(qtdInicial) : "";

    card.querySelectorAll(".cor-opcao").forEach((botao) => {
      botao.classList.toggle("ativa", botao.dataset.cor === card.dataset.cor);
      botao.addEventListener("click", () => {
        card.querySelectorAll(".cor-opcao").forEach((item) => item.classList.remove("ativa"));
        botao.classList.add("ativa");
        card.dataset.cor = botao.dataset.cor;
        invalidarFrete();
        atualizarCard(card);
      });
    });

    nomeInput.addEventListener("input", () => {
      const qtd = contarLetras(nomeInput.value);
      quantidadeInput.value = qtd > 0 ? String(qtd) : "";
      invalidarFrete();
      atualizarCard(card);
    });

    quantidadeInput.addEventListener("input", () => {
      invalidarFrete();
      atualizarCard(card);
    });

    card.querySelector(".btn-remover").addEventListener("click", () => {
      card.remove();
      invalidarFrete();
      atualizarNumeracao();
      atualizarResumo();
    });

    listaLuminarias.appendChild(fragmento);
    atualizarNumeracao();
    atualizarCard(card);
    return card;
  }

  function selecionarFrete(botao, opcao) {
    document.querySelectorAll(".opcao-frete").forEach((item) => item.classList.remove("ativa"));
    botao.classList.add("ativa");
    frete.value = Number(opcao.valor).toFixed(2).replace(".", ",");
    servicoFreteSelecionado = opcao.nome || opcao.servico || "Frete";
    prazoFreteSelecionado = Number.isFinite(Number(opcao.prazoDias)) ? Number(opcao.prazoDias) : null;
    mostrarStatus("sucesso", `${servicoFreteSelecionado} selecionado: ${moeda(Number(opcao.valor))}`);
    atualizarResumo();
  }

  function exibirOpcoesFrete(opcoes) {
    opcoesFrete.innerHTML = "";
    opcoes.forEach((opcao) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "opcao-frete";
      const prazo = Number.isFinite(Number(opcao.prazoDias)) ? `${Number(opcao.prazoDias)} dia(s) útil(eis)` : "Prazo não informado";
      botao.innerHTML = `
        <span class="opcao-frete-topo">
          <span>${opcao.nome || opcao.servico || "Frete"}</span>
          <span>${moeda(Number(opcao.valor))}</span>
        </span>
        <span class="opcao-frete-prazo">${prazo}</span>
      `;
      botao.addEventListener("click", () => selecionarFrete(botao, opcao));
      opcoesFrete.appendChild(botao);
    });
  }

  async function consultarFrete() {
    const cep = cepDestino.value.replace(/\D/g, "");
    const itens = obterItens();
    const subtotal = itens.reduce((soma, item) => soma + item.valor, 0);

    if (cep.length !== 8) {
      mostrarStatus("erro", "Digite um CEP válido com 8 números.");
      cepDestino.focus();
      return;
    }

    if (subtotal <= 0 || itens.some((item) => item.qtd <= 0)) {
      mostrarStatus("erro", "Preencha o nome de todas as luminárias antes de calcular o frete.");
      return;
    }

    limparOpcoesFrete();
    mostrarStatus("carregando", "Consultando o frete. Na primeira tentativa, aguarde até cerca de 50 segundos...");
    btnFrete.disabled = true;
    btnFrete.textContent = "Consultando...";

    const dimensoes = obterDimensoesEmbalagem();

    try {
      const resposta = await fetch(API_FRETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cepDestino: cep,
          valorSeguro: subtotal.toFixed(2),
          quantidadeLuminarias: itens.length,
          altura: dimensoes.altura,
          largura: dimensoes.largura,
          comprimento: dimensoes.comprimento
        })
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) throw new Error(dados.erro || "Não foi possível calcular o frete.");
      if (!Array.isArray(dados.opcoes) || dados.opcoes.length === 0) throw new Error("Nenhuma opção de frete foi encontrada.");

      exibirOpcoesFrete(dados.opcoes);
      mostrarStatus("sucesso", "Escolha uma opção de entrega para somar o frete ao total.");
    } catch (erro) {
      mostrarStatus("erro", `${erro.message} Confira o CEP e tente novamente.`);
    } finally {
      btnFrete.disabled = false;
      btnFrete.textContent = "🔎 Calcular frete";
    }
  }

  function montarTexto() {
    const itens = obterItens();
    const subtotal = itens.reduce((soma, item) => soma + item.valor, 0);
    const valorDoFrete = lerFrete();
    const total = subtotal + valorDoFrete;

    const listaTexto = itens.map((item) => `
${item.numero}️⃣ ${item.nome || "Nome não informado"}
Cor: ${item.cor}
Quantidade de letras: ${item.qtd}
Valor da luminária: ${moeda(item.valor)}`).join("\n");

    return `ORÇAMENTO DA LUMINÁRIA — ENCANTO EM RESINA

Cliente: ${cliente.value.trim() || "Não informado"}

${listaTexto}

Quantidade de luminárias: ${itens.length}
Embalagem: ${textoDimensoes()}
Subtotal: ${moeda(subtotal)}
Frete: ${moeda(valorDoFrete)}${servicoFreteSelecionado ? ` (${servicoFreteSelecionado})` : ""}
Prazo do frete: ${prazoFreteSelecionado ? `${prazoFreteSelecionado} dia(s) útil(eis)` : "Não informado"}
TOTAL: ${moeda(total)}

Prazo de produção: 6 dias úteis.
Orçamento válido por 7 dias.`;
  }

  $("btnAdicionar").addEventListener("click", () => {
    invalidarFrete();
    const card = adicionarLuminaria();
    card.querySelector(".nome-luminaria").focus();
  });

  cliente.addEventListener("input", atualizarResumo);

  cepDestino.addEventListener("input", () => {
    cepDestino.value = formatarCep(cepDestino.value);
    invalidarFrete();
    atualizarResumo();
  });

  cepDestino.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      consultarFrete();
    }
  });

  btnFrete.addEventListener("click", consultarFrete);

  $("btnCopiar").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(montarTexto());
      $("mensagem").style.display = "block";
      setTimeout(() => { $("mensagem").style.display = "none"; }, 2500);
    } catch {
      alert("Não foi possível copiar automaticamente. Tente abrir pelo Chrome ou Edge.");
    }
  });

  $("btnWhatsapp").addEventListener("click", () => {
    const texto = encodeURIComponent(montarTexto());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  });

  $("btnLimpar").addEventListener("click", () => {
    cliente.value = "";
    cepDestino.value = "";
    listaLuminarias.innerHTML = "";
    proximoId = 1;
    invalidarFrete();
    adicionarLuminaria();
    atualizarResumo();
    cliente.focus();
  });

  adicionarLuminaria();
  atualizarResumo();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(console.error);
    });
  }
})();
