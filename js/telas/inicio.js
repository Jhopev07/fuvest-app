// Tela inicial: contagem regressiva, resumo do progresso e atalhos.

import { DATA_PROVA } from "../config.js";
import { listarTentativas, obterAndamento } from "../db.js";
import { contarPorMateria } from "../banco.js";
import { desempenhoPorMateria, filaDeErros, resumoGeral } from "../estatisticas.js";
import { html, montar, icone } from "../render.js";
import { barraProgresso } from "../ui.js";
import { resumoDoSimulado } from "../simulado-estado.js";
import { classeArea } from "../vista-questao.js";
import { diasAte, formatarDuracao, formatarPercentual, plural } from "../util.js";

function frasePrazo() {
  const dias = diasAte(DATA_PROVA);
  if (dias > 1) return `Faltam ${dias} dias para a prova, em 1º de novembro.`;
  if (dias === 1) return "A prova é amanhã. Descanse bem.";
  if (dias === 0) return "Hoje é dia de prova. Boa sorte!";
  return "Bons estudos.";
}

function cabecalho() {
  return html`
    <header class="inicio-topo">
      <div>
        <h1 tabindex="-1">Fuvest 1ª fase</h1>
        <p class="inicio-prazo">${frasePrazo()}</p>
      </div>
      <a class="botao-icone" href="#/ajustes" aria-label="Ajustes e backup">${icone("ajustes")}</a>
    </header>`;
}

function cartaoContinuar(andamento) {
  if (!andamento) return "";
  const { respondidas, total } = resumoDoSimulado(andamento);
  return html`
    <a class="cartao-continuar" href="#/simulado">
      <span class="continuar-titulo">Continuar simulado</span>
      <span class="continuar-detalhe">${respondidas} de ${total} respondidas, ${formatarDuracao(andamento.tempoMs)} de prova</span>
      ${barraProgresso(respondidas / total, `${respondidas} de ${total} respondidas`)}
    </a>`;
}

function numeros(resumo) {
  return html`
    <dl class="numeros">
      <div><dt>respondidas</dt><dd>${resumo.total}</dd></div>
      <div><dt>de acerto</dt><dd>${resumo.total ? formatarPercentual(resumo.taxa) : "–"}</dd></div>
      <div><dt>${resumo.sequencia === 1 ? "dia seguido" : "dias seguidos"}</dt><dd>${resumo.sequencia}</dd></div>
    </dl>`;
}

function acoes(andamento, errosPendentes) {
  return html`
    <nav class="acoes" aria-label="Modos de estudo">
      <a class="acao acao-principal" href="#/filtros">
        <span class="acao-titulo">Questões aleatórias</span>
        <span class="acao-detalhe">Prática com resposta e explicação na hora</span>
      </a>
      ${andamento ? "" : html`
        <a class="acao acao-prova" href="#/simulado">
          <span class="acao-titulo">Simulado Fuvest — 80 questões</span>
          <span class="acao-detalhe">Prova completa, 5 horas, sem feedback até entregar</span>
        </a>`}
      <a class="acao" href="#/erros">
        <span class="acao-titulo">Revisar erros</span>
        <span class="acao-detalhe">${errosPendentes ? plural(errosPendentes, "questão", "questões") + " para refazer" : "Nenhum erro pendente"}</span>
      </a>
      <div class="acoes-par">
        <a class="acao acao-compacta" href="#/historico"><span class="acao-titulo">Histórico</span></a>
        <a class="acao acao-compacta" href="#/ajustes"><span class="acao-titulo">Ajustes e backup</span></a>
      </div>
    </nav>`;
}

function linhaMateria(placar, noBanco) {
  const temDados = placar.total > 0;
  return html`
    <li class="linha-materia ${classeArea(placar.materia)}">
      <span class="lm-nome">${placar.nome}</span>
      ${barraProgresso(placar.taxa, temDados ? `${formatarPercentual(placar.taxa)} de acerto` : "sem tentativas")}
      <span class="lm-valor">${temDados ? formatarPercentual(placar.taxa) : "–"}</span>
      <span class="lm-detalhe">${placar.acertos}/${placar.total} certas, ${noBanco} no banco</span>
    </li>`;
}

function desempenho(tentativas) {
  const noBanco = contarPorMateria();
  const placares = desempenhoPorMateria(tentativas).filter((p) => noBanco[p.materia] > 0 || p.total > 0);
  return html`
    <section class="secao">
      <h2>Desempenho por matéria</h2>
      ${tentativas.length === 0
        ? html`<p class="vazio">Responda algumas questões e o acerto de cada matéria aparece aqui.</p>`
        : html`<ul class="lista-materias">${placares.map((p) => linhaMateria(p, noBanco[p.materia]))}</ul>`}
    </section>`;
}

export async function mostrar(raiz) {
  const [tentativas, andamento] = await Promise.all([listarTentativas(), obterAndamento()]);
  const resumo = resumoGeral(tentativas);
  const errosPendentes = filaDeErros(tentativas).length;
  montar(raiz, html`
    <div class="pagina inicio">
      ${cabecalho()}
      ${cartaoContinuar(andamento)}
      ${numeros(resumo)}
      ${acoes(andamento, errosPendentes)}
      ${desempenho(tentativas)}
    </div>`);
}
