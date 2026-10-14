// Service worker, aviso de nova versão, aviso de "pronto para offline" e
// pedido de armazenamento persistente.

import { gravarAjuste, lerAjuste } from "./db.js";
import { avisar, mostrarFaixa } from "./ui.js";

const CHAVE_AVISO_OFFLINE = "avisoOfflineMostrado";
const CHAVE_PERSISTENCIA_PEDIDA = "persistenciaPedida";

let atualizacaoPedida = false;

function oferecerAtualizacao(registro) {
  const esperando = registro.waiting;
  if (!esperando || !navigator.serviceWorker.controller) return;
  mostrarFaixa({
    id: "faixa-atualizar",
    texto: "Nova versão com mais questões — toque para atualizar",
    aoTocar: () => {
      atualizacaoPedida = true;
      esperando.postMessage({ tipo: "SKIP_WAITING" });
    },
  });
}

function vigiarNovaVersao(registro) {
  oferecerAtualizacao(registro);
  registro.addEventListener("updatefound", () => {
    const novo = registro.installing;
    novo?.addEventListener("statechange", () => {
      if (novo.state === "installed") oferecerAtualizacao(registro);
    });
  });
  // Só recarrega quando o usuário pediu a atualização; na primeira instalação o
  // SW também assume o controle (clients.claim) e isso não deve recarregar a tela.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!atualizacaoPedida) return;
    atualizacaoPedida = false;
    location.reload();
  });
}

async function anunciarProntoOffline() {
  await navigator.serviceWorker.ready;
  if (await lerAjuste(CHAVE_AVISO_OFFLINE, false)) return;
  avisar("Pronto para usar sem internet ✓");
  await gravarAjuste(CHAVE_AVISO_OFFLINE, true);
}

export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registro = await navigator.serviceWorker.register("./sw.js");
    vigiarNovaVersao(registro);
    anunciarProntoOffline().catch((erro) => console.warn(erro));
  } catch (erro) {
    console.warn("Service worker não registrado; o app não funcionará offline.", erro);
  }
}

export async function statusPersistencia() {
  if (!navigator.storage?.persisted) return "indisponível";
  try {
    return (await navigator.storage.persisted()) ? "concedido" : "não concedido";
  } catch {
    return "indisponível";
  }
}

export async function pedirPersistencia() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** No primeiro uso, pede para o navegador não apagar os dados sozinho. */
export async function pedirPersistenciaNoPrimeiroUso() {
  if (await lerAjuste(CHAVE_PERSISTENCIA_PEDIDA, false)) return;
  await pedirPersistencia();
  await gravarAjuste(CHAVE_PERSISTENCIA_PEDIDA, true);
}
