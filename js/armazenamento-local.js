// Preferências pequenas deste aparelho (tema, tamanho do texto, divisão da folha) no
// localStorage. Sem localStorage (modo privado, bloqueio), a preferência vale só nesta abertura.

function lerLocal(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, String(valor));
  } catch {
    // Sem armazenamento: segue sem lembrar.
  }
}

/** Número salvo dentro de [minimo, maximo]; fora disso (ou ausente), o padrão. */
export function lerNumeroLocal(chave, padrao, minimo, maximo) {
  const valor = Number.parseFloat(lerLocal(chave));
  return Number.isFinite(valor) && valor >= minimo && valor <= maximo ? valor : padrao;
}
