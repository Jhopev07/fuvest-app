// Cronômetro que só corre com o app visível. A cada tique entrega o tempo
// decorrido desde o tique anterior; quando a página some, contabiliza o trecho
// final e para. Quem usa decide onde somar (tempo da prova, tempo da questão).

const INTERVALO_TIQUE_MS = 1000;

export class Cronometro {
  constructor(aoPassar) {
    this.aoPassar = aoPassar;
    this.ultimo = null;
    this.intervalo = null;
  }

  ligar(sinal) {
    document.addEventListener("visibilitychange", () => this.reagirVisibilidade(), { signal: sinal });
    sinal.addEventListener("abort", () => this.desligar());
    if (document.visibilityState === "visible") this.retomar();
  }

  reagirVisibilidade() {
    if (document.visibilityState === "visible") this.retomar();
    else this.pausar();
  }

  retomar() {
    if (this.intervalo) return;
    this.ultimo = performance.now();
    this.intervalo = setInterval(() => this.registrarTrecho(), INTERVALO_TIQUE_MS);
  }

  pausar() {
    if (!this.intervalo) return;
    this.registrarTrecho();
    clearInterval(this.intervalo);
    this.intervalo = null;
  }

  desligar() {
    this.pausar();
  }

  /** Contabiliza o tempo até agora sem parar (ex.: antes de trocar de questão). */
  registrarTrecho() {
    if (this.ultimo === null) return;
    const agora = performance.now();
    const delta = agora - this.ultimo;
    this.ultimo = agora;
    if (delta > 0) this.aoPassar(delta);
  }
}
