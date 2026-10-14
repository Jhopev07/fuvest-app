// Peças de interface de uma questão, compartilhadas por prática, simulado e revisão.

import { LETRAS, NIVEIS, areaDaMateria, nomeMateria } from "./config.js";
import { letraDe } from "./letras.js";
import { html, textoInline, textoRico, tabela, figuraSvg, icone } from "./render.js";

export function classeArea(materia) {
  return `area-${areaDaMateria(materia)}`;
}

export function chipMateria(materia) {
  return html`<span class="chip-materia ${classeArea(materia)}">${nomeMateria(materia)}</span>`;
}

function seloNivel(nivel) {
  const classe = nivel === "acima" ? "selo-acima" : "selo-fuvest";
  return html`<span class="selo ${classe}">${NIVEIS[nivel] ?? nivel}</span>`;
}

function marcaInterdisciplinar(inter) {
  if (!Array.isArray(inter) || inter.length === 0) return "";
  const nomes = inter.map(nomeMateria).join(", ");
  return html`<span class="marca-inter" title="Interdisciplinar: ${nomes}">
    ${icone("inter")}<span>com ${nomes}</span></span>`;
}

export function cabecalhoQuestao(q, numero = null) {
  return html`
    <header class="q-cabecalho">
      <div class="q-etiquetas">
        ${numero !== null ? html`<span class="q-numero">${numero}</span>` : ""}
        ${chipMateria(q.materia)}
        ${seloNivel(q.nivel)}
      </div>
      <p class="q-tema">${q.tema}</p>
      <p class="q-origem">${q.origem}${marcaInterdisciplinar(q.inter)}</p>
    </header>`;
}

export function corpoQuestao(q) {
  return html`
    ${q.texto ? html`<section class="q-texto" aria-label="Texto de apoio">${textoRico(q.texto)}</section>` : ""}
    ${tabela(q.tabela)}
    ${figuraSvg(q.svg)}
    <div class="q-enunciado">${textoRico(q.enunciado)}</div>`;
}

function classeRevelada(q, original, escolhida) {
  if (original === q.correta) return "alt-certa";
  if (original === escolhida) return "alt-errada";
  return "alt-neutra";
}

function alternativaRevelada(q, original, posicao, escolhida) {
  const motivo = original !== q.correta ? q.erradas?.[original] : "";
  return html`
    <li class="alt ${classeRevelada(q, original, escolhida)}">
      <span class="bolha" aria-hidden="true">${LETRAS[posicao]}</span>
      <span class="alt-corpo">
        <span class="alt-texto">${textoInline(q.alternativas[original])}</span>
        ${motivo ? html`<span class="alt-motivo">${textoInline(motivo)}</span>` : ""}
      </span>
    </li>`;
}

function alternativaAberta(q, original, posicao, escolhida) {
  const marcada = original === escolhida;
  return html`
    <li>
      <button type="button" class="alt ${marcada ? "alt-marcada" : ""}" data-acao="escolher"
        data-original="${original}" aria-pressed="${marcada}">
        <span class="bolha" aria-hidden="true">${LETRAS[posicao]}</span>
        <span class="alt-corpo"><span class="alt-texto">${textoInline(q.alternativas[original])}</span></span>
      </button>
    </li>`;
}

/**
 * Lista de alternativas na ordem embaralhada.
 * `revelar` mostra certa/errada e o motivo de cada errada.
 */
export function listaAlternativas(q, ordem, { escolhida = null, revelar = false } = {}) {
  const itens = ordem.map((original, posicao) => (revelar
    ? alternativaRevelada(q, original, posicao, escolhida)
    : alternativaAberta(q, original, posicao, escolhida)));
  return html`<ol class="alternativas ${revelar ? "reveladas" : ""}" aria-label="Alternativas">${itens}</ol>`;
}

function mensagemResultado(q, ordem, escolhida, respondida) {
  const letraCerta = letraDe(ordem, q.correta);
  if (!respondida) return { classe: "resultado-branco", texto: `A resposta é ${letraCerta}` };
  if (escolhida === q.correta) return { classe: "resultado-certo", texto: "Acertou!" };
  if (escolhida === null || escolhida === undefined) {
    return { classe: "resultado-branco", texto: `Em branco — a resposta é ${letraCerta}` };
  }
  return { classe: "resultado-errado", texto: `Errou — a resposta é ${letraCerta}` };
}

/** `respondida: false` é a consulta de uma questão sem tentativa (só mostra a resposta). */
export function blocoFeedback(q, ordem, escolhida, { respondida = true } = {}) {
  const { classe, texto } = mensagemResultado(q, ordem, escolhida, respondida);
  return html`
    <section class="feedback" aria-live="polite">
      <p class="resultado ${classe}" id="resultado-questao">${icone(classe === "resultado-errado" ? "fechar" : "check")}${texto}</p>
      <div class="explicacao">
        <h2>Explicação</h2>
        ${textoRico(q.explicacao)}
      </div>
    </section>`;
}

export function botaoRascunho() {
  return html`<button type="button" class="botao-rascunho" data-acao="rascunho" aria-label="Abrir rascunho">
    ${icone("lapis")}</button>`;
}
