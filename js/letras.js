// Conversão entre o índice ORIGINAL de uma alternativa e a letra exibida.
// `ordem[posição exibida] = índice original`.

import { LETRAS } from "./config.js";

const SEM_LETRA = "–";

export function letraDe(ordem, indiceOriginal) {
  const posicao = Array.isArray(ordem) ? ordem.indexOf(indiceOriginal) : -1;
  return posicao >= 0 ? LETRAS[posicao] : SEM_LETRA;
}
