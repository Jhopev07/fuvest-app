// Quadro de escrita: a folha infinita num canvas. Um dedo (ou caneta) desenha;
// dois dedos movem e dão zoom. Os traços são vetores na unidade da folha e são
// redesenhados na escala atual, então continuam nítidos com qualquer zoom.

import { acompanharGestos } from "../gestos.js";
import { retangulosSeCruzam } from "../geometria.js";
import { PilhaDeDesfazer } from "../pilha-desfazer.js";
import { caneta } from "./ferramentas.js";
import {
  RAIO_BORRACHA_PX, acrescentarPonto, apagarTocados, arredondar, coresDoTema, desenharBorracha,
  desenharFinalDoTraco, desenharTraco, limitesDoTraco, novoTraco,
} from "./tracos.js";
import { VistaDaFolha } from "./vista-folha.js";

const PASSO_GRADE = 24;
const PASSO_GRADE_MIN_NA_TELA = 12;
const SENSIBILIDADE_RODA = 0.002;

function corDaGrade() {
  return getComputedStyle(document.documentElement).getPropertyValue("--folha-grade").trim() || "#ddd";
}

/** Retângulo que envolve todos os traços (só a borda direita e a de baixo interessam). */
function limitesDoConteudo(tracos) {
  if (!tracos.length) return null;
  return tracos.reduce((acc, t) => {
    const l = limitesDoTraco(t);
    return { x1: Math.max(acc.x1, l.x1), y1: Math.max(acc.y1, l.y1) };
  }, { x1: 0, y1: 0 });
}

export class QuadroDeEscrita {
  /** `aoMudar(tracos)` a cada alteração do desenho; `aoMudarVista(vista)` a cada pan/zoom. */
  constructor(area, { aoMudar, aoMudarVista }) {
    this.area = area;
    this.aoMudar = aoMudar;
    this.aoMudarVista = aoMudarVista;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fe-canvas";
    area.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.tracos = [];
    this.pilha = new PilhaDeDesfazer();
    this.vista = new VistaDaFolha();
    this.tracoAtual = null;
    this.borracha = null;
    this.antesDaBorracha = null;
    this.tamanho = { largura: 1, altura: 1, dpr: 1 };
    this.quadroPendente = 0;
    this.controle = new AbortController();
    this.ligar();
    this.redimensionar();
  }

  ligar() {
    const sinal = this.controle.signal;
    acompanharGestos(this.canvas, {
      um: {
        inicio: (ponto) => this.comecarGesto(ponto),
        mover: (ponto) => this.continuarGesto(ponto),
        fim: () => this.terminarGesto(),
        interromper: () => this.cancelarGesto(),
      },
      dois: {
        mover: ({ centro, passoEscala, deslocamento }) => {
          this.vista.pincar(this.pontoLocal(centro), passoEscala, deslocamento);
          this.vistaMudou();
        },
      },
    }, sinal);
    this.canvas.addEventListener("wheel", (e) => this.aoRodar(e), { signal: sinal, passive: false });
    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(this.area);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.redesenhar(), { signal: sinal });
  }

  // ---------- conteúdo ----------

  /** Troca o desenho (outra questão). A pilha de desfazer vem junto com ele. */
  carregar({ tracos, pilha, vista }) {
    this.tracos = tracos;
    this.pilha = pilha;
    this.vista = vista;
    this.tracoAtual = null;
    this.borracha = null;
    this.vistaMudou({ jaRedesenha: true });
  }

  desfazer() {
    const anterior = this.pilha.desfazer(this.tracos);
    if (anterior) this.substituirTracos(anterior);
  }

  refazer() {
    const seguinte = this.pilha.refazer(this.tracos);
    if (seguinte) this.substituirTracos(seguinte);
  }

  limpar() {
    if (!this.tracos.length) return false;
    this.pilha.registrar(this.tracos);
    this.substituirTracos([]);
    return true;
  }

  zoomNormal() {
    this.vista.zoomNormal(this.tamanho.altura);
    this.vistaMudou({ jaRedesenha: true });
  }

  substituirTracos(tracos) {
    this.tracos = tracos;
    this.aoMudar(this.tracos);
    this.vistaMudou({ jaRedesenha: true });
  }

  // ---------- gestos ----------

  pontoLocal([x, y]) {
    const r = this.retangulo ?? this.canvas.getBoundingClientRect();
    return [x - r.left, y - r.top];
  }

  pontoNaFolha(ponto) {
    const [x, y] = this.vista.paraFolha(this.pontoLocal(ponto));
    return [arredondar(x), arredondar(y)];
  }

  comecarGesto(ponto) {
    this.retangulo = this.canvas.getBoundingClientRect();
    const p = this.pontoNaFolha(ponto);
    if (caneta.ferramenta === "borracha") {
      this.antesDaBorracha = this.tracos;
      this.apagarEm(p);
      return;
    }
    this.tracoAtual = novoTraco(p, caneta);
    this.comTransformacao(() => desenharTraco(this.ctx, this.tracoAtual, this.cores));
  }

  continuarGesto(ponto) {
    const p = this.pontoNaFolha(ponto);
    if (this.antesDaBorracha) {
      this.apagarEm(p);
      return;
    }
    if (this.tracoAtual && acrescentarPonto(this.tracoAtual, p)) {
      this.comTransformacao(() => desenharFinalDoTraco(this.ctx, this.tracoAtual, this.cores));
    }
  }

  terminarGesto() {
    if (this.antesDaBorracha) {
      if (this.tracos !== this.antesDaBorracha) {
        this.pilha.registrar(this.antesDaBorracha);
        this.aoMudar(this.tracos);
      }
      this.antesDaBorracha = null;
      this.borracha = null;
    } else if (this.tracoAtual) {
      this.pilha.registrar(this.tracos);
      this.tracos = [...this.tracos, this.tracoAtual];
      this.tracoAtual = null;
      this.aoMudar(this.tracos);
    }
    this.retangulo = null;
    this.vistaMudou({ jaRedesenha: true });
  }

  /** O primeiro dedo de uma pinça não deve deixar risco nem apagar nada. */
  cancelarGesto() {
    if (this.antesDaBorracha) this.tracos = this.antesDaBorracha;
    this.retangulo = null;
    this.antesDaBorracha = null;
    this.borracha = null;
    this.tracoAtual = null;
    this.redesenhar();
  }

  apagarEm(ponto) {
    this.borracha = ponto;
    this.tracos = apagarTocados(this.tracos, ponto, RAIO_BORRACHA_PX / this.vista.escala);
    this.agendarRedesenho();
  }

  aoRodar(e) {
    e.preventDefault();
    if (e.ctrlKey) {
      const passo = Math.exp(-e.deltaY * SENSIBILIDADE_RODA);
      this.vista.pincar(this.pontoLocal([e.clientX, e.clientY]), passo, [0, 0]);
    } else {
      this.vista.rolar(e.deltaX, e.deltaY);
    }
    this.vistaMudou();
  }

  // ---------- desenho ----------

  /** Depois de pan/zoom ou de mudar o desenho. Gestos agrupam o redesenho por quadro. */
  vistaMudou({ jaRedesenha = false } = {}) {
    const { largura, altura } = this.tamanho;
    if (largura > 1) this.vista.limitar(largura, altura, limitesDoConteudo(this.tracos));
    this.aoMudarVista?.(this.vista);
    if (jaRedesenha) this.redesenhar();
    else this.agendarRedesenho();
  }

  redimensionar() {
    const largura = Math.max(1, this.area.clientWidth);
    const altura = Math.max(1, this.area.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    this.tamanho = { largura, altura, dpr };
    this.canvas.width = Math.round(largura * dpr);
    this.canvas.height = Math.round(altura * dpr);
    this.canvas.style.width = `${largura}px`;
    this.canvas.style.height = `${altura}px`;
    this.vistaMudou({ jaRedesenha: true });
  }

  agendarRedesenho() {
    if (this.quadroPendente) return;
    this.quadroPendente = requestAnimationFrame(() => {
      this.quadroPendente = 0;
      this.redesenhar();
    });
  }

  /** Executa um desenho em coordenadas da folha (zoom e pan aplicados). */
  comTransformacao(desenho) {
    const { dpr } = this.tamanho;
    const { escala, x, y } = this.vista;
    this.ctx.setTransform(dpr * escala, 0, 0, dpr * escala, -x * dpr * escala, -y * dpr * escala);
    desenho();
  }

  redesenhar() {
    cancelAnimationFrame(this.quadroPendente);
    this.quadroPendente = 0;
    const { ctx } = this;
    const { largura, altura, dpr } = this.tamanho;
    this.cores = coresDoTema();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);
    this.desenharGrade();
    const visivel = this.vista.retanguloVisivel(largura, altura);
    this.comTransformacao(() => {
      this.tracos
        .filter((t) => retangulosSeCruzam(limitesDoTraco(t), visivel))
        .forEach((t) => desenharTraco(ctx, t, this.cores));
      if (this.tracoAtual) desenharTraco(ctx, this.tracoAtual, this.cores);
      if (this.borracha) {
        const escala = this.vista.escala;
        desenharBorracha(ctx, this.borracha, RAIO_BORRACHA_PX / escala, this.cores.tinta, 1.5 / escala);
      }
    });
  }

  /** Quadriculado leve, em coordenadas de tela (linhas finas em qualquer zoom). */
  desenharGrade() {
    const { ctx } = this;
    const { largura, altura } = this.tamanho;
    const { escala, x, y } = this.vista;
    let passo = PASSO_GRADE;
    while (passo * escala < PASSO_GRADE_MIN_NA_TELA) passo *= 2;
    ctx.beginPath();
    for (let gx = Math.ceil(x / passo) * passo; (gx - x) * escala <= largura; gx += passo) {
      const sx = Math.round((gx - x) * escala) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, altura);
    }
    for (let gy = Math.ceil(y / passo) * passo; (gy - y) * escala <= altura; gy += passo) {
      const sy = Math.round((gy - y) * escala) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(largura, sy);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = corDaGrade();
    ctx.stroke();
  }

  get podeDesfazer() {
    return this.pilha.podeDesfazer;
  }

  get podeRefazer() {
    return this.pilha.podeRefazer;
  }

  destruir() {
    this.controle.abort();
    this.observador.disconnect();
    cancelAnimationFrame(this.quadroPendente);
    this.canvas.remove();
  }
}
