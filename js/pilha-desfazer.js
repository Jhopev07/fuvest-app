// Desfazer e refazer para estados imutáveis (cada estado é uma lista de traços).

const LIMITE_PADRAO = 100;

export class PilhaDeDesfazer {
  constructor(limite = LIMITE_PADRAO) {
    this.limite = limite;
    this.passado = [];
    this.futuro = [];
  }

  /** Guarda o estado de ANTES de uma mudança. Uma mudança nova apaga o que dava para refazer. */
  registrar(estadoAnterior) {
    this.passado.push(estadoAnterior);
    if (this.passado.length > this.limite) this.passado.shift();
    this.futuro = [];
  }

  desfazer(estadoAtual) {
    if (!this.passado.length) return null;
    this.futuro.push(estadoAtual);
    return this.passado.pop();
  }

  refazer(estadoAtual) {
    if (!this.futuro.length) return null;
    this.passado.push(estadoAtual);
    return this.futuro.pop();
  }

  esvaziar() {
    this.passado = [];
    this.futuro = [];
  }

  get podeDesfazer() {
    return this.passado.length > 0;
  }

  get podeRefazer() {
    return this.futuro.length > 0;
  }
}
