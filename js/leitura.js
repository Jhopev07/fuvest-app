// Ajustes de leitura comuns às telas de questão: A−/A+, pinça no texto e
// tabelas/figuras que abrem no visualizador.

import { aoAgir } from "./ui.js";
import { ampliarAoTocar } from "./visualizador.js";
import { mudarTamanho, pincaNoTexto } from "./zoom-texto.js";

/** Com a folha de escrita aberta, quem rola a questão é o contêiner da tela, não a página. */
function roladorDa(tela) {
  return document.documentElement.classList.contains("modo-folha") ? tela : document.scrollingElement;
}

export function prepararLeitura(tela, sinal) {
  tela.classList.add("leitura");
  aoAgir(tela, sinal, {
    "texto-menor": () => mudarTamanho(-1),
    "texto-maior": () => mudarTamanho(1),
  });
  pincaNoTexto(tela, sinal, () => roladorDa(tela));
  ampliarAoTocar(tela, sinal);
}

/** Volta a questão para o topo (na página ou no painel da questão, com a folha aberta). */
export function rolarQuestaoParaTopo(tela) {
  window.scrollTo(0, 0);
  tela.scrollTop = 0;
}
