// Enquadramento da folha infinita: qual pedaço dela aparece na tela e com que zoom.
// (x, y) é o ponto da folha no canto superior esquerdo da área visível; a folha usa
// a mesma unidade que px de tela com zoom 1. Tudo aqui é matemática pura.

import { limitar } from "../geometria.js";

const ESCALA_MIN = 0.5;
const ESCALA_MAX = 4;
const TELAS_ALEM_DO_CONTEUDO = 2; // quanto dá para rolar abaixo do último traço

export class VistaDaFolha {
  constructor({ escala = 1, x = 0, y = 0 } = {}) {
    this.escala = escala;
    this.x = x;
    this.y = y;
  }

  /** Ponto da área visível (px) → ponto da folha. */
  paraFolha([px, py]) {
    return [this.x + px / this.escala, this.y + py / this.escala];
  }

  /** Retângulo da folha que está visível numa área de largura × altura px. */
  retanguloVisivel(largura, altura) {
    return { x0: this.x, y0: this.y, x1: this.x + largura / this.escala, y1: this.y + altura / this.escala };
  }

  /**
   * Pinça com dois dedos: o ponto da folha que estava sob o centro anterior dos dedos
   * fica sob o centro atual, já na escala nova (zoom e pan no mesmo gesto).
   */
  pincar(centro, passoEscala, deslocamento) {
    const centroAnterior = [centro[0] - deslocamento[0], centro[1] - deslocamento[1]];
    const ancora = this.paraFolha(centroAnterior);
    this.escala = limitar(this.escala * passoEscala, ESCALA_MIN, ESCALA_MAX);
    this.x = ancora[0] - centro[0] / this.escala;
    this.y = ancora[1] - centro[1] / this.escala;
  }

  /** Rolagem em px de tela (roda do mouse). */
  rolar(dx, dy) {
    this.x += dx / this.escala;
    this.y += dy / this.escala;
  }

  /** Volta ao zoom 100% sem perder a altura da folha que estava no meio da tela. */
  zoomNormal(altura) {
    const meio = this.y + altura / 2 / this.escala;
    this.escala = 1;
    this.x = 0;
    this.y = meio - altura / 2;
  }

  /**
   * Mantém a vista dentro da folha: não passa da margem esquerda nem do topo; à direita
   * vai até o traço mais distante; para baixo, até algumas telas além do último traço.
   * `conteudo` = {x1, y1} dos traços (ou null se a folha está vazia).
   */
  limitar(largura, altura, conteudo) {
    const visivelX = largura / this.escala;
    const visivelY = altura / this.escala;
    const larguraFolha = Math.max(largura, conteudo?.x1 ?? 0);
    const fundoFolha = (conteudo?.y1 ?? 0) + visivelY * TELAS_ALEM_DO_CONTEUDO;
    this.x = limitar(this.x, 0, Math.max(0, larguraFolha - visivelX));
    this.y = limitar(this.y, 0, Math.max(0, fundoFolha - visivelY));
  }
}
