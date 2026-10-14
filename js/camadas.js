// Camadas sobre a tela (folha de escrita, escrita sobre a questão, visualizador) que o
// "voltar" do Android fecha. Cada camada aberta empilha uma entrada no histórico cujo
// `state.camadas` lista os ids abertos naquele ponto; ao voltar para uma entrada,
// as camadas que não estão na lista dela são destruídas.
//
// As operações no histórico são assíncronas (history.go), então rodam numa fila:
// abrir uma camada logo depois de fechar outra não embaralha as entradas.
// `destruir(motivo)` recebe "voltar", "fechar" (pela interface) ou "saida" (a tela mudou).

const ESPERA_MAX_HISTORICO_MS = 600;

const pilha = [];
let proximoId = Date.now(); // ids não se repetem entre aberturas do app
let fila = Promise.resolve();

function naFila(tarefa) {
  fila = fila.then(tarefa, tarefa);
  return fila;
}

function idsNoHistorico() {
  return history.state?.camadas ?? [];
}

window.addEventListener("popstate", () => {
  const abertas = new Set(idsNoHistorico());
  for (let i = pilha.length - 1; i >= 0; i--) {
    if (!abertas.has(pilha[i].id)) pilha.splice(i, 1)[0].destruir("voltar");
  }
});

function voltarNoHistorico(voltas) {
  if (voltas <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const concluir = () => {
      clearTimeout(limite);
      window.removeEventListener("popstate", concluir);
      resolve();
    };
    const limite = setTimeout(concluir, ESPERA_MAX_HISTORICO_MS);
    window.addEventListener("popstate", concluir);
    history.go(-voltas);
  });
}

/** Tira do histórico as entradas a partir da camada `id` (se ela estiver no topo dele). */
function tirarDoHistorico(id) {
  return naFila(() => {
    const ids = idsNoHistorico();
    const posicao = ids.indexOf(id);
    return voltarNoHistorico(posicao < 0 ? 0 : ids.length - posicao);
  });
}

/**
 * Abre uma camada e devolve `fechar()`, que a destrói (motivo "fechar") e resolve
 * quando o histórico voltar ao ponto de antes dela.
 */
export function abrirCamada(destruir) {
  const camada = { id: proximoId++, destruir };
  pilha.push(camada);
  const ids = pilha.map((c) => c.id);
  naFila(() => history.pushState({ ...history.state, camadas: ids }, ""));
  return () => {
    const posicao = pilha.indexOf(camada);
    if (posicao < 0) return fila;
    pilha.splice(posicao).reverse().forEach((c) => c.destruir("fechar"));
    return tirarDoHistorico(camada.id);
  };
}

/**
 * Ao abrir o app: se a página foi recarregada com camadas abertas, o histórico ainda
 * tem as entradas delas. Volta até a entrada da tela, para o "voltar" não ficar mudo.
 */
export function limparCamadasDeAberturaAnterior() {
  const ids = idsNoHistorico();
  return ids.length ? naFila(() => voltarNoHistorico(ids.length)) : fila;
}

/** Antes de o app navegar: fecha tudo e tira as entradas das camadas do histórico. */
export function fecharTodasAsCamadas() {
  if (!pilha.length) return fila;
  const primeira = pilha[0].id;
  descartarTodasAsCamadas();
  return tirarDoHistorico(primeira);
}

/** A tela já mudou (ex.: um link): só destrói, sem mexer no histórico. */
export function descartarTodasAsCamadas() {
  pilha.splice(0).reverse().forEach((camada) => camada.destruir("saida"));
}
