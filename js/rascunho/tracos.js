// Traços de caneta guardados como vetores: { cor, largura, pontos: [[x, y], ...] }.
// Desenho suavizado (curvas quadráticas pelos pontos médios) e borracha que apaga
// traços inteiros. Usado pela folha de escrita e pelo rascunho sobre a questão.

import { distancia, distanciaAoSegmento, pontoMedio } from "../geometria.js";

const ESPESSURAS = { fina: 2.5, grossa: 6 };
export const CORES = ["tinta", "azul", "vermelho"];
export const NOMES_CORES = { tinta: "Grafite", azul: "Azul", vermelho: "Vermelho" };
export const RAIO_BORRACHA_PX = 14;
const CASAS_COORDENADA = 10; // guarda 1 casa decimal

const limitesEmCache = new WeakMap();

export function arredondar(valor) {
  return Math.round(valor * CASAS_COORDENADA) / CASAS_COORDENADA;
}

export function novoTraco(ponto, { cor, espessura }) {
  return { cor, largura: ESPESSURAS[espessura], pontos: [ponto] };
}

/** Acrescenta o ponto se ele não repetir o último. Devolve se acrescentou. */
export function acrescentarPonto(traco, ponto) {
  const ultimo = traco.pontos[traco.pontos.length - 1];
  if (ultimo[0] === ponto[0] && ultimo[1] === ponto[1]) return false;
  traco.pontos.push(ponto);
  limitesEmCache.delete(traco);
  return true;
}

function tracoTocado(traco, ponto, raio) {
  const alcance = raio + traco.largura / 2;
  const pts = traco.pontos;
  if (pts.length === 1) return distancia(ponto, pts[0]) <= alcance;
  for (let i = 1; i < pts.length; i++) {
    if (distanciaAoSegmento(ponto, pts[i - 1], pts[i]) <= alcance) return true;
  }
  return false;
}

/** Remove os traços tocados. Devolve a MESMA lista quando nada foi apagado. */
export function apagarTocados(tracos, ponto, raio) {
  const restantes = tracos.filter((t) => !tracoTocado(t, ponto, raio));
  return restantes.length === tracos.length ? tracos : restantes;
}

/** Retângulo que contém o traço (com a espessura), calculado uma vez por traço. */
export function limitesDoTraco(traco) {
  let limites = limitesEmCache.get(traco);
  if (!limites) {
    const xs = traco.pontos.map((p) => p[0]);
    const ys = traco.pontos.map((p) => p[1]);
    const folga = traco.largura;
    limites = {
      x0: Math.min(...xs) - folga, y0: Math.min(...ys) - folga,
      x1: Math.max(...xs) + folga, y1: Math.max(...ys) + folga,
    };
    limitesEmCache.set(traco, limites);
  }
  return limites;
}

/** Cores dos traços no tema atual (variáveis --rascunho-*). */
export function coresDoTema() {
  const estilo = getComputedStyle(document.documentElement);
  return Object.fromEntries(CORES.map((c) => [c, estilo.getPropertyValue(`--rascunho-${c}`).trim() || "#333"]));
}

function prepararPincel(ctx, traco, cores) {
  ctx.strokeStyle = cores[traco.cor] ?? cores.tinta;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = traco.largura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export function desenharTraco(ctx, traco, cores) {
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
export function desenharFinalDoTraco(ctx, traco, cores) {
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

/** Círculo tracejado que mostra onde a borracha está. */
export function desenharBorracha(ctx, centro, raio, cor, larguraLinha) {
  ctx.beginPath();
  ctx.arc(centro[0], centro[1], raio, 0, Math.PI * 2);
  ctx.lineWidth = larguraLinha;
  ctx.strokeStyle = cor;
  ctx.setLineDash([larguraLinha * 3, larguraLinha * 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}
