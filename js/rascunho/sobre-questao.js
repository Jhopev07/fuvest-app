// Escrita SOBRE a questão (opção secundária da folha): camada transparente em tela
// cheia por cima do enunciado. Os traços ficam em coordenadas da página (clientX +
// scrollX), então acompanham o texto quando a questão rola no modo "rolar".

import { abrirCamada } from "../camadas.js";
import { PilhaDeDesfazer } from "../pilha-desfazer.js";
import { html, icone, montar } from "../render.js";
import { criarElemento } from "../ui.js";
import { botaoFerramenta, botoesDeCaneta, caneta, mudancaDeCaneta } from "./ferramentas.js";
import {
  RAIO_BORRACHA_PX, acrescentarPonto, apagarTocados, arredondar, coresDoTema, desenharBorracha,
  desenharFinalDoTraco, desenharTraco, novoTraco,
} from "./tracos.js";

const DURACAO_DICA_MS = 2200;

class CamadaSobreQuestao {
  constructor({ tracos, aoMudar }) {
    this.tracos = tracos;
    this.aoMudar = aoMudar;
    this.pilha = new PilhaDeDesfazer();
    this.fundoPapel = false;
    this.rolando = false;
    this.tracoAtual = null;
    this.antesDaBorracha = null;
    this.borracha = null;
    this.ponteiro = null;
    this.quadroPendente = 0;
    this.controle = new AbortController();
    this.raiz = criarElemento(html`
      <div class="rascunho" role="dialog" aria-label="Escrever sobre a questão">
        <canvas class="rs-canvas"></canvas>
        <div class="rs-dica" aria-live="polite"></div>
        <div class="rs-barra" role="toolbar" aria-label="Ferramentas"></div>
      </div>`);
    this.canvas = this.raiz.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    document.body.append(this.raiz);
    document.documentElement.classList.add("com-rascunho");
    this.atualizarBarra();
    this.ligar();
    this.redimensionar();
  }

  ligar() {
    const opcoes = { signal: this.controle.signal };
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.aoPressionar(e), opcoes);
    c.addEventListener("pointermove", (e) => this.aoMover(e), opcoes);
    c.addEventListener("pointerup", (e) => this.aoSoltar(e), opcoes);
    c.addEventListener("pointercancel", (e) => this.aoSoltar(e), opcoes);
    this.raiz.addEventListener("click", (e) => this.aoTocarBarra(e), opcoes);
    window.addEventListener("resize", () => this.redimensionar(), opcoes);
    window.addEventListener("scroll", () => this.agendarRedesenho(), { ...opcoes, passive: true });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.redesenhar(), opcoes);
  }

  // ---------- ponteiro ----------

  pontoDoEvento(e) {
    return [arredondar(e.clientX + window.scrollX), arredondar(e.clientY + window.scrollY)];
  }

  aoPressionar(e) {
    if (this.ponteiro !== null || this.rolando) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.ponteiro = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);
    const ponto = this.pontoDoEvento(e);
    if (caneta.ferramenta === "borracha") {
      this.antesDaBorracha = this.tracos;
      this.apagarEm(ponto);
      return;
    }
    this.tracoAtual = novoTraco(ponto, caneta);
    this.naPagina(() => desenharTraco(this.ctx, this.tracoAtual, this.cores));
  }

  aoMover(e) {
    if (e.pointerId !== this.ponteiro) return;
    e.preventDefault();
    const eventos = e.getCoalescedEvents?.()?.length ? e.getCoalescedEvents() : [e];
    for (const ev of eventos) {
      const ponto = this.pontoDoEvento(ev);
      if (this.antesDaBorracha) this.apagarEm(ponto);
      else if (this.tracoAtual && acrescentarPonto(this.tracoAtual, ponto)) {
        this.naPagina(() => desenharFinalDoTraco(this.ctx, this.tracoAtual, this.cores));
      }
    }
  }

  aoSoltar(e) {
    if (e.pointerId !== this.ponteiro) return;
    this.ponteiro = null;
    if (this.antesDaBorracha) {
      if (this.tracos !== this.antesDaBorracha) this.registrarMudanca(this.antesDaBorracha);
      this.antesDaBorracha = null;
      this.borracha = null;
    } else if (this.tracoAtual) {
      const anteriores = this.tracos;
      this.tracos = [...anteriores, this.tracoAtual];
      this.tracoAtual = null;
      this.registrarMudanca(anteriores);
    }
    this.redesenhar();
  }

  apagarEm(ponto) {
    this.borracha = ponto;
    this.tracos = apagarTocados(this.tracos, ponto, RAIO_BORRACHA_PX);
    this.agendarRedesenho();
  }

  registrarMudanca(anteriores) {
    this.pilha.registrar(anteriores);
    this.aoMudar(this.tracos);
    this.atualizarBarra();
  }

  substituirTracos(tracos) {
    if (!tracos) return;
    this.tracos = tracos;
    this.aoMudar(this.tracos);
    this.atualizarBarra();
    this.redesenhar();
  }

  limpar() {
    if (!this.tracos.length) return;
    this.pilha.registrar(this.tracos);
    this.substituirTracos([]);
    this.dica("Rascunho limpo. Desfazer traz de volta.");
  }

  // ---------- barra ----------

  atualizarBarra() {
    montar(this.raiz.querySelector(".rs-barra"), html`
      <div class="rs-linha">${botoesDeCaneta()}</div>
      <div class="rs-linha">
        ${botaoFerramenta("desfazer", "Desfazer", icone("desfazer"), { desativado: !this.pilha.podeDesfazer })}
        ${botaoFerramenta("refazer", "Refazer", icone("refazer"), { desativado: !this.pilha.podeRefazer })}
        ${botaoFerramenta("limpar", "Limpar tudo", icone("lixeira"))}
        ${botaoFerramenta("fundo", this.fundoPapel ? "Fundo: papel (toque para transparente)" : "Fundo: transparente (toque para papel)",
          icone(this.fundoPapel ? "papel" : "transparente"), { ativo: this.fundoPapel })}
        ${botaoFerramenta("rolar", "Rolar a questão sem desenhar", icone("mover"), { ativo: this.rolando })}
        <span class="rs-separador" aria-hidden="true"></span>
        <button type="button" class="rs-fechar" data-rs="fechar">Fechar</button>
      </div>`);
    this.raiz.classList.toggle("papel", this.fundoPapel);
    this.raiz.classList.toggle("rolando", this.rolando);
    this.raiz.dataset.ferramenta = caneta.ferramenta;
  }

  aoTocarBarra(e) {
    const botao = e.target.closest("[data-rs]");
    if (!botao || botao.disabled) return;
    const acao = botao.dataset.rs;
    const mudanca = mudancaDeCaneta(acao);
    if (mudanca) {
      Object.assign(caneta, mudanca);
      this.rolando = false;
      this.atualizarBarra();
      return;
    }
    const acoes = {
      desfazer: () => this.substituirTracos(this.pilha.desfazer(this.tracos)),
      refazer: () => this.substituirTracos(this.pilha.refazer(this.tracos)),
      limpar: () => this.limpar(),
      fundo: () => { this.fundoPapel = !this.fundoPapel; this.atualizarBarra(); this.redesenhar(); },
      rolar: () => this.alternarRolagem(),
      fechar: () => this.fechar?.(),
    };
    acoes[acao]?.();
  }

  alternarRolagem() {
    this.rolando = !this.rolando;
    this.atualizarBarra();
    if (this.rolando) this.dica("Modo rolar: arraste para mover a questão.");
  }

  dica(texto) {
    const area = this.raiz.querySelector(".rs-dica");
    area.textContent = texto;
    area.classList.add("visivel");
    clearTimeout(this.temporizadorDica);
    this.temporizadorDica = setTimeout(() => area.classList.remove("visivel"), DURACAO_DICA_MS);
  }

  // ---------- tela ----------

  naPagina(desenho) {
    this.ctx.save();
    this.ctx.translate(-window.scrollX, -window.scrollY);
    desenho();
    this.ctx.restore();
  }

  redimensionar() {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.redesenhar();
  }

  agendarRedesenho() {
    if (this.quadroPendente) return;
    this.quadroPendente = requestAnimationFrame(() => {
      this.quadroPendente = 0;
      this.redesenhar();
    });
  }

  redesenhar() {
    this.cores = coresDoTema();
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.raiz.style.backgroundPosition = `${-window.scrollX}px ${-window.scrollY}px`;
    this.naPagina(() => {
      this.tracos.forEach((t) => desenharTraco(ctx, t, this.cores));
      if (this.tracoAtual) desenharTraco(ctx, this.tracoAtual, this.cores);
      if (this.borracha) desenharBorracha(ctx, this.borracha, RAIO_BORRACHA_PX, this.cores.tinta, 1.5);
    });
  }

  destruir() {
    this.controle.abort();
    cancelAnimationFrame(this.quadroPendente);
    clearTimeout(this.temporizadorDica);
    this.raiz.remove();
    document.documentElement.classList.remove("com-rascunho");
  }
}

/**
 * Abre a escrita sobre a questão. `tracos`: desenho guardado da questão.
 * `aoMudar(tracos)`: chamado a cada traço, apagamento, desfazer, refazer ou limpeza.
 * O "voltar" do Android e o botão Fechar fecham a camada.
 */
export function abrirSobreQuestao({ tracos, aoMudar }) {
  const camada = new CamadaSobreQuestao({ tracos, aoMudar });
  camada.fechar = abrirCamada(() => camada.destruir());
  return camada;
}
