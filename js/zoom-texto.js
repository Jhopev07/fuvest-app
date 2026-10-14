// Tamanho do texto das questões (zoom de leitura). Muda a variável CSS --texto-questao,
// então o texto refaz as quebras de linha: nunca há rolagem horizontal. Vale para
// todas as telas de questão e fica salvo no aparelho.

import { gravarLocal, lerNumeroLocal } from "./armazenamento-local.js";
import { distancia, limitar } from "./geometria.js";
import { html } from "./render.js";

const TAMANHO_MIN = 14;
const TAMANHO_MAX = 28;
const TAMANHO_PADRAO = 17;
const PASSO = 2;
const CHAVE = "fuvest-texto-questao";
const VARIAVEL = "--texto-questao";
const DISTANCIA_MIN_PINCA = 24;

let tamanho = lerNumeroLocal(CHAVE, TAMANHO_PADRAO, TAMANHO_MIN, TAMANHO_MAX);

function aplicar() {
  document.documentElement.style.setProperty(VARIAVEL, `${tamanho}px`);
  document.querySelectorAll('[data-acao="texto-menor"]').forEach((b) => { b.disabled = tamanho <= TAMANHO_MIN; });
  document.querySelectorAll('[data-acao="texto-maior"]').forEach((b) => { b.disabled = tamanho >= TAMANHO_MAX; });
}

export function aplicarTamanhoSalvo() {
  aplicar();
}

/** Define o tamanho (px). `salvar: false` durante a pinça, para gravar só no fim. */
function definirTamanho(valor, { salvar = true } = {}) {
  tamanho = Math.round(limitar(valor, TAMANHO_MIN, TAMANHO_MAX) * 2) / 2;
  aplicar();
  if (salvar) gravarLocal(CHAVE, tamanho);
}

/** A−/A+ andam de 2 em 2 px, alinhados a números pares. */
export function mudarTamanho(direcao) {
  const base = direcao > 0 ? Math.floor(tamanho / PASSO) * PASSO : Math.ceil(tamanho / PASSO) * PASSO;
  definirTamanho(base + direcao * PASSO);
}

export function controlesDeTexto() {
  return html`
    <div class="zoom-texto" role="group" aria-label="Tamanho do texto">
      <button type="button" class="botao-icone botao-zoom" data-acao="texto-menor" aria-label="Diminuir texto"
        ${tamanho <= TAMANHO_MIN ? "disabled" : ""}><span aria-hidden="true">A−</span></button>
      <button type="button" class="botao-icone botao-zoom maior" data-acao="texto-maior" aria-label="Aumentar texto"
        ${tamanho >= TAMANHO_MAX ? "disabled" : ""}><span aria-hidden="true">A+</span></button>
    </div>`;
}

function pontos(toques) {
  return [...toques].slice(0, 2).map((t) => [t.clientX, t.clientY]);
}

/**
 * Pinça com dois dedos sobre `elemento` muda o tamanho do texto. Usa Touch Events
 * e só cancela o comportamento do navegador quando há dois dedos: a rolagem com um
 * dedo continua nativa. `roladorAtual()` diz quem rola o texto (a página, por
 * padrão), que acompanha o crescimento para o trecho sob os dedos ficar no lugar.
 */
export function pincaNoTexto(elemento, sinal, roladorAtual = () => document.scrollingElement) {
  let inicio = null;

  function topoDo(rolador) {
    return rolador === document.scrollingElement ? 0 : rolador.getBoundingClientRect().top;
  }

  function aoComecar(e) {
    if (e.touches.length !== 2) return;
    const [a, b] = pontos(e.touches);
    const rolador = roladorAtual();
    inicio = {
      rolador,
      distancia: Math.max(DISTANCIA_MIN_PINCA, distancia(a, b)),
      tamanho,
      centroY: (a[1] + b[1]) / 2 - topoDo(rolador),
      rolagem: rolador.scrollTop,
    };
  }

  function aoMover(e) {
    if (!inicio || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    const [a, b] = pontos(e.touches);
    const anterior = tamanho;
    definirTamanho(inicio.tamanho * (distancia(a, b) / inicio.distancia), { salvar: false });
    if (tamanho !== anterior) {
      const proporcao = tamanho / inicio.tamanho;
      inicio.rolador.scrollTop = (inicio.rolagem + inicio.centroY) * proporcao - inicio.centroY;
    }
  }

  function aoTerminar(e) {
    if (!inicio || e.touches.length >= 2) return;
    inicio = null;
    definirTamanho(tamanho);
  }

  const opcoes = { signal: sinal };
  elemento.addEventListener("touchstart", aoComecar, { ...opcoes, passive: true });
  elemento.addEventListener("touchmove", aoMover, { ...opcoes, passive: false });
  elemento.addEventListener("touchend", aoTerminar, opcoes);
  elemento.addEventListener("touchcancel", aoTerminar, opcoes);
}
