// Estado do simulado em andamento e correção. Funções puras sobre objetos
// simples (guardados como estão no IndexedDB).

import { MODOS, SIMULADO } from "./config.js";
import { gerarId, minutos } from "./util.js";
import { ordemEmbaralhada } from "./banco.js";

export function novoSimulado({ questoes, avisos }) {
  return {
    id: gerarId("sim-"),
    iniciadoEm: new Date().toISOString(),
    itens: questoes.map((q) => ({
      qid: q.id, ordem: ordemEmbaralhada(), escolhida: null, revisar: false, tempoMs: 0,
    })),
    atual: 0,
    tempoMs: 0,
    avisos,
    rascunhos: {},
  };
}

export function marcarResposta(sim, indice, original) {
  sim.itens[indice].escolhida = original;
}

export function alternarRevisar(sim, indice) {
  sim.itens[indice].revisar = !sim.itens[indice].revisar;
}

export function irParaQuestao(sim, indice) {
  sim.atual = Math.max(0, Math.min(sim.itens.length - 1, indice));
}

export function resumoDoSimulado(sim) {
  const respondidas = sim.itens.filter((i) => i.escolhida !== null).length;
  return {
    total: sim.itens.length,
    respondidas,
    emBranco: sim.itens.length - respondidas,
    marcadas: sim.itens.filter((i) => i.revisar).length,
  };
}

export function ritmoMinPorQuestao(sim) {
  const { respondidas } = resumoDoSimulado(sim);
  return respondidas > 0 ? minutos(sim.tempoMs) / respondidas : 0;
}

export function tempoRestanteMs(sim) {
  return SIMULADO.duracaoMs - sim.tempoMs;
}

/** Faixas de área na ordem da prova: [{area, inicio, fim}] (índices 0-based, fim inclusivo). */
export function faixasPorArea(sim, areaDe) {
  const faixas = [];
  sim.itens.forEach((item, i) => {
    const area = areaDe(item.qid);
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.area === area) ultima.fim = i;
    else faixas.push({ area, inicio: i, fim: i });
  });
  return faixas;
}

function itemCorrigido(item, q) {
  return {
    qid: item.qid,
    materia: q?.materia ?? "",
    tema: q?.tema ?? "",
    nivel: q?.nivel ?? "",
    ordem: item.ordem,
    escolhida: item.escolhida,
    correta: q?.correta ?? null,
    acertou: q ? item.escolhida === q.correta : false,
    tempoMs: Math.round(item.tempoMs),
    revisar: item.revisar,
  };
}

/** Corrige o simulado: devolve a sessão (para o histórico) e as tentativas (uma por questão). */
export function corrigirSimulado(sim, questaoPorId) {
  const entregueEm = new Date().toISOString();
  const itens = sim.itens.map((item) => itemCorrigido(item, questaoPorId(item.qid)));
  const sessao = {
    id: sim.id,
    iniciadoEm: sim.iniciadoEm,
    entregueEm,
    tempoMs: Math.round(sim.tempoMs),
    acertos: itens.filter((i) => i.acertou).length,
    total: itens.length,
    avisos: sim.avisos ?? [],
    itens,
  };
  const tentativas = itens.map((item, n) => ({
    id: `${sim.id}-${n + 1}`,
    qid: item.qid,
    materia: item.materia,
    tema: item.tema,
    nivel: item.nivel,
    escolhida: item.escolhida,
    acertou: item.acertou,
    tempoMs: item.tempoMs,
    modo: MODOS.simulado,
    sessaoId: sim.id,
    ordem: item.ordem,
    quando: entregueEm,
  }));
  return { sessao, tentativas };
}
