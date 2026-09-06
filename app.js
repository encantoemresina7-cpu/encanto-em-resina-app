(() => {
  "use strict";

  const VALOR_BASE = 89.99;
  const LIMITE_BASE = 5;
  const API_FRETE_URL = "https://calculadora-aurora.onrender.com/calcular-frete";
  const FORMULARIO_URL = "https://formulario-encanto.encantoemresina7.chatgpt.site/";

  const $ = (id) => document.getElementById(id);
  const cliente = $("cliente");
  const telefoneCliente = $("telefoneCliente");
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
  const CONSULTAS_KEY = "encanto-consultas-v1";

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
    const numero = Number(frete.value.trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  function calcularValor(qtdLetras) {
    if (!Number.isInteger(qtdLetras) || qtdLetras <= 0) {
      return {
        extras: 0,
        adicional: 0,
        valor: 0,
        detalhes: []
      };
    }

    const detalhes = [];
    let adicional = 0;

    for (let posicao = 6; posicao <= qtdLetras; posicao += 1) {
      let valorLetra;

      if (posicao <= 7) {
        valorLetra = 5;
      } else if (posicao <= 9) {
        valorLetra = 7;
      } else if (posicao === 10) {
        valorLetra = 9;
      } else {
        valorLetra = 10;
      }

      adicional += valorLetra;
      detalhes.push({
        posicao,
        valor: valorLetra
      });
    }

    return {
      extras: Math.max(0, qtdLetras - LIMITE_BASE),
      adicional,
      valor: VALOR_BASE + adicional,
      detalhes
    };
  }

  function tamanhoBase(qtdLetras) {
    if (qtdLetras <= 0) return "—";
    if (qtdLetras <= 5) return "25 cm";
    if (qtdLetras <= 9) return "30 cm";
    return "35 cm";
  }

  function classeCor(cor) {
    return "cor-" + String(cor || "Transparente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function obterCards() {
    return [...listaLuminarias.querySelectorAll(".luminaria-card")];
  }

  function obterItens() {
    return obterCards().map((card, indice) => {
      const nomeInput = card.querySelector(".nome-luminaria");
      const nome = nomeInput.value.trim();
      const qtd = contarLetras(nome);

      return {
        numero: indice + 1,
        nome,
        cor: card.dataset.cor || "Transparente",
        qtd,
        base: tamanhoBase(qtd),
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

    return tabela[qtd] || {
      altura: Math.min(50, 8 * Math.ceil(qtd / 2)),
      largura: 20,
      comprimento: 30
    };
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

  function textoDetalhamento(calculo) {
    if (!calculo.detalhes.length) {
      return `<small>Até 5 letras: ${moeda(VALOR_BASE)}</small>`;
    }

    const linhas = calculo.detalhes.map((item) =>
      `<small>${item.posicao}ª letra: + ${moeda(item.valor)}</small>`
    ).join("");

    return `
      <small>Preço base: ${moeda(VALOR_BASE)}</small>
      ${linhas}
      <small class="adicional">Adicional: ${moeda(calculo.adicional)}</small>
    `;
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
        <small>${item.cor} • ${item.qtd} ${item.qtd === 1 ? "letra" : "letras"} • Base ${item.base}</small>
      </div>
    `).join("");
  }

  function atualizarCard(card) {
    const nomeInput = card.querySelector(".nome-luminaria");
    const nome = nomeInput.value.trim();
    const qtd = contarLetras(nome);
    const calculo = calcularValor(qtd);
    const previa = card.querySelector(".nome-previa");

    card.querySelector(".quantidade-info").textContent = String(qtd);
    card.querySelector(".base-info").textContent = tamanhoBase(qtd);
    card.querySelector(".valor-item").textContent = moeda(calculo.valor);
    card.querySelector(".detalhamento").innerHTML = textoDetalhamento(calculo);

    previa.textContent = nome ? nome.toUpperCase() : "SEU NOME";
    previa.className = `nome-previa ${classeCor(card.dataset.cor)}`;

    if (qtd >= 11) {
      previa.style.fontSize = "clamp(24px, 4vw, 42px)";
    } else if (qtd >= 8) {
      previa.style.fontSize = "clamp(28px, 5vw, 50px)";
    } else {
      previa.style.fontSize = "clamp(34px, 6vw, 62px)";
    }

    atualizarResumo();
  }

  function adicionarLuminaria(dados = {}) {
    const fragmento = modeloLuminaria.content.cloneNode(true);
    const card = fragmento.querySelector(".luminaria-card");
    const nomeInput = card.querySelector(".nome-luminaria");

    card.dataset.id = String(proximoId++);
    card.dataset.cor = dados.cor || "Transparente";
    nomeInput.value = dados.nome || "";

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
    prazoFreteSelecionado = Number.isFinite(Number(opcao.prazoDias))
      ? Number(opcao.prazoDias)
      : null;

    mostrarStatus(
      "sucesso",
      `${servicoFreteSelecionado} selecionado: ${moeda(Number(opcao.valor))}`
    );

    atualizarResumo();
    salvarConsulta();
  }

  function parametrosFormulario() {
    const itens = obterItens();
    const subtotal = itens.reduce((soma, item) => soma + item.valor, 0);
    const valorDoFrete = lerFrete();
    const nomes = itens.map((item) => item.nome).join(" + ");
    const cores = itens.map((item) => item.cor).join(" / ");
    return new URLSearchParams({
      cliente: cliente.value.trim(), nomeCliente: cliente.value.trim(),
      telefone: telefoneCliente.value.trim(), nomes, nomeLuminaria: nomes,
      cores, cor: cores, quantidade: String(itens.length),
      cep: cepDestino.value.replace(/\D/g, ""),
      valorProduto: subtotal.toFixed(2), valorFrete: valorDoFrete.toFixed(2),
      valorTotal: (subtotal + valorDoFrete).toFixed(2),
      servicoFrete: servicoFreteSelecionado,
      prazoFrete: prazoFreteSelecionado == null ? "" : String(prazoFreteSelecionado),
      detalhes: itens.map((item) => `${item.numero}. ${item.nome} — ${item.cor} — ${moeda(item.valor)}`).join(" | ")
    });
  }

  function lerConsultas() {
    try { return JSON.parse(localStorage.getItem(CONSULTAS_KEY) || "[]"); }
    catch { return []; }
  }

  function salvarConsulta() {
    if (!servicoFreteSelecionado) return;
    const params = parametrosFormulario();
    const chave = [params.get("nomes"), params.get("cep")].join("|");
    const consulta = {
      chave, data: new Date().toLocaleString("pt-BR"),
      cliente: params.get("cliente") || "Cliente não informado",
      nomes: params.get("nomes"), cores: params.get("cores"), cep: params.get("cep"),
      total: Number(params.get("valorTotal")),
      url: `${FORMULARIO_URL}?${params.toString()}`
    };
    const consultas = lerConsultas().filter((item) => item.chave !== chave);
    localStorage.setItem(CONSULTAS_KEY, JSON.stringify([consulta, ...consultas].slice(0, 100)));
  }

  function abrirConsultas() {
    const consultas = lerConsultas();
    if (!consultas.length) {
      alert("Nenhuma consulta salva. Calcule o frete e escolha uma opção de entrega.");
      return;
    }
    const lista = consultas.map((item, i) =>
      `${i + 1}. ${item.nomes} | ${item.cores} | ${moeda(item.total)} | ${item.data}`
    ).join("\n");
    const escolha = prompt(`CONSULTAS SALVAS\n\n${lista}\n\nDigite o número da consulta que deseja enviar:`);
    const consulta = consultas[Number(escolha) - 1];
    if (consulta) window.open(consulta.url, "_blank");
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

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível calcular o frete.");
      }

      if (!Array.isArray(dados.opcoes) || dados.opcoes.length === 0) {
        throw new Error("Nenhuma opção de frete foi encontrada.");
      }

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

    const listaTexto = itens.map((item) => {
      const detalhes = item.detalhes.length
        ? item.detalhes.map((linha) => `${linha.posicao}ª letra: + ${moeda(linha.valor)}`).join("\n")
        : "Sem letras adicionais.";

      return `
${item.numero}️⃣ ${item.nome || "Nome não informado"}
Cor: ${item.cor}
Quantidade de letras: ${item.qtd}
Tamanho da base: ${item.base}
Preço base: ${moeda(item.qtd > 0 ? VALOR_BASE : 0)}
${detalhes}
Adicional: ${moeda(item.adicional)}
Valor da luminária: ${moeda(item.valor)}`;
    }).join("\n");

    return `ORÇAMENTO DA LUMINÁRIA — ENCANTO EM RESINA

Cliente: ${cliente.value.trim() || "Não informado"}
Telefone / WhatsApp: ${telefoneCliente.value.trim() || "Não informado"}

${listaTexto}

Quantidade de luminárias: ${itens.length}
Embalagem: ${textoDimensoes()}
Subtotal: ${moeda(subtotal)}
Frete: ${moeda(valorDoFrete)}${servicoFreteSelecionado ? ` (${servicoFreteSelecionado})` : ""}
Prazo do frete: ${prazoFreteSelecionado ? `${prazoFreteSelecionado} dia(s) útil(eis)` : "Não informado"}
TOTAL: ${moeda(total)}

Prazo de produção: 6 dias úteis após a confirmação do pagamento.
Orçamento válido por 7 dias.`;
  }

  function abrirFormulario() {
    const itens = obterItens();
    const subtotal = itens.reduce((soma, item) => soma + item.valor, 0);
    const valorDoFrete = lerFrete();
    const total = subtotal + valorDoFrete;
    const cep = cepDestino.value.replace(/\D/g, "");

    if (itens.some((item) => item.qtd <= 0)) {
      alert("Preencha o nome de todas as luminárias antes de abrir o formulário.");
      return;
    }

    if (cep.length !== 8) {
      alert("Digite e calcule o frete com um CEP válido antes de abrir o formulário.");
      cepDestino.focus();
      return;
    }

    if (!servicoFreteSelecionado) {
      alert("Escolha uma opção de entrega antes de abrir o formulário.");
      return;
    }

    const params = parametrosFormulario();
    salvarConsulta();

    window.open(`${FORMULARIO_URL}?${params.toString()}`, "_blank");
  }

  $("btnAdicionar").addEventListener("click", () => {
    invalidarFrete();
    const card = adicionarLuminaria();
    card.querySelector(".nome-luminaria").focus();
  });

  cliente.addEventListener("input", atualizarResumo);

  telefoneCliente.addEventListener("input", () => {
    const numeros = telefoneCliente.value.replace(/\D/g, "").slice(0, 11);
    telefoneCliente.value = numeros.length > 10
      ? numeros.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
      : numeros.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3").replace(/-$/, "");
  });

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
      setTimeout(() => {
        $("mensagem").style.display = "none";
      }, 2500);
    } catch {
      prompt("Copie o orçamento:", montarTexto());
    }
  });

  $("btnWhatsapp").addEventListener("click", () => {
    const texto = encodeURIComponent(montarTexto());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  });

  $("btnFormulario").addEventListener("click", abrirFormulario);
  $("btnConsultas").addEventListener("click", abrirConsultas);

  $("btnLimpar").addEventListener("click", () => {
    cliente.value = "";
    telefoneCliente.value = "";
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
      navigator.serviceWorker.register("./service-worker.js").catch(console.error);
    });
  }
})();
(() => {
  "use strict";
  return; // versão antiga duplicada: mantida apenas para referência, sem execução

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
    const numero = Number(frete.value.trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  function calcularValor(qtdLetras) {
    if (!Number.isInteger(qtdLetras) || qtdLetras <= 0) {
      return {
        extras: 0,
        adicional: 0,
        valor: 0,
        detalhes: []
      };
    }

    const detalhes = [];
    let adicional = 0;

    for (let posicao = 6; posicao <= qtdLetras; posicao += 1) {
      let valorLetra;

      if (posicao <= 7) {
        valorLetra = 5;
      } else if (posicao <= 9) {
        valorLetra = 7;
      } else if (posicao === 10) {
        valorLetra = 9;
      } else {
        valorLetra = 10;
      }

      adicional += valorLetra;
      detalhes.push({
        posicao,
        valor: valorLetra
      });
    }

    return {
      extras: Math.max(0, qtdLetras - LIMITE_BASE),
      adicional,
      valor: VALOR_BASE + adicional,
      detalhes
    };
  }

  function tamanhoBase(qtdLetras) {
    if (qtdLetras <= 0) return "—";
    if (qtdLetras <= 5) return "25 cm";
    if (qtdLetras <= 9) return "30 cm";
    return "35 cm";
  }

  function classeCor(cor) {
    return "cor-" + String(cor || "Transparente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function obterCards() {
    return [...listaLuminarias.querySelectorAll(".luminaria-card")];
  }

  function obterItens() {
    return obterCards().map((card, indice) => {
      const nomeInput = card.querySelector(".nome-luminaria");
      const nome = nomeInput.value.trim();
      const qtd = contarLetras(nome);

      return {
        numero: indice + 1,
        nome,
        cor: card.dataset.cor || "Transparente",
        qtd,
        base: tamanhoBase(qtd),
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

    return tabela[qtd] || {
      altura: Math.min(50, 8 * Math.ceil(qtd / 2)),
      largura: 20,
      comprimento: 30
    };
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

  function textoDetalhamento(calculo) {
    if (!calculo.detalhes.length) {
      return `<small>Até 5 letras: ${moeda(VALOR_BASE)}</small>`;
    }

    const linhas = calculo.detalhes.map((item) =>
      `<small>${item.posicao}ª letra: + ${moeda(item.valor)}</small>`
    ).join("");

    return `
      <small>Preço base: ${moeda(VALOR_BASE)}</small>
      ${linhas}
      <small class="adicional">Adicional: ${moeda(calculo.adicional)}</small>
    `;
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
        <small>${item.cor} • ${item.qtd} ${item.qtd === 1 ? "letra" : "letras"} • Base ${item.base}</small>
      </div>
    `).join("");
  }

  function atualizarCard(card) {
    const nomeInput = card.querySelector(".nome-luminaria");
    const nome = nomeInput.value.trim();
    const qtd = contarLetras(nome);
    const calculo = calcularValor(qtd);
    const previa = card.querySelector(".nome-previa");

    card.querySelector(".quantidade-info").textContent = String(qtd);
    card.querySelector(".base-info").textContent = tamanhoBase(qtd);
    card.querySelector(".valor-item").textContent = moeda(calculo.valor);
    card.querySelector(".detalhamento").innerHTML = textoDetalhamento(calculo);

    previa.textContent = nome ? nome.toUpperCase() : "SEU NOME";
    previa.className = `nome-previa ${classeCor(card.dataset.cor)}`;

    if (qtd >= 11) {
      previa.style.fontSize = "clamp(24px, 4vw, 42px)";
    } else if (qtd >= 8) {
      previa.style.fontSize = "clamp(28px, 5vw, 50px)";
    } else {
      previa.style.fontSize = "clamp(34px, 6vw, 62px)";
    }

    atualizarResumo();
  }

  function adicionarLuminaria(dados = {}) {
    const fragmento = modeloLuminaria.content.cloneNode(true);
    const card = fragmento.querySelector(".luminaria-card");
    const nomeInput = card.querySelector(".nome-luminaria");

    card.dataset.id = String(proximoId++);
    card.dataset.cor = dados.cor || "Transparente";
    nomeInput.value = dados.nome || "";

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
    prazoFreteSelecionado = Number.isFinite(Number(opcao.prazoDias))
      ? Number(opcao.prazoDias)
      : null;

    mostrarStatus(
      "sucesso",
      `${servicoFreteSelecionado} selecionado: ${moeda(Number(opcao.valor))}`
    );

    atualizarResumo();
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

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível calcular o frete.");
      }

      if (!Array.isArray(dados.opcoes) || dados.opcoes.length === 0) {
        throw new Error("Nenhuma opção de frete foi encontrada.");
      }

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

    const listaTexto = itens.map((item) => {
      const detalhes = item.detalhes.length
        ? item.detalhes.map((linha) => `${linha.posicao}ª letra: + ${moeda(linha.valor)}`).join("\n")
        : "Sem letras adicionais.";

      return `
${item.numero}️⃣ ${item.nome || "Nome não informado"}
Cor: ${item.cor}
Quantidade de letras: ${item.qtd}
Tamanho da base: ${item.base}
Preço base: ${moeda(item.qtd > 0 ? VALOR_BASE : 0)}
${detalhes}
Adicional: ${moeda(item.adicional)}
Valor da luminária: ${moeda(item.valor)}`;
    }).join("\n");

    return `ORÇAMENTO DA LUMINÁRIA — ENCANTO EM RESINA

Cliente: ${cliente.value.trim() || "Não informado"}

${listaTexto}

Quantidade de luminárias: ${itens.length}
Embalagem: ${textoDimensoes()}
Subtotal: ${moeda(subtotal)}
Frete: ${moeda(valorDoFrete)}${servicoFreteSelecionado ? ` (${servicoFreteSelecionado})` : ""}
Prazo do frete: ${prazoFreteSelecionado ? `${prazoFreteSelecionado} dia(s) útil(eis)` : "Não informado"}
TOTAL: ${moeda(total)}

Prazo de produção: 6 dias úteis após a confirmação do pagamento.
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
      setTimeout(() => {
        $("mensagem").style.display = "none";
      }, 2500);
    } catch {
      prompt("Copie o orçamento:", montarTexto());
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
      navigator.serviceWorker.register("./service-worker.js").catch(console.error);
    });
  }
})();
