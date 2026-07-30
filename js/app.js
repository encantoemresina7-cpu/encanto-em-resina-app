(() => {
  "use strict";

  const VALOR_BASE = 89.99;
  const LIMITE_BASE = 5;
  const VALOR_EXTRA = 5;
  const API_FRETE_URL = "https://calculadora-aurora.onrender.com/calcular-frete";

  let corSelecionada = "Transparente";
  let valorProdutoAtual = 0;
  let servicoFreteSelecionado = "";
  let prazoFreteSelecionado = null;

  const $ = (id) => document.getElementById(id);

  const cliente = $("cliente");
  const telefone = $("telefone");
  const cidade = $("cidade");
  const nome = $("nome");
  const quantidade = $("quantidade");
  const quantidadeLuminarias = $("quantidadeLuminarias");
  const medidasEmbalagem = $("medidasEmbalagem");
  const cepDestino = $("cepDestino");
  const frete = $("frete");
  const statusFrete = $("statusFrete");
  const opcoesFrete = $("opcoesFrete");
  const btnFrete = $("btnFrete");

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
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
    return numeros.length > 5
      ? numeros.slice(0, 5) + "-" + numeros.slice(5)
      : numeros;
  }

  function lerFrete() {
    const numero = Number(
      frete.value.trim().replace(/\./g, "").replace(",", ".")
    );
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  function obterDimensoesEmbalagem() {
    const qtd = Number(quantidadeLuminarias.value);

    const tabela = {
      1: { altura: 8, largura: 10, comprimento: 30 },
      2: { altura: 16, largura: 10, comprimento: 30 },
      3: { altura: 24, largura: 30, comprimento: 30 },
      4: { altura: 16, largura: 20, comprimento: 30 }
    };

    return tabela[qtd] || tabela[1];
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

  function atualizarResumo(qtd, extras, adicional) {
    const valorDoFrete = lerFrete();

    $("resCliente").textContent = cliente.value.trim() || "—";
    $("resNome").textContent = nome.value.trim() || "—";
    $("resCor").textContent = corSelecionada;
    $("resQuantidade").textContent = qtd + (qtd === 1 ? " letra" : " letras");
    $("resLuminarias").textContent = quantidadeLuminarias.value;
    $("resEmbalagem").textContent = textoDimensoes();
    $("resBase").textContent = qtd > 0 ? moeda(VALOR_BASE) : moeda(0);
    $("resExtras").textContent = String(extras);
    $("resAdicional").textContent = moeda(adicional);
    $("resFrete").textContent = moeda(valorDoFrete);
    $("resTotal").textContent = moeda(valorProdutoAtual + valorDoFrete);

    medidasEmbalagem.textContent = "Embalagem: " + textoDimensoes();
  }

  function calcular(qtd) {
    const valido = Number.isInteger(qtd) && qtd > 0;

    if (!valido) {
      valorProdutoAtual = 0;
      atualizarResumo(0, 0, 0);
      return;
    }

    const extras = Math.max(0, qtd - LIMITE_BASE);
    const adicional = extras * VALOR_EXTRA;
    valorProdutoAtual = VALOR_BASE + adicional;

    atualizarResumo(qtd, extras, adicional);
  }

  function calcularPeloNome() {
    const qtd = contarLetras(nome.value);
    quantidade.value = qtd > 0 ? String(qtd) : "";
    calcular(qtd);
  }

  function limparOpcoesFrete() {
    opcoesFrete.innerHTML = "";
    frete.value = "";
    servicoFreteSelecionado = "";
    prazoFreteSelecionado = null;
    calcular(Number(quantidade.value));
  }

  function selecionarFrete(botao, opcao) {
    document.querySelectorAll(".opcao-frete").forEach((item) => {
      item.classList.remove("ativa");
    });

    botao.classList.add("ativa");
    frete.value = Number(opcao.valor).toFixed(2).replace(".", ",");
    servicoFreteSelecionado = opcao.nome || opcao.servico || "Frete";
    prazoFreteSelecionado = Number.isFinite(Number(opcao.prazoDias))
      ? Number(opcao.prazoDias)
      : null;

    mostrarStatus(
      "sucesso",
      `${servicoFreteSelecionado} selecionado: ${moeda(Number(opcao.valor))}`
    );

    calcular(Number(quantidade.value));
  }

  function exibirOpcoesFrete(opcoes) {
    opcoesFrete.innerHTML = "";

    opcoes.forEach((opcao) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "opcao-frete";

      const prazo = Number.isFinite(Number(opcao.prazoDias))
        ? `${Number(opcao.prazoDias)} dia(s) útil(eis)`
        : "Prazo não informado";

      botao.innerHTML = `
        <span class="opcao-frete-topo">
          <span class="opcao-frete-nome">${opcao.nome || opcao.servico || "Frete"}</span>
          <span class="opcao-frete-valor">${moeda(Number(opcao.valor))}</span>
        </span>
        <span class="opcao-frete-prazo">${prazo}</span>
      `;

      botao.addEventListener("click", () => selecionarFrete(botao, opcao));
      opcoesFrete.appendChild(botao);
    });
  }

  async function consultarFrete() {
    const cep = cepDestino.value.replace(/\D/g, "");

    if (cep.length !== 8) {
      mostrarStatus("erro", "Digite um CEP válido com 8 números.");
      cepDestino.focus();
      return;
    }

    if (valorProdutoAtual <= 0) {
      mostrarStatus("erro", "Digite primeiro o nome da luminária.");
      nome.focus();
      return;
    }

    limparOpcoesFrete();
    mostrarStatus(
      "carregando",
      "Consultando a Manda Bem. Na primeira consulta, aguarde até cerca de 50 segundos..."
    );

    btnFrete.disabled = true;
    btnFrete.textContent = "Consultando...";

    const dimensoes = obterDimensoesEmbalagem();

    try {
      const resposta = await fetch(API_FRETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cepDestino: cep,
          valorSeguro: valorProdutoAtual.toFixed(2),
          quantidadeLuminarias: Number(quantidadeLuminarias.value),
          altura: dimensoes.altura,
          largura: dimensoes.largura,
          comprimento: dimensoes.comprimento
        })
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        throw new Error("O servidor respondeu em formato inesperado.");
      }

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível calcular o frete.");
      }

      if (!Array.isArray(dados.opcoes) || dados.opcoes.length === 0) {
        throw new Error("Nenhuma opção de frete foi encontrada.");
      }

      exibirOpcoesFrete(dados.opcoes);
      mostrarStatus(
        "sucesso",
        "Escolha uma das opções abaixo para somar o frete ao total."
      );
    } catch (erro) {
      mostrarStatus(
        "erro",
        `${erro.message} Confira o CEP e tente novamente.`
      );
    } finally {
      btnFrete.disabled = false;
      btnFrete.textContent = "🚚 Consultar frete";
    }
  }

  nome.addEventListener("input", calcularPeloNome);

  quantidade.addEventListener("input", () => {
    calcular(Number(quantidade.value));
  });

  cliente.addEventListener("input", () => {
    calcular(Number(quantidade.value));
  });

  quantidadeLuminarias.addEventListener("change", () => {
    limparStatus();
    limparOpcoesFrete();
    atualizarResumo(
      Number(quantidade.value) || 0,
      Math.max(0, (Number(quantidade.value) || 0) - LIMITE_BASE),
      Math.max(0, (Number(quantidade.value) || 0) - LIMITE_BASE) * VALOR_EXTRA
    );
  });

  document.querySelectorAll(".cor-opcao").forEach((botao) => {
    botao.addEventListener("click", () => {
      document.querySelectorAll(".cor-opcao").forEach((item) => {
        item.classList.remove("ativa");
      });

      botao.classList.add("ativa");
      corSelecionada = botao.dataset.cor;
      calcular(Number(quantidade.value));
    });
  });

  $("btnCalcular").addEventListener("click", () => {
    if (nome.value.trim()) {
      calcularPeloNome();
    } else {
      calcular(Number(quantidade.value));
    }
  });

  cepDestino.addEventListener("input", () => {
    cepDestino.value = formatarCep(cepDestino.value);
    limparStatus();
    limparOpcoesFrete();
  });

  cepDestino.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      consultarFrete();
    }
  });

  btnFrete.addEventListener("click", consultarFrete);

  $("btnCopiar").addEventListener("click", async () => {
    const qtd = Number(quantidade.value) || 0;
    const extras = Math.max(0, qtd - LIMITE_BASE);
    const adicional = extras * VALOR_EXTRA;
    const valorDoFrete = lerFrete();
    const total = valorProdutoAtual + valorDoFrete;
    const qtdLuminarias = Number(quantidadeLuminarias.value);

    const texto = `ORÇAMENTO LUMINÁRIA LED

Cliente: ${cliente.value.trim() || "Não informado"}
WhatsApp: ${telefone.value.trim() || "Não informado"}
Cidade: ${cidade.value.trim() || "Não informada"}

Nome da luminária: ${nome.value.trim() || "Não informado"}
Cor: ${corSelecionada}
Quantidade de letras: ${qtd}
Quantidade de luminárias: ${qtdLuminarias}
Embalagem: ${textoDimensoes()}

Preço base: ${qtd > 0 ? moeda(VALOR_BASE) : moeda(0)}
Letras extras: ${extras}
Adicional: ${moeda(adicional)}
Frete: ${moeda(valorDoFrete)}${servicoFreteSelecionado ? ` (${servicoFreteSelecionado})` : ""}
Prazo: ${prazoFreteSelecionado ? `${prazoFreteSelecionado} dia(s) útil(eis)` : "Não informado"}
TOTAL: ${moeda(total)}`;

    try {
      await navigator.clipboard.writeText(texto);
      $("mensagem").style.display = "block";
      setTimeout(() => {
        $("mensagem").style.display = "none";
      }, 2500);
    } catch {
      alert("Não foi possível copiar automaticamente. Tente abrir pelo Chrome ou Edge.");
    }
  });

  $("btnLimpar").addEventListener("click", () => {
    cliente.value = "";
    telefone.value = "";
    cidade.value = "";
    nome.value = "";
    quantidade.value = "";
    quantidadeLuminarias.value = "1";
    frete.value = "";
    cepDestino.value = "";
    opcoesFrete.innerHTML = "";
    limparStatus();

    servicoFreteSelecionado = "";
    prazoFreteSelecionado = null;
    corSelecionada = "Transparente";
    valorProdutoAtual = 0;

    document.querySelectorAll(".cor-opcao").forEach((item) => {
      item.classList.remove("ativa");
    });

    document.querySelector('[data-cor="Transparente"]').classList.add("ativa");
    atualizarResumo(0, 0, 0);
    cliente.focus();
  });

  atualizarResumo(0, 0, 0);

// ===============================
// VERSÃO 4.1 - MÚLTIPLAS LUMINÁRIAS
// ===============================

let contadorLuminarias = 1;

const btnAdicionar =
    document.getElementById("btnAdicionarLuminaria");

const listaLuminarias =
    document.getElementById("listaLuminarias");

if (btnAdicionar && listaLuminarias) {

    btnAdicionar.addEventListener(
        "click",
        adicionarLuminaria
    );

}

function adicionarLuminaria() {

    contadorLuminarias++;

    const card = document.createElement("div");

    card.className = "card-luminaria";

    card.innerHTML = `
        <h3>📦 Luminária ${contadorLuminarias}</h3>

        <label>Nome da luminária</label>

        <input
            type="text"
            class="nome-luminaria-extra"
            placeholder="Digite o nome"
            maxlength="25"
        >
    `;

    listaLuminarias.appendChild(card);
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("service-worker.js")
            .catch((erro) => console.error("Erro ao registrar Service Worker:", erro));
    });
}

})();
