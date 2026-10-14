// Modo simulado: 80 questões em ordem de prova, sem feedback até a entrega.
// O estado vive no IndexedDB e é salvo continuamente; o tempo só corre com o app visível.

import {
  AREAS, INTERVALO_SALVAR_SIMULADO_MS, LETRAS, ORDEM_AREAS, SIMULADO, areaDaMateria,
} from "../config.js";
import { planejarSimulado, questaoPorId } from "../banco.js";
import {
  apagarAndamento, listarTentativas, obterAndamento, registrarTentativas, salvarAndamento, salvarSessao,
} from "../db.js";
import { contarVezesVista } from "../estatisticas.js";
import { Cronometro } from "../cronometro.js";
import { CadernoDeRascunhos, fecharRascunho } from "../rascunho.js";
import { rotaPara, substituirPor } from "../navegacao.js";
import { html, montar, icone } from "../render.js";
import { aoAgir, avisar, barraTopo, confirmar, criarElemento } from "../ui.js";
import {
  alternarRevisar, corrigirSimulado, faixasPorArea, irParaQuestao, marcarResposta, novoSimulado,
  resumoDoSimulado, ritmoMinPorQuestao, tempoRestanteMs,
} from "../simulado-estado.js";
import { botaoRascunho, cabecalhoQuestao, corpoQuestao, listaAlternativas } from "../vista-questao.js";
import { formatarDecimal, formatarDuracao, formatarRelogio, plural } from "../util.js";

const ATRASO_SALVAR_MS = 400;

function areaDoItem(qid) {
  const q = questaoPorId(qid);
  return q ? areaDaMateria(q.materia) : "linguagens";
}

// ---------- Tela de abertura ----------

function telaAbertura(plano) {
  const porArea = ORDEM_AREAS.map((area) => ({
    area,
    total: plano.questoes.filter((q) => areaDaMateria(q.materia) === area).length,
  }));
  return html`
    ${barraTopo({ titulo: "Simulado Fuvest" })}
    <div class="pagina abertura-simulado">
      <h2 class="abertura-titulo">${plural(plano.questoes.length, "questão", "questões")}, 5 horas</h2>
      <ul class="abertura-areas">
        ${porArea.map((a) => html`<li class="area-${a.area}"><span>${AREAS[a.area].nome}</span><strong>${a.total}</strong></li>`)}
      </ul>
      <ul class="abertura-regras">
        <li>Sem resposta certa nem explicação até você entregar.</li>
        <li>O relógio só corre com o app aberto. Pode fazer em partes: fechar e voltar continua de onde parou.</li>
        <li>Meta de ritmo: ${formatarDecimal(SIMULADO.metaMinPorQuestao, 2)} min por questão.</li>
        <li>${plano.ineditas === plano.questoes.length
          ? "Todas as questões são inéditas para você."
          : `${plano.ineditas} questões inéditas; as demais são as que você viu menos vezes.`}</li>
      </ul>
      ${plano.avisos.length ? html`
        <div class="caixa-aviso" role="note">
          ${icone("aviso")}
          <div>${plano.avisos.map((a) => html`<p>${a}</p>`)}</div>
        </div>` : ""}
      <div class="barra-inferior">
        <button type="button" class="botao botao-primario botao-largo" data-acao="comecar"
          ${plano.questoes.length ? "" : "disabled"}>Começar simulado</button>
      </div>
    </div>`;
}

// ---------- Tela de prova ----------

function faixaTempo(sim) {
  const restante = tempoRestanteMs(sim);
  const ritmo = ritmoMinPorQuestao(sim);
  const acimaDaMeta = ritmo > SIMULADO.metaMinPorQuestao;
  return html`
    <dl class="faixa-tempo" id="faixa-tempo">
      <div><dt>restam</dt><dd class="${restante < 0 ? "estourado" : ""}">${restante < 0 ? `−${formatarDuracao(-restante)}` : formatarDuracao(restante)}</dd></div>
      <div><dt>ritmo</dt><dd class="${acimaDaMeta ? "acima-meta" : ""}">${ritmo ? `${formatarDecimal(ritmo)} min/q` : "–"}</dd></div>
      <div><dt>meta</dt><dd>${formatarDecimal(SIMULADO.metaMinPorQuestao, 2)} min/q</dd></div>
    </dl>`;
}

function relogio(sim) {
  return html`<span class="relogio" id="relogio" role="timer" aria-label="Tempo de prova usado">
    ${icone("relogio")}<span id="relogio-valor">${formatarRelogio(sim.tempoMs)}</span></span>`;
}

function telaProva(sim) {
  const item = sim.itens[sim.atual];
  const q = questaoPorId(item.qid);
  const numero = sim.atual + 1;
  const ultima = numero === sim.itens.length;
  return html`
    ${barraTopo({ titulo: `Simulado ${numero}/${sim.itens.length}`, voltar: "#/", direita: relogio(sim) })}
    ${faixaTempo(sim)}
    <article class="pagina questao simulado" data-qid="${item.qid}" data-numero="${numero}">
      ${q ? html`
        ${cabecalhoQuestao(q, numero)}
        ${corpoQuestao(q)}
        ${listaAlternativas(q, item.ordem, { escolhida: item.escolhida })}`
        : html`<p class="vazio">Esta questão saiu do banco. Pule para a próxima.</p>`}
      <button type="button" class="botao-revisar ${item.revisar ? "ativo" : ""}" data-acao="revisar" aria-pressed="${item.revisar}">
        ${icone("bandeira")}${item.revisar ? "Marcada para revisar" : "Marcar para revisar"}
      </button>
    </article>
    ${botaoRascunho()}
    <nav class="barra-inferior barra-simulado" aria-label="Navegação da prova">
      <button type="button" class="botao botao-secundario" data-acao="anterior" ${sim.atual === 0 ? "disabled" : ""} aria-label="Questão anterior">
        ${icone("anterior")}</button>
      <button type="button" class="botao botao-secundario botao-grade" data-acao="grade">
        ${icone("grade")}<span>Folha de respostas</span></button>
      ${ultima
        ? html`<button type="button" class="botao botao-primario" data-acao="entregar">Entregar</button>`
        : html`<button type="button" class="botao botao-primario" data-acao="proxima" aria-label="Próxima questão">${icone("proxima")}</button>`}
    </nav>`;
}

// ---------- Folha de respostas (grade com os 80 números) ----------

function linhaFolha(item, indice, atual) {
  const classes = [
    "folha-linha",
    item.escolhida === null ? "em-branco" : "respondida",
    item.revisar ? "marcada" : "",
    indice === atual ? "atual" : "",
  ].join(" ");
  const posicaoMarcada = item.escolhida === null ? -1 : item.ordem.indexOf(item.escolhida);
  const estado = item.escolhida === null ? "em branco" : `marcou ${LETRAS[posicaoMarcada]}`;
  return html`
    <li>
      <button type="button" class="${classes}" data-acao="ir" data-indice="${indice}"
        aria-label="Questão ${indice + 1}, ${estado}${item.revisar ? ", marcada para revisar" : ""}">
        <span class="folha-numero">${String(indice + 1).padStart(2, "0")}</span>
        <span class="folha-bolhas" aria-hidden="true">
          ${LETRAS.map((letra, p) => html`<span class="folha-bolha ${p === posicaoMarcada ? "cheia" : ""}">${letra}</span>`)}
        </span>
      </button>
    </li>`;
}

function folhaDeRespostas(sim) {
  const resumo = resumoDoSimulado(sim);
  const faixas = faixasPorArea(sim, areaDoItem);
  return html`
    <dialog class="folha" aria-label="Folha de respostas">
      <header class="folha-topo">
        <h2>Folha de respostas</h2>
        <button type="button" class="botao-icone" data-acao="fechar-folha" aria-label="Fechar">${icone("fechar")}</button>
      </header>
      <p class="folha-resumo">
        <span><strong>${resumo.respondidas}</strong> respondidas</span>
        <span><strong>${resumo.emBranco}</strong> em branco</span>
        <span class="folha-legenda-revisar"><strong>${resumo.marcadas}</strong> para revisar</span>
      </p>
      <div class="folha-corpo">
        ${faixas.map((f) => html`
          <section class="folha-area area-${f.area}">
            <h3>${AREAS[f.area].nome} <small>${f.inicio + 1}–${f.fim + 1}</small></h3>
            <ol class="folha-grade">${sim.itens.slice(f.inicio, f.fim + 1).map((item, k) => linhaFolha(item, f.inicio + k, sim.atual))}</ol>
          </section>`)}
      </div>
      <footer class="folha-rodape">
        <button type="button" class="botao botao-texto" data-acao="descartar">Descartar simulado</button>
        <button type="button" class="botao botao-primario" data-acao="entregar">Entregar prova</button>
      </footer>
    </dialog>`;
}

// ---------- Controle ----------

function criarSalvador(sim) {
  let agendado = null;
  async function salvarAgora() {
    clearTimeout(agendado);
    agendado = null;
    if (sim.encerrado) return;
    try {
      await salvarAndamento(sim);
    } catch (erro) {
      console.error(erro);
      avisar("Não foi possível salvar o simulado neste aparelho.");
    }
  }
  function agendar() {
    if (!agendado) agendado = setTimeout(salvarAgora, ATRASO_SALVAR_MS);
  }
  return { salvarAgora, agendar };
}

function atualizarRelogio(raiz, sim) {
  const valor = raiz.querySelector("#relogio-valor");
  if (valor) valor.textContent = formatarRelogio(sim.tempoMs);
  const faixa = raiz.querySelector("#faixa-tempo");
  if (faixa) faixa.replaceWith(criarElemento(faixaTempo(sim)));
}


function atualizarAlternativas(raiz, escolhida) {
  raiz.querySelectorAll('[data-acao="escolher"]').forEach((botao) => {
    const marcada = Number(botao.dataset.original) === escolhida;
    botao.classList.toggle("alt-marcada", marcada);
    botao.setAttribute("aria-pressed", String(marcada));
  });
}

function iniciarProva(raiz, { sinal, aoSair }, sim) {
  const salvador = criarSalvador(sim);
  const rascunhos = new CadernoDeRascunhos(sim.rascunhos ?? {}, (porQuestao) => {
    sim.rascunhos = porQuestao;
    salvador.agendar();
  });
  const cronometro = new Cronometro((ms) => {
    sim.tempoMs += ms;
    sim.itens[sim.atual].tempoMs += ms;
    atualizarRelogio(raiz, sim);
  });
  cronometro.ligar(sinal);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") salvador.salvarAgora();
  }, { signal: sinal });
  window.addEventListener("pagehide", () => salvador.salvarAgora(), { signal: sinal });
  const intervalo = setInterval(() => salvador.salvarAgora(), INTERVALO_SALVAR_SIMULADO_MS);
  sinal.addEventListener("abort", () => clearInterval(intervalo));

  function exibir() {
    montar(raiz, telaProva(sim));
  }

  function navegar(indice) {
    fecharRascunho();
    cronometro.registrarTrecho();
    irParaQuestao(sim, indice);
    salvador.agendar();
    exibir();
    window.scrollTo(0, 0);
  }

  function abrirFolha() {
    const folha = criarElemento(folhaDeRespostas(sim));
    const controleFolha = new AbortController();
    const fechar = () => folha.open && folha.close();
    document.body.append(folha);
    folha.addEventListener("close", () => {
      controleFolha.abort();
      folha.remove();
    });
    sinal.addEventListener("abort", fechar, { signal: controleFolha.signal });
    aoAgir(folha, controleFolha.signal, {
      "fechar-folha": fechar,
      ir: (botao) => { fechar(); navegar(Number(botao.dataset.indice)); },
      entregar: () => { fechar(); entregar(); },
      descartar: () => { fechar(); descartar(); },
    });
    folha.showModal();
    folha.querySelector(".folha-linha.atual")?.scrollIntoView({ block: "center" });
  }

  async function entregar() {
    const { emBranco } = resumoDoSimulado(sim);
    const ok = await confirmar({
      titulo: "Entregar a prova?",
      mensagem: emBranco
        ? `${plural(emBranco, "questão está", "questões estão")} em branco. Na Fuvest, chutar não tira ponto.`
        : "Todas as questões estão respondidas.",
      sim: "Entregar",
      nao: "Voltar à prova",
    });
    if (!ok) return;
    cronometro.registrarTrecho();
    sim.encerrado = true;
    const { sessao, tentativas } = corrigirSimulado(sim, questaoPorId);
    try {
      await salvarSessao(sessao);
      await registrarTentativas(tentativas);
      await apagarAndamento();
    } catch (erro) {
      console.error(erro);
      sim.encerrado = false;
      avisar("Não foi possível salvar o resultado. Tente entregar de novo.");
      return;
    }
    substituirPor(rotaPara("resultado", sessao.id));
  }

  async function descartar() {
    const ok = await confirmar({
      titulo: "Descartar este simulado?",
      mensagem: "As respostas e o tempo serão apagados e não entram no histórico.",
      sim: "Descartar",
      nao: "Continuar a prova",
      perigo: true,
    });
    if (!ok) return;
    sim.encerrado = true;
    await apagarAndamento().catch((erro) => console.error(erro));
    substituirPor("#/");
  }

  aoAgir(raiz, sinal, {
    escolher: (botao) => {
      marcarResposta(sim, sim.atual, Number(botao.dataset.original));
      atualizarAlternativas(raiz, sim.itens[sim.atual].escolhida);
      salvador.agendar();
    },
    revisar: () => {
      alternarRevisar(sim, sim.atual);
      salvador.agendar();
      exibir();
    },
    anterior: () => navegar(sim.atual - 1),
    proxima: () => navegar(sim.atual + 1),
    grade: () => abrirFolha(),
    entregar: () => entregar(),
    rascunho: () => rascunhos.abrir(sim.itens[sim.atual].qid),
  });

  aoSair(async () => {
    cronometro.desligar();
    await salvador.salvarAgora();
  });
  exibir();
  salvador.salvarAgora();
}

export async function mostrar(raiz, contexto) {
  const andamento = await obterAndamento();
  if (andamento) {
    iniciarProva(raiz, contexto, andamento);
    return;
  }
  const plano = planejarSimulado(contarVezesVista(await listarTentativas()));
  montar(raiz, telaAbertura(plano));
  const comecar = new AbortController();
  contexto.sinal.addEventListener("abort", () => comecar.abort());
  aoAgir(raiz, comecar.signal, {
    comecar: () => {
      comecar.abort();
      iniciarProva(raiz, contexto, novoSimulado(plano));
      raiz.querySelector("h1")?.focus({ preventScroll: true });
    },
  });
}
