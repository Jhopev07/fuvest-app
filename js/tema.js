// Tema claro/escuro. "auto" segue o sistema. A escolha fica no localStorage
// (lido de forma síncrona no index.html para não piscar) e é aplicada em <html data-tema>.

export const TEMAS = { auto: "Automático", claro: "Claro", escuro: "Escuro" };
const CHAVE = "fuvest-tema";
const COR_BARRA = { claro: "#f4f6f3", escuro: "#121614" };

export function temaEscolhido() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return TEMAS[salvo] ? salvo : "auto";
  } catch {
    return "auto";
  }
}

function temaEfetivo(escolha) {
  if (escolha !== "auto") return escolha;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function aplicarTema(escolha = temaEscolhido()) {
  const raiz = document.documentElement;
  if (escolha === "auto") delete raiz.dataset.tema;
  else raiz.dataset.tema = escolha;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", COR_BARRA[temaEfetivo(escolha)]);
}

export function escolherTema(escolha) {
  try {
    localStorage.setItem(CHAVE, escolha);
  } catch {
    // Sem localStorage o tema vale só nesta abertura.
  }
  aplicarTema(escolha);
}

export function acompanharSistema() {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => aplicarTema());
}
