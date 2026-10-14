// Estatísticas derivadas das tentativas registradas. Funções puras.

import { MATERIAS, nomeMateria } from "./config.js";
import { agruparPor, chaveDoDia, diaAnterior, razao } from "./util.js";

const SEPARADOR_TEMA = " — ";

/** "Funções — exponencial e logaritmo" → "Funções". */
export function assuntoDoTema(tema) {
  return String(tema ?? "").split(SEPARADOR_TEMA)[0].trim() || "Sem tema";
}

export function contarVezesVista(tentativas) {
  const vezes = new Map();
  tentativas.forEach((t) => vezes.set(t.qid, (vezes.get(t.qid) ?? 0) + 1));
  return vezes;
}

/** Dias seguidos com pelo menos uma tentativa, contando até hoje (ou até ontem, se hoje ainda não houve). */
function sequenciaDeDias(tentativas, hoje = new Date()) {
  const dias = new Set(tentativas.map((t) => chaveDoDia(t.quando)));
  let dia = dias.has(chaveDoDia(hoje)) ? hoje : diaAnterior(hoje);
  let sequencia = 0;
  while (dias.has(chaveDoDia(dia))) {
    sequencia += 1;
    dia = diaAnterior(dia);
  }
  return sequencia;
}

function placar(lista) {
  const acertos = lista.filter((t) => t.acertou).length;
  return { acertos, total: lista.length, taxa: razao(acertos, lista.length) };
}

export function resumoGeral(tentativas) {
  return {
    ...placar(tentativas),
    questoesDistintas: new Set(tentativas.map((t) => t.qid)).size,
    sequencia: sequenciaDeDias(tentativas),
  };
}

/** Placar por matéria, na ordem de config (todas as matérias, mesmo sem tentativas). */
export function desempenhoPorMateria(tentativas) {
  const grupos = agruparPor(tentativas, (t) => t.materia);
  return Object.keys(MATERIAS).map((materia) => ({
    materia,
    nome: nomeMateria(materia),
    ...placar(grupos.get(materia) ?? []),
  }));
}

/** Placar por assunto (matéria + prefixo do tema). */
export function desempenhoPorAssunto(tentativas) {
  const grupos = agruparPor(tentativas, (t) => `${t.materia}|${assuntoDoTema(t.tema)}`);
  return [...grupos.entries()].map(([chave, lista]) => {
    const [materia, assunto] = chave.split("|");
    return { materia, assunto, ...placar(lista) };
  });
}

/** Do pior para o melhor; com a mesma taxa, quem tem mais tentativas vem antes. */
export function doPiorParaOMelhor(placares) {
  return [...placares].sort((a, b) => a.taxa - b.taxa || b.total - a.total);
}

/** Questões cuja ÚLTIMA tentativa foi errada, da mais antiga para a mais recente. */
export function filaDeErros(tentativas) {
  const ultima = new Map();
  tentativas.forEach((t) => {
    const anterior = ultima.get(t.qid);
    if (!anterior || t.quando >= anterior.quando) ultima.set(t.qid, t);
  });
  return [...ultima.values()]
    .filter((t) => !t.acertou)
    .sort((a, b) => a.quando.localeCompare(b.quando))
    .map((t) => t.qid);
}
