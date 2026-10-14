// Folha de escrita: painel com uma folha em branco abaixo da questão (modo dividido)
// ou ocupando a tela inteira, com a questão numa faixa recolhível no topo.
// A barra entre a questão e a folha é a divisória: arrastá-la muda a proporção.

import { gravarLocal, lerNumeroLocal } from "../armazenamento-local.js";
import { limitar } from "../geometria.js";
import { html, icone, montar } from "../render.js";
import { avisar, criarElemento } from "../ui.js";
import { botaoFerramenta, botoesDeCaneta, caneta, mudancaDeCaneta } from "./ferramentas.js";
import { QuadroDeEscrita } from "./quadro.js";

const CHAVE_DIVISAO = "fuvest-folha-divisao";
const PARTE_QUESTAO_PADRAO = 0.4;
const PARTE_QUESTAO_MIN = 0.15;
const PARTE_QUESTAO_MAX = 0.7;
const PASSO_TECLADO = 0.05;
const CLASSE_DIVIDIDO = "modo-folha";
const CLASSE_CHEIA = "folha-cheia";

let parteQuestao = lerNumeroLocal(CHAVE_DIVISAO, PARTE_QUESTAO_PADRAO, PARTE_QUESTAO_MIN, PARTE_QUESTAO_MAX);

function aplicarDivisao() {
  const estilo = document.documentElement.style;
  estilo.setProperty("--parte-questao", parteQuestao.toFixed(3));
  estilo.setProperty("--parte-folha", (1 - parteQuestao).toFixed(3));
}

function percentual(fracao) {
  return Math.round(fracao * 100);
}

function barraDaFolha() {
  return html`
    <div class="fe-barra">
      ${botaoFerramenta("cheia", "Folha em tela cheia", icone("expandir"))}
      <button type="button" class="fe-zoom" data-rs="zoom" title="Voltar ao zoom 100%"
        aria-label="Zoom da folha; toque para voltar a 100%">100%</button>
      <div class="fe-pega" role="separator" tabindex="0" aria-orientation="horizontal"
        aria-label="Divisão entre a questão e a folha" aria-valuemin="${percentual(PARTE_QUESTAO_MIN)}"
        aria-valuemax="${percentual(PARTE_QUESTAO_MAX)}" aria-valuenow="${percentual(parteQuestao)}"><span></span></div>
      ${botaoFerramenta("limpar", "Limpar a folha", icone("lixeira"))}
      ${botaoFerramenta("sobre", "Escrever sobre a questão", icone("sobre"))}
      <button type="button" class="rs-fechar" data-rs="fechar">Fechar</button>
    </div>`;
}

export class FolhaDeEscrita {
  /**
   * `depoisDe`: elemento após o qual a folha entra no DOM (a tela da questão).
   * `painelDaQuestao()`: o elemento rolável da questão (para medir a divisória).
   * `aoMudar(tracos)`, `aoFechar()`, `aoEscreverSobre()`: avisos para quem abriu.
   */
  constructor({ depoisDe, painelDaQuestao, aoMudar, aoFechar, aoEscreverSobre }) {
    this.painelDaQuestao = painelDaQuestao;
    this.aoFechar = aoFechar;
    this.aoEscreverSobre = aoEscreverSobre;
    this.controle = new AbortController();
    this.elemento = criarElemento(html`
      <section class="folha-escrita" aria-label="Folha de escrita">
        <div class="fe-consulta">
          <button type="button" class="fe-consulta-alternar" data-rs="consulta" aria-expanded="false">
            <span class="fe-consulta-titulo"></span>
            <span class="fe-consulta-acao">Ver enunciado</span>${icone("baixo")}
          </button>
          <div class="fe-consulta-corpo" hidden></div>
        </div>
        ${barraDaFolha()}
        <div class="fe-area"><p class="fe-dica">Um dedo escreve. Dois dedos movem e ampliam a folha.</p></div>
        <div class="fe-ferramentas" role="toolbar" aria-label="Caneta"></div>
      </section>`);
    depoisDe.after(this.elemento);
    aplicarDivisao();
    document.documentElement.classList.add(CLASSE_DIVIDIDO);
    this.quadro = new QuadroDeEscrita(this.elemento.querySelector(".fe-area"), {
      aoMudar: (tracos) => {
        aoMudar(tracos);
        this.atualizarFerramentas();
        this.mostrarSeVazia(tracos);
      },
      aoMudarVista: (vista) => this.mostrarZoom(vista.escala),
    });
    this.atualizarFerramentas();
    this.ligar();
  }

  ligar() {
    const sinal = this.controle.signal;
    this.elemento.addEventListener("click", (e) => this.aoTocar(e), { signal: sinal });
    const barra = this.elemento.querySelector(".fe-barra");
    barra.addEventListener("pointerdown", (e) => this.comecarArrasto(e), { signal: sinal });
    this.elemento.querySelector(".fe-pega").addEventListener("keydown", (e) => this.aoTeclar(e), { signal: sinal });
  }

  // ---------- conteúdo ----------

  carregar(estado) {
    this.quadro.carregar(estado);
    this.atualizarFerramentas();
    this.mostrarSeVazia(estado.tracos);
  }

  mostrarSeVazia(tracos) {
    this.elemento.classList.toggle("vazia", tracos.length === 0);
  }

  /** Faixa de consulta (tela cheia): título curto e o conteúdo da questão. */
  definirConsulta(titulo, conteudo) {
    this.elemento.querySelector(".fe-consulta-titulo").textContent = titulo;
    montar(this.elemento.querySelector(".fe-consulta-corpo"), conteudo);
  }

  // ---------- botões ----------

  aoTocar(e) {
    const botao = e.target.closest("[data-rs]");
    if (!botao || botao.disabled) return;
    const acao = botao.dataset.rs;
    const mudanca = mudancaDeCaneta(acao);
    if (mudanca) {
      Object.assign(caneta, mudanca);
      this.atualizarFerramentas();
      return;
    }
    const acoes = {
      desfazer: () => this.quadro.desfazer(),
      refazer: () => this.quadro.refazer(),
      limpar: () => this.quadro.limpar() && avisar("Folha limpa. Desfazer traz de volta."),
      zoom: () => this.quadro.zoomNormal(),
      cheia: () => this.alternarTelaCheia(),
      consulta: () => this.alternarConsulta(),
      sobre: () => this.aoEscreverSobre(),
      fechar: () => this.aoFechar(),
    };
    acoes[acao]?.();
  }

  atualizarFerramentas() {
    montar(this.elemento.querySelector(".fe-ferramentas"), html`
      ${botoesDeCaneta()}
      ${botaoFerramenta("desfazer", "Desfazer", icone("desfazer"), { desativado: !this.quadro.podeDesfazer })}
      ${botaoFerramenta("refazer", "Refazer", icone("refazer"), { desativado: !this.quadro.podeRefazer })}`);
  }

  mostrarZoom(escala) {
    this.elemento.querySelector(".fe-zoom").textContent = `${percentual(escala)}%`;
  }

  get telaCheia() {
    return document.documentElement.classList.contains(CLASSE_CHEIA);
  }

  alternarTelaCheia() {
    const cheia = !this.telaCheia;
    const painel = this.painelDaQuestao();
    if (cheia) this.rolagemDaQuestao = painel.scrollTop;
    document.documentElement.classList.toggle(CLASSE_CHEIA, cheia);
    if (!cheia) painel.scrollTop = this.rolagemDaQuestao ?? 0;
    this.elemento.querySelector(".fe-pega").hidden = cheia;
    const botao = this.elemento.querySelector('[data-rs="cheia"]');
    const rotulo = cheia ? "Voltar à questão com a folha" : "Folha em tela cheia";
    botao.setAttribute("aria-label", rotulo);
    botao.title = rotulo;
    montar(botao, icone(cheia ? "recolher" : "expandir"));
  }

  alternarConsulta() {
    const botao = this.elemento.querySelector(".fe-consulta-alternar");
    const aberta = botao.getAttribute("aria-expanded") !== "true";
    botao.setAttribute("aria-expanded", String(aberta));
    botao.querySelector(".fe-consulta-acao").textContent = aberta ? "Esconder" : "Ver enunciado";
    this.elemento.querySelector(".fe-consulta-corpo").hidden = !aberta;
  }

  // ---------- divisória ----------

  definirDivisao(fracao, { salvar = true } = {}) {
    parteQuestao = limitar(fracao, PARTE_QUESTAO_MIN, PARTE_QUESTAO_MAX);
    aplicarDivisao();
    this.elemento.querySelector(".fe-pega").setAttribute("aria-valuenow", String(percentual(parteQuestao)));
    if (salvar) gravarLocal(CHAVE_DIVISAO, parteQuestao.toFixed(3));
  }

  /** Arrastar a barra (fora dos botões) move a divisão entre questão e folha. */
  comecarArrasto(e) {
    const painel = this.painelDaQuestao();
    if (this.telaCheia || !painel || e.target.closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const barra = e.currentTarget;
    barra.setPointerCapture?.(e.pointerId);
    const inicio = painel.getBoundingClientRect().top;
    const total = this.elemento.getBoundingClientRect().bottom - inicio;
    const folgaNaBarra = e.clientY - barra.getBoundingClientRect().top;
    barra.classList.add("arrastando");
    const mover = (ev) => this.definirDivisao((ev.clientY - folgaNaBarra - inicio) / total, { salvar: false });
    const soltar = () => {
      barra.classList.remove("arrastando");
      barra.removeEventListener("pointermove", mover);
      this.definirDivisao(parteQuestao);
    };
    barra.addEventListener("pointermove", mover, { signal: this.controle.signal });
    barra.addEventListener("pointerup", soltar, { once: true, signal: this.controle.signal });
    barra.addEventListener("pointercancel", soltar, { once: true, signal: this.controle.signal });
  }

  aoTeclar(e) {
    const passos = { ArrowUp: -PASSO_TECLADO, ArrowDown: PASSO_TECLADO };
    if (!(e.key in passos)) return;
    e.preventDefault();
    this.definirDivisao(parteQuestao + passos[e.key]);
  }

  destruir() {
    this.controle.abort();
    this.quadro.destruir();
    this.elemento.remove();
    document.documentElement.classList.remove(CLASSE_DIVIDIDO, CLASSE_CHEIA);
  }
}
