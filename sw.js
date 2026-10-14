// Service worker: pré-cacheia o app inteiro e serve do cache (funciona offline).
// VERSAO é gerada por tools/build.py (hash do banco de questões + arquivos do app):
// qualquer mudança cria um cache novo e o app oferece a atualização.

const VERSAO = "6f57d08ee8";
const CACHE = `fuvest-${VERSAO}`;

const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./data/questoes.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./js/banco.js",
  "./js/config.js",
  "./js/cronometro.js",
  "./js/db.js",
  "./js/estatisticas.js",
  "./js/feedback-prova.js",
  "./js/letras.js",
  "./js/filtros-pratica.js",
  "./js/main.js",
  "./js/navegacao.js",
  "./js/pwa.js",
  "./js/rascunho.js",
  "./js/render.js",
  "./js/simulado-estado.js",
  "./js/tema.js",
  "./js/ui.js",
  "./js/util.js",
  "./js/vista-questao.js",
  "./js/telas/ajustes.js",
  "./js/telas/filtros.js",
  "./js/telas/historico.js",
  "./js/telas/inicio.js",
  "./js/telas/questao.js",
  "./js/telas/resultado.js",
  "./js/telas/revisao.js",
  "./js/telas/simulado.js",
];

self.addEventListener("install", (evento) => {
  // `cache: "reload"` ignora o cache HTTP para não pré-cachear arquivos velhos.
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: "reload" })))),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes
        .filter((nome) => nome.startsWith("fuvest-") && nome !== CACHE)
        .map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "SKIP_WAITING") self.skipWaiting();
});

async function responder(requisicao) {
  const cache = await caches.open(CACHE);
  if (requisicao.mode === "navigate") {
    return (await cache.match("./index.html")) ?? fetch(requisicao);
  }
  const emCache = await cache.match(requisicao, { ignoreSearch: true });
  return emCache ?? fetch(requisicao);
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  evento.respondWith(responder(request));
});
