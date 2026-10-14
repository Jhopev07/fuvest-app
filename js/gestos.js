// Gestos com Pointer Events sobre um elemento com `touch-action: none`:
// um ponteiro → `um` (desenhar, arrastar); dois → `dois` (pinça e pan).
//
// `um`:   inicio(ponto, evento), mover(ponto, evento), fim(evento), interromper()
//         (`interromper` avisa que um segundo dedo chegou no meio do gesto de um dedo).
// `dois`: inicio(), mover({ centro, passoEscala, deslocamento }), fim()
//         (`passoEscala` e `deslocamento` são relativos ao movimento ANTERIOR, para compor).
// Pontos em coordenadas de tela (clientX, clientY). Uma caneta encostada ignora toques (palma).

import { distancia, pontoMedio } from "./geometria.js";

function pontoDe(evento) {
  return [evento.clientX, evento.clientY];
}

function eventosCoalescidos(evento) {
  const lista = evento.getCoalescedEvents?.();
  return lista && lista.length ? lista : [evento];
}

export function acompanharGestos(elemento, { um = {}, dois = {} }, sinal) {
  const ponteiros = new Map(); // pointerId → { ponto, tipo }
  let modo = null; // "um" | "dois" | "esperando" (sobrou um dedo depois da pinça)
  let pincaAnterior = null;

  const pares = () => [...ponteiros.values()].slice(0, 2).map((p) => p.ponto);
  const temCaneta = () => [...ponteiros.values()].some((p) => p.tipo === "pen");

  function estadoDaPinca() {
    const [a, b] = pares();
    return { centro: pontoMedio(a, b), distancia: Math.max(1, distancia(a, b)) };
  }

  function aoPressionar(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && temCaneta()) return;
    if (ponteiros.size >= 2) return;
    e.preventDefault();
    elemento.setPointerCapture?.(e.pointerId);
    ponteiros.set(e.pointerId, { ponto: pontoDe(e), tipo: e.pointerType });
    if (ponteiros.size === 1) {
      modo = "um";
      um.inicio?.(pontoDe(e), e);
      return;
    }
    if (modo === "um") um.interromper?.();
    modo = "dois";
    pincaAnterior = estadoDaPinca();
    dois.inicio?.();
  }

  function aoMover(e) {
    const ponteiro = ponteiros.get(e.pointerId);
    if (!ponteiro) return;
    e.preventDefault();
    if (modo === "um") {
      eventosCoalescidos(e).forEach((ev) => um.mover?.(pontoDe(ev), ev));
      ponteiro.ponto = pontoDe(e);
      return;
    }
    ponteiro.ponto = pontoDe(e);
    if (modo !== "dois" || ponteiros.size < 2) return;
    const atual = estadoDaPinca();
    dois.mover?.({
      centro: atual.centro,
      passoEscala: atual.distancia / pincaAnterior.distancia,
      deslocamento: [atual.centro[0] - pincaAnterior.centro[0], atual.centro[1] - pincaAnterior.centro[1]],
    });
    pincaAnterior = atual;
  }

  function aoSoltar(e) {
    if (!ponteiros.delete(e.pointerId)) return;
    if (modo === "um") um.fim?.(e);
    if (modo === "dois" && ponteiros.size < 2) dois.fim?.();
    modo = ponteiros.size === 0 ? null : "esperando";
  }

  const opcoes = { signal: sinal };
  elemento.addEventListener("pointerdown", aoPressionar, opcoes);
  elemento.addEventListener("pointermove", aoMover, opcoes);
  elemento.addEventListener("pointerup", aoSoltar, opcoes);
  elemento.addEventListener("pointercancel", aoSoltar, opcoes);
}
