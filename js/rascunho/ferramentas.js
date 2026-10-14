// Caneta compartilhada pela folha de escrita e pela escrita sobre a questão:
// a escolha (caneta/borracha, espessura, cor) vale para as duas enquanto o app está aberto.

import { html, icone } from "../render.js";
import { CORES, NOMES_CORES } from "./tracos.js";

export const caneta = { ferramenta: "caneta", espessura: "fina", cor: "tinta" };

const RAIO_PONTO = { fina: 2.5, grossa: 5 };

export function botaoFerramenta(acao, rotulo, conteudo, { ativo = null, desativado = false } = {}) {
  return html`<button type="button" class="rs-botao ${ativo ? "ativo" : ""}" data-rs="${acao}"
    aria-label="${rotulo}" title="${rotulo}" ${ativo === null ? "" : html`aria-pressed="${ativo}"`}
    ${desativado ? "disabled" : ""}>${conteudo}</button>`;
}

function pontoEspessura(nome) {
  return html`<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="${RAIO_PONTO[nome]}" fill="currentColor"/></svg>`;
}

/** Caneta fina, grossa, borracha e as três cores. */
export function botoesDeCaneta() {
  const comCaneta = caneta.ferramenta === "caneta";
  return html`
    ${botaoFerramenta("fina", "Caneta fina", pontoEspessura("fina"), { ativo: comCaneta && caneta.espessura === "fina" })}
    ${botaoFerramenta("grossa", "Caneta grossa", pontoEspessura("grossa"), { ativo: comCaneta && caneta.espessura === "grossa" })}
    ${botaoFerramenta("borracha", "Borracha (apaga o traço tocado)", icone("borracha"), { ativo: caneta.ferramenta === "borracha" })}
    ${CORES.map((cor) => botaoFerramenta(`cor-${cor}`, `Cor ${NOMES_CORES[cor]}`,
      html`<span class="rs-cor rs-cor-${cor}"></span>`, { ativo: caneta.cor === cor }))}`;
}

/** Traduz o botão tocado numa mudança da caneta, ou null se não for botão de caneta. */
export function mudancaDeCaneta(acao) {
  if (acao === "fina" || acao === "grossa") return { ferramenta: "caneta", espessura: acao };
  if (acao === "borracha") return { ferramenta: "borracha" };
  if (acao.startsWith("cor-")) return { ferramenta: "caneta", cor: acao.slice("cor-".length) };
  return null;
}
