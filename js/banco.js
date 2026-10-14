// Banco de questões: carga, embaralhamento de alternativas e seleção de questões.

import {
  CAMINHO_BANCO, MATERIAS, ORDEM_AREAS, SIMULADO, TOTAL_SIMULADO, areaDaMateria, nomeMateria,
} from "./config.js";
import { embaralhar, sortearUm, agruparPor } from "./util.js";

const NUM_ALTERNATIVAS = 5;

let banco = { versao: "", geradoEm: "", questoes: [], porId: new Map() };

function questaoValida(q) {
  return q && typeof q.id === "string" && MATERIAS[q.materia] &&
    Array.isArray(q.alternativas) && q.alternativas.length === NUM_ALTERNATIVAS &&
    Number.isInteger(q.correta);
}

export async function carregarBanco() {
  const resposta = await fetch(CAMINHO_BANCO);
  if (!resposta.ok) throw new Error(`Falha ao carregar questões (HTTP ${resposta.status})`);
  const dados = await resposta.json();
  const questoes = (dados.questoes ?? []).filter(questaoValida);
  banco = {
    versao: dados.versao ?? "",
    geradoEm: dados.geradoEm ?? "",
    questoes,
    porId: new Map(questoes.map((q) => [q.id, q])),
  };
  return banco;
}

export function infoBanco() {
  return { versao: banco.versao, geradoEm: banco.geradoEm, total: banco.questoes.length };
}

export function questaoPorId(id) {
  return banco.porId.get(id);
}

export function contarPorMateria() {
  const contagem = Object.fromEntries(Object.keys(MATERIAS).map((m) => [m, 0]));
  banco.questoes.forEach((q) => { contagem[q.materia] += 1; });
  return contagem;
}

/** Permutação dos índices originais: ordem[posição exibida] = índice original. */
export function ordemEmbaralhada() {
  return embaralhar([...Array(NUM_ALTERNATIVAS).keys()]);
}

// ---------- Prática ----------

function passaNosFiltros(q, filtros) {
  const materiaOk = filtros.materias.length === 0 || filtros.materias.includes(q.materia);
  const nivelOk = !filtros.soAcima || q.nivel === "acima";
  return materiaOk && nivelOk;
}

export function questoesFiltradas(filtros) {
  return banco.questoes.filter((q) => passaNosFiltros(q, filtros));
}

/**
 * Sorteia a próxima questão da prática. Sorteio uniforme sobre as questões elegíveis,
 * o que já dá a cada matéria um peso proporcional ao seu tamanho no banco.
 * Evita repetir questões da sessão até esgotar o conjunto filtrado.
 */
export function sortearPratica(filtros, vistasNaSessao, vezesVista) {
  const elegiveis = questoesFiltradas(filtros);
  if (elegiveis.length === 0) return null;
  const naoVistasNaSessao = elegiveis.filter((q) => !vistasNaSessao.has(q.id));
  const base = naoVistasNaSessao.length ? naoVistasNaSessao : elegiveis;
  if (filtros.priorizarNaoRespondidas) {
    const ineditas = base.filter((q) => !vezesVista.get(q.id));
    if (ineditas.length) return sortearUm(ineditas);
  }
  return sortearUm(base);
}

// ---------- Simulado ----------

/** Ordena por menos vistas; empates em ordem aleatória. */
function porMenosVistas(questoes, vezesVista) {
  return embaralhar(questoes).sort((a, b) => (vezesVista.get(a.id) ?? 0) - (vezesVista.get(b.id) ?? 0));
}

function escolherDaMateria(materia, quantidade, vezesVista) {
  const daMateria = banco.questoes.filter((q) => q.materia === materia);
  return porMenosVistas(daMateria, vezesVista).slice(0, quantidade);
}

function completarComArea(area, faltam, usadas, vezesVista) {
  const candidatas = banco.questoes.filter((q) => areaDaMateria(q.materia) === area && !usadas.has(q.id));
  return porMenosVistas(candidatas, vezesVista).slice(0, faltam);
}

function completarComQualquer(faltam, usadas, vezesVista) {
  const candidatas = banco.questoes.filter((q) => !usadas.has(q.id));
  return porMenosVistas(candidatas, vezesVista).slice(0, faltam);
}

function ordenarComoProva(questoes) {
  const porArea = agruparPor(questoes, (q) => areaDaMateria(q.materia));
  return ORDEM_AREAS.flatMap((area) => embaralhar(porArea.get(area) ?? []));
}

/**
 * Escolhe as questões do simulado: prefere nunca vistas, depois as menos vistas.
 * Se faltar questão numa matéria, completa com a mesma área (e, em último caso, com qualquer uma).
 * Devolve as questões em ordem de prova e os avisos para a tela inicial do simulado.
 */
export function planejarSimulado(vezesVista) {
  const usadas = new Set();
  const escolhidas = [];
  const avisos = [];
  const adicionar = (lista) => lista.forEach((q) => { usadas.add(q.id); escolhidas.push(q); });

  for (const [materia, quantidade] of Object.entries(SIMULADO.distribuicao)) {
    const daMateria = escolherDaMateria(materia, quantidade, vezesVista);
    adicionar(daMateria);
    const faltam = quantidade - daMateria.length;
    if (faltam > 0) {
      const area = areaDaMateria(materia);
      const extras = completarComArea(area, faltam, usadas, vezesVista);
      adicionar(extras);
      avisos.push(`${nomeMateria(materia)}: só há ${daMateria.length} de ${quantidade}; ` +
        `${extras.length} completada(s) com outras matérias da mesma área.`);
    }
  }
  if (escolhidas.length < TOTAL_SIMULADO) {
    const extras = completarComQualquer(TOTAL_SIMULADO - escolhidas.length, usadas, vezesVista);
    adicionar(extras);
    if (extras.length) avisos.push(`${extras.length} questão(ões) vieram de outras áreas por falta no banco.`);
  }
  if (escolhidas.length < TOTAL_SIMULADO) {
    avisos.push(`O banco só tem ${escolhidas.length} questões; o simulado terá esse tamanho.`);
  }
  const ineditas = escolhidas.filter((q) => !vezesVista.get(q.id)).length;
  return { questoes: ordenarComoProva(escolhidas), avisos, ineditas };
}
