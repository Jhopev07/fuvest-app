// Rascunho: camada de desenho em tela cheia por cima da questão.
//
// Os traços são vetores em coordenadas da PÁGINA (clientX + scrollX), então o
// desenho acompanha o texto quando a questão rola no modo "rolar" e sobrevive a
// redimensionamentos (basta redesenhar). Quem abre o rascunho fornece os traços
// iniciais e recebe cada alteração em `aoMudar`, para guardar onde quiser.

import { html, icone } from "./render.js";
import { criarElemento } from "./ui.js";

const ESPESSURAS = { fina: 2.5, grossa: 6 };
const CORES = ["tinta", "azul", "vermelho"];
const NOMES_CORES = { tinta: "Grafite", azul: "Azul", vermelho: "Vermelho" };
const RAIO_BORRACHA = 14;
const LIMITE_DESFAZER = 100;
const CASAS_COORDENADA = 10; // guarda 1 casa decimal

// Preferências da caneta valem para todos os rascunhos enquanto o app está aberto.
const preferencias = { ferramenta: "caneta", espessura: "fina", cor: "tinta", fundo: "transparente" };

let aberto = null;

// ---------- Geometria ----------

function arredondar(valor) {
  return Math.round(valor * CASAS_COORDENADA) / CASAS_COORDENADA;
}

function pontoMedio(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function distanciaAoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const comprimento2 = dx * dx + dy * dy;
  const t = comprimento2 === 0 ? 0 : Math.max(0, Math.min(1,
    ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / comprimento2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function tracoTocado(traco, ponto) {
  const alcance = RAIO_BORRACHA + traco.largura / 2;
  const pts = traco.pontos;
  if (pts.length === 1) return Math.hypot(ponto[0] - pts[0][0], ponto[1] - pts[0][1]) <= alcance;
  for (let i = 1; i < pts.length; i++) {
    if (distanciaAoSegmento(ponto, pts[i - 1], pts[i]) <= alcance) return true;
  }
  return false;
}

// ---------- Desenho ----------

function corResolvida(chave) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--rascunho-${chave}`).trim() || "#333";
}

function prepararPincel(ctx, traco, cores) {
  ctx.strokeStyle = cores[traco.cor] ?? cores.tinta;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = traco.largura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** Traço suavizado: curvas quadráticas passando pelos pontos médios. */
function desenharTraco(ctx, traco, cores) {
  const pts = traco.pontos;
  prepararPincel(ctx, traco, cores);
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], traco.largura / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const medio = pontoMedio(pts[i], pts[i + 1]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], medio[0], medio[1]);
  }
  const ultimo = pts[pts.length - 1];
  ctx.lineTo(ultimo[0], ultimo[1]);
  ctx.stroke();
}

/** Só o trecho novo do traço em andamento (evita redesenhar tudo a cada movimento). */
function desenharFinalDoTraco(ctx, traco, cores) {
  const pts = traco.pontos;
  const n = pts.length;
  if (n < 3) {
    desenharTraco(ctx, traco, cores);
    return;
  }
  prepararPincel(ctx, traco, cores);
  const inicio = n === 3 ? pts[0] : pontoMedio(pts[n - 3], pts[n - 2]);
  const fim = pontoMedio(pts[n - 2], pts[n - 1]);
  ctx.beginPath();
  ctx.moveTo(inicio[0], inicio[1]);
  ctx.quadraticCurveTo(pts[n - 2][0], pts[n - 2][1], fim[0], fim[1]);
  ctx.stroke();
}

// ---------- Interface ----------

function botaoFerramenta(acao, rotulo, conteudo, ativo, extra = "") {
  return html`<button type="button" class="rs-botao ${ativo ? "ativo" : ""} ${extra}" data-rs="${acao}"
    aria-label="${rotulo}" aria-pressed="${ativo}" title="${rotulo}">${conteudo}</button>`;
}

function pontoEspessura(nome) {
  const raio = nome === "fina" ? 2.5 : 5;
  return html`<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="${raio}" fill="currentColor"/></svg>`;
}

function barraFerramentas() {
  const p = preferencias;
  const caneta = p.ferramenta === "caneta";
  return html`
    <div class="rs-barra" role="toolbar" aria-label="Ferramentas do rascunho">
      <div class="rs-linha">
        ${botaoFerramenta("fina", "Caneta fina", pontoEspessura("fina"), caneta && p.espessura === "fina")}
        ${botaoFerramenta("grossa", "Caneta grossa", pontoEspessura("grossa"), caneta && p.espessura === "grossa")}
        ${botaoFerramenta("borracha", "Borracha (apaga o traço tocado)", icone("borracha"), p.ferramenta === "borracha")}
        <span class="rs-separador" aria-hidden="true"></span>
        ${CORES.map((cor) => botaoFerramenta(`cor-${cor}`, `Cor ${NOMES_CORES[cor]}`,
          html`<span class="rs-cor rs-cor-${cor}"></span>`, p.cor === cor))}
      </div>
      <div class="rs-linha">
        ${botaoFerramenta("desfazer", "Desfazer", icone("desfazer"), false)}
        ${botaoFerramenta("limpar", "Limpar tudo", icone("lixeira"), false)}
        ${botaoFerramenta("fundo", p.fundo === "papel" ? "Fundo: papel (toque para transparente)" : "Fundo: transparente (toque para papel)",
          icone(p.fundo === "papel" ? "papel" : "transparente"), p.fundo === "papel")}
        ${botaoFerramenta("rolar", "Rolar a questão sem desenhar", icone("mover"), p.ferramenta === "rolar")}
        <span class="rs-separador" aria-hidden="true"></span>
        <button type="button" class="rs-fechar" data-rs="fechar">Fechar</button>
      </div>
    </div>`;
}

class CamadaRascunho {
  constructor({ tracos, aoMudar }) {
    this.tracos = Array.isArray(tracos) ? tracos : [];
    this.aoMudar = aoMudar;
    this.historico = [];
    this.tracoAtual = null;
    this.ponteiroAtivo = null;
    this.posicaoBorracha = null;
    this.quadroPendente = 0;
    this.controle = new AbortController();
    this.cores = {};
    this.criarDom();
    this.ligarEventos();
    this.redimensionar();
  }

  criarDom() {
    this.raiz = criarElemento(html`
      <div class="rascunho" role="dialog" aria-label="Rascunho">
        <canvas class="rs-canvas"></canvas>
        <div class="rs-dica" aria-live="polite"></div>
        ${barraFerramentas()}
      </div>`);
    this.canvas = this.raiz.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    document.body.append(this.raiz);
    document.documentElement.classList.add("com-rascunho");
    this.aplicarPreferencias();
  }

  ligarEventos() {
    const sinal = this.controle.signal;
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.aoPressionar(e), { signal: sinal });
    c.addEventListener("pointermove", (e) => this.aoMover(e), { signal: sinal });
    c.addEventListener("pointerup", (e) => this.aoSoltar(e), { signal: sinal });
    c.addEventListener("pointercancel", (e) => this.aoSoltar(e), { signal: sinal });
    this.raiz.addEventListener("click", (e) => this.aoTocarBarra(e), { signal: sinal });
    window.addEventListener("resize", () => this.redimensionar(), { signal: sinal });
    window.addEventListener("scroll", () => this.agendarRedesenho(), { signal: sinal, passive: true });
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => this.redesenhar(), { signal: sinal });
  }

  // ----- coordenadas -----

  pontoDoEvento(e) {
    return [arredondar(e.clientX + window.scrollX), arredondar(e.clientY + window.scrollY)];
  }

  eventosCoalescidos(e) {
    const lista = e.getCoalescedEvents?.();
    return lista && lista.length ? lista : [e];
  }

  // ----- ponteiro -----

  aoPressionar(e) {
    if (this.ponteiroAtivo !== null || preferencias.ferramenta === "rolar") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.ponteiroAtivo = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);
    if (preferencias.ferramenta === "borracha") {
      this.guardarParaDesfazer();
      this.apagarEm(this.pontoDoEvento(e));
      return;
    }
    this.tracoAtual = {
      cor: preferencias.cor,
      largura: ESPESSURAS[preferencias.espessura],
      pontos: [this.pontoDoEvento(e)],
    };
    this.ctx.save();
    this.ctx.translate(-window.scrollX, -window.scrollY);
    desenharTraco(this.ctx, this.tracoAtual, this.cores);
    this.ctx.restore();
  }

  aoMover(e) {
    if (e.pointerId !== this.ponteiroAtivo) return;
    e.preventDefault();
    if (preferencias.ferramenta === "borracha") {
      this.eventosCoalescidos(e).forEach((ev) => this.apagarEm(this.pontoDoEvento(ev)));
      return;
    }
    if (!this.tracoAtual) return;
    this.ctx.save();
    this.ctx.translate(-window.scrollX, -window.scrollY);
    for (const ev of this.eventosCoalescidos(e)) {
      const ponto = this.pontoDoEvento(ev);
      const ultimo = this.tracoAtual.pontos[this.tracoAtual.pontos.length - 1];
      if (ponto[0] === ultimo[0] && ponto[1] === ultimo[1]) continue;
      this.tracoAtual.pontos.push(ponto);
      desenharFinalDoTraco(this.ctx, this.tracoAtual, this.cores);
    }
    this.ctx.restore();
  }

  aoSoltar(e) {
    if (e.pointerId !== this.ponteiroAtivo) return;
    this.ponteiroAtivo = null;
    if (preferencias.ferramenta === "borracha") {
      this.posicaoBorracha = null;
      this.descartarDesfazerSemEfeito();
      this.redesenhar();
      this.notificar();
      return;
    }
    if (!this.tracoAtual) return;
    this.guardarParaDesfazer();
    this.tracos = [...this.tracos, this.tracoAtual];
    this.tracoAtual = null;
    this.redesenhar();
    this.notificar();
  }

  apagarEm(ponto) {
    this.posicaoBorracha = ponto;
    const restantes = this.tracos.filter((t) => !tracoTocado(t, ponto));
    if (restantes.length !== this.tracos.length) this.tracos = restantes;
    this.agendarRedesenho();
  }

  // ----- desfazer -----

  guardarParaDesfazer() {
    this.historico.push(this.tracos);
    if (this.historico.length > LIMITE_DESFAZER) this.historico.shift();
  }

  /** Uma passada de borracha que não apagou nada não deve ocupar o "desfazer". */
  descartarDesfazerSemEfeito() {
    if (this.historico[this.historico.length - 1] === this.tracos) this.historico.pop();
  }

  desfazer() {
    if (!this.historico.length) return;
    this.tracos = this.historico.pop();
    this.redesenhar();
    this.notificar();
  }

  limpar() {
    if (!this.tracos.length) return;
    this.guardarParaDesfazer();
    this.tracos = [];
    this.redesenhar();
    this.notificar();
    this.dica("Rascunho limpo. Desfazer traz de volta.");
  }

  notificar() {
    this.aoMudar?.(this.tracos);
  }

  // ----- barra -----

  aoTocarBarra(e) {
    const botao = e.target.closest("[data-rs]");
    if (!botao) return;
    const acao = botao.dataset.rs;
    const acoes = {
      fina: () => this.escolher({ ferramenta: "caneta", espessura: "fina" }),
      grossa: () => this.escolher({ ferramenta: "caneta", espessura: "grossa" }),
      borracha: () => this.escolher({ ferramenta: "borracha" }),
      desfazer: () => this.desfazer(),
      limpar: () => this.limpar(),
      fundo: () => this.escolher({ fundo: preferencias.fundo === "papel" ? "transparente" : "papel" }),
      rolar: () => this.escolher({ ferramenta: preferencias.ferramenta === "rolar" ? "caneta" : "rolar" }),
      fechar: () => fecharRascunho(),
    };
    if (acao.startsWith("cor-")) {
      this.escolher({ cor: acao.slice("cor-".length), ferramenta: "caneta" });
      return;
    }
    acoes[acao]?.();
  }

  escolher(mudancas) {
    Object.assign(preferencias, mudancas);
    this.aplicarPreferencias();
    this.raiz.querySelector(".rs-barra").replaceWith(criarElemento(barraFerramentas()));
    if (mudancas.ferramenta === "rolar") this.dica("Modo rolar: arraste para mover a questão.");
    this.redesenhar();
  }

  aplicarPreferencias() {
    this.raiz.classList.toggle("papel", preferencias.fundo === "papel");
    this.raiz.classList.toggle("rolando", preferencias.ferramenta === "rolar");
    this.raiz.dataset.ferramenta = preferencias.ferramenta;
  }

  dica(texto) {
    const area = this.raiz.querySelector(".rs-dica");
    area.textContent = texto;
    area.classList.add("visivel");
    clearTimeout(this.temporizadorDica);
    this.temporizadorDica = setTimeout(() => area.classList.remove("visivel"), 2200);
  }

  // ----- tela -----

  redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    this.canvas.width = Math.round(largura * dpr);
    this.canvas.height = Math.round(altura * dpr);
    this.canvas.style.width = `${largura}px`;
    this.canvas.style.height = `${altura}px`;
    this.dpr = dpr;
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
    this.cores = Object.fromEntries(CORES.map((c) => [c, corResolvida(c)]));
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.raiz.style.backgroundPosition = `${-window.scrollX}px ${-window.scrollY}px`;
    ctx.save();
    ctx.translate(-window.scrollX, -window.scrollY);
    this.tracos.forEach((t) => desenharTraco(ctx, t, this.cores));
    if (this.tracoAtual) desenharTraco(ctx, this.tracoAtual, this.cores);
    if (this.posicaoBorracha) this.desenharBorracha();
    ctx.restore();
  }

  desenharBorracha() {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(this.posicaoBorracha[0], this.posicaoBorracha[1], RAIO_BORRACHA, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.cores.tinta;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  destruir() {
    this.controle.abort();
    cancelAnimationFrame(this.quadroPendente);
    clearTimeout(this.temporizadorDica);
    this.raiz.remove();
    document.documentElement.classList.remove("com-rascunho");
  }
}

// ---------- API pública ----------

function aoVoltarDoNavegador() {
  if (aberto) fecharRascunho({ porHistorico: true });
}

/**
 * Abre o rascunho. `tracos`: desenho guardado da questão (ou vazio).
 * `aoMudar(tracos)`: chamado a cada traço, apagamento, desfazer ou limpeza.
 */
function abrirRascunho({ tracos = [], aoMudar, aoFechar } = {}) {
  fecharRascunho();
  aberto = { camada: new CamadaRascunho({ tracos, aoMudar }), aoFechar };
  // O "voltar" do Android fecha o rascunho em vez de sair da questão.
  history.pushState({ ...history.state, rascunho: true }, "");
  window.addEventListener("popstate", aoVoltarDoNavegador, { once: true });
  return aberto.camada;
}

export function fecharRascunho({ porHistorico = false } = {}) {
  if (!aberto) return;
  const { camada, aoFechar } = aberto;
  aberto = null;
  window.removeEventListener("popstate", aoVoltarDoNavegador);
  camada.destruir();
  if (!porHistorico && history.state?.rascunho) history.back();
  aoFechar?.();
}

/** Guarda rascunhos por questão enquanto uma sessão está aberta. */
export class CadernoDeRascunhos {
  constructor(inicial = {}, aoGuardar = null) {
    this.porQuestao = new Map(Object.entries(inicial));
    this.aoGuardar = aoGuardar;
  }

  abrir(qid, aoFechar) {
    abrirRascunho({
      tracos: this.porQuestao.get(qid) ?? [],
      aoMudar: (tracos) => {
        if (tracos.length) this.porQuestao.set(qid, tracos);
        else this.porQuestao.delete(qid);
        this.aoGuardar?.(Object.fromEntries(this.porQuestao));
      },
      aoFechar,
    });
  }

  temDesenho(qid) {
    return (this.porQuestao.get(qid)?.length ?? 0) > 0;
  }
}
