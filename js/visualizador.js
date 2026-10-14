// Visualizador em tela cheia para tabelas e figuras: pinça para ampliar, um dedo
// para mover (quando ampliado), duplo toque para ampliar/voltar. A ampliação é um
// `transform` só dentro desta camada, que corta o excesso: a página não rola de lado.

import { abrirCamada } from "./camadas.js";
import { acompanharGestos } from "./gestos.js";
import { limitar } from "./geometria.js";
import { html, icone } from "./render.js";
import { criarElemento } from "./ui.js";

const ESCALA_MAX = 5;
const FATOR_DUPLO_TOQUE = 2.5;
const MARGEM_PALCO_PX = 16;
const MARGEM_PAN_PX = 24;
const INTERVALO_DUPLO_TOQUE_MS = 300;
const DISTANCIA_DUPLO_TOQUE_PX = 30;
const MOVIMENTO_MAX_TOQUE_PX = 10;

class Visualizador {
  constructor(conteudo, rotulo) {
    this.desloc = [0, 0];
    this.ultimoToque = null;
    this.controle = new AbortController();
    this.raiz = criarElemento(html`
      <div class="visualizador" role="dialog" aria-modal="true" aria-label="${rotulo}">
        <div class="vz-topo">
          <span class="vz-dica">Pinça ou toque duplo para ampliar</span>
          <button type="button" class="botao-icone vz-fechar" data-vz="fechar" aria-label="Fechar">${icone("fechar")}</button>
        </div>
        <div class="vz-palco"><div class="vz-conteudo"></div></div>
      </div>`);
    this.palco = this.raiz.querySelector(".vz-palco");
    this.alvo = this.raiz.querySelector(".vz-conteudo");
    this.alvo.append(conteudo);
    document.body.append(this.raiz);
    document.documentElement.classList.add("com-camada");
    this.ligar();
    this.ajustarATela();
    this.fecharCamada = abrirCamada(() => this.destruir());
    this.raiz.querySelector(".vz-fechar").focus();
  }

  /** Começa com o conteúdo inteiro visível (reduzido se for maior que a tela). */
  ajustarATela() {
    const palco = this.palco.getBoundingClientRect();
    this.escalaMin = Math.min(1, (palco.width - 2 * MARGEM_PALCO_PX) / Math.max(1, this.alvo.offsetWidth));
    this.escala = this.escalaMin;
    // Conteúdo mais alto que a tela começa pelo topo (o deslocamento máximo para baixo).
    this.desloc = [0, Number.MAX_SAFE_INTEGER];
    this.aplicar();
  }

  get ampliado() {
    return this.escala > this.escalaMin * 1.05;
  }

  ligar() {
    const sinal = this.controle.signal;
    acompanharGestos(this.palco, {
      um: {
        inicio: (ponto) => { this.toque = { inicio: ponto, ultimo: ponto, moveu: false }; },
        mover: (ponto) => this.arrastar(ponto),
        fim: () => this.terminarToque(),
      },
      dois: {
        mover: ({ centro, passoEscala, deslocamento }) => this.pincar(centro, passoEscala, deslocamento),
      },
    }, sinal);
    this.raiz.addEventListener("click", (e) => {
      if (e.target.closest('[data-vz="fechar"]')) this.fecharCamada();
    }, { signal: sinal });
    this.raiz.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.fecharCamada();
    }, { signal: sinal });
  }

  /** Ponto relativo ao centro do palco (a origem do transform). */
  doCentro([x, y]) {
    const r = this.palco.getBoundingClientRect();
    return [x - (r.left + r.width / 2), y - (r.top + r.height / 2)];
  }

  arrastar(ponto) {
    const t = this.toque;
    if (!t) return;
    if (Math.hypot(ponto[0] - t.inicio[0], ponto[1] - t.inicio[1]) > MOVIMENTO_MAX_TOQUE_PX) t.moveu = true;
    this.desloc = [this.desloc[0] + ponto[0] - t.ultimo[0], this.desloc[1] + ponto[1] - t.ultimo[1]];
    this.aplicar();
    t.ultimo = ponto;
  }

  terminarToque() {
    const t = this.toque;
    this.toque = null;
    if (!t || t.moveu) return;
    const agora = performance.now();
    const anterior = this.ultimoToque;
    const duplo = anterior && agora - anterior.quando < INTERVALO_DUPLO_TOQUE_MS &&
      Math.hypot(t.inicio[0] - anterior.ponto[0], t.inicio[1] - anterior.ponto[1]) < DISTANCIA_DUPLO_TOQUE_PX;
    this.ultimoToque = duplo ? null : { quando: agora, ponto: t.inicio };
    if (duplo) this.alternarAmpliacao(t.inicio);
  }

  alternarAmpliacao(ponto) {
    if (this.ampliado) {
      this.escala = this.escalaMin;
      this.desloc = [0, 0];
    } else {
      this.ampliarEm(this.doCentro(ponto), this.escalaMin * FATOR_DUPLO_TOQUE);
    }
    this.aplicar();
  }

  /** Muda a escala mantendo parado o ponto `p` (relativo ao centro). */
  ampliarEm(p, novaEscala) {
    const escala = limitar(novaEscala, this.escalaMin, Math.max(ESCALA_MAX, this.escalaMin));
    const fator = escala / this.escala;
    this.desloc = [p[0] - (p[0] - this.desloc[0]) * fator, p[1] - (p[1] - this.desloc[1]) * fator];
    this.escala = escala;
  }

  pincar(centro, passoEscala, deslocamento) {
    this.toque = null;
    this.desloc = [this.desloc[0] + deslocamento[0], this.desloc[1] + deslocamento[1]];
    this.ampliarEm(this.doCentro(centro), this.escala * passoEscala);
    this.aplicar();
  }

  /** Só deixa mover o quanto o conteúdo ampliado passa da tela (mais uma pequena margem). */
  limitarDeslocamento() {
    const palco = this.palco.getBoundingClientRect();
    const sobraX = (this.alvo.offsetWidth * this.escala - palco.width) / 2 + MARGEM_PAN_PX;
    const sobraY = (this.alvo.offsetHeight * this.escala - palco.height) / 2 + MARGEM_PAN_PX;
    const folgaX = Math.max(0, sobraX);
    const folgaY = Math.max(0, sobraY);
    this.desloc = [limitar(this.desloc[0], -folgaX, folgaX), limitar(this.desloc[1], -folgaY, folgaY)];
  }

  aplicar() {
    this.limitarDeslocamento();
    this.alvo.style.transform = `translate(${this.desloc[0]}px, ${this.desloc[1]}px) scale(${this.escala})`;
    this.raiz.classList.toggle("ampliado", this.ampliado);
  }

  destruir() {
    this.controle.abort();
    this.raiz.remove();
    document.documentElement.classList.remove("com-camada");
  }
}

/**
 * Tocar numa tabela ou figura (marcadas com data-ampliar) dentro de `raiz` abre o
 * visualizador com uma cópia dela.
 */
export function ampliarAoTocar(raiz, sinal) {
  raiz.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-ampliar]");
    if (!alvo || !raiz.contains(alvo)) return;
    const copia = alvo.cloneNode(true);
    copia.removeAttribute("data-ampliar");
    copia.removeAttribute("tabindex");
    copia.querySelectorAll(".ampliar-dica").forEach((dica) => dica.remove());
    new Visualizador(copia, alvo.dataset.ampliar);
  }, { signal: sinal });
}
