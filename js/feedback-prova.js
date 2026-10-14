// Análise da prova inteira, gerada por regras a partir de uma sessão corrigida.
// Também produz o relatório em texto puro para colar numa conversa.

import {
  AREAS, FEEDBACK, MATERIAS, ORDEM_AREAS, SIMULADO, areaDaMateria, nomeMateria,
} from "./config.js";
import { letraDe } from "./letras.js";
import { assuntoDoTema, doPiorParaOMelhor } from "./estatisticas.js";
import {
  agruparPor, formatarData, formatarDecimal, formatarDuracao, formatarPercentual, minutos, razao,
} from "./util.js";

function placar(itens) {
  const acertos = itens.filter((i) => i.acertou).length;
  return { acertos, total: itens.length, taxa: razao(acertos, itens.length) };
}

function porMateria(itens) {
  const grupos = agruparPor(itens, (i) => i.materia);
  return Object.keys(MATERIAS)
    .filter((m) => grupos.has(m))
    .map((materia) => ({ materia, nome: nomeMateria(materia), ...placar(grupos.get(materia)) }));
}

function porArea(itens) {
  const grupos = agruparPor(itens, (i) => areaDaMateria(i.materia));
  return ORDEM_AREAS
    .filter((a) => grupos.has(a))
    .map((area) => ({ area, nome: AREAS[area].nome, ...placar(grupos.get(area)) }));
}

/** Temas errados agrupados por assunto, do mais errado para o menos. */
function assuntosErrados(itens) {
  const errados = itens.filter((i) => !i.acertou);
  const grupos = agruparPor(errados, (i) => `${i.materia}|${assuntoDoTema(i.tema)}`);
  return [...grupos.values()]
    .map((lista) => ({
      materia: lista[0].materia,
      assunto: assuntoDoTema(lista[0].tema),
      temas: [...new Set(lista.map((i) => i.tema))],
      erros: lista.length,
      ids: lista.map((i) => i.qid),
    }))
    .sort((a, b) => b.erros - a.erros);
}

function analiseTempo(sessao) {
  const respondidas = sessao.itens.filter((i) => i.escolhida !== null);
  const ritmo = respondidas.length ? minutos(sessao.tempoMs) / respondidas.length : 0;
  const emBranco = sessao.itens.length - respondidas.length;
  const lentas = [...sessao.itens]
    .map((item, n) => ({ ...item, numero: n + 1 }))
    .sort((a, b) => b.tempoMs - a.tempoMs)
    .slice(0, FEEDBACK.numQuestoesLentas)
    .filter((i) => i.tempoMs > 0);
  return { ritmo, emBranco, lentas, dentroDaMeta: ritmo <= SIMULADO.metaMinPorQuestao };
}

function frasesDeTempo({ ritmo, emBranco, dentroDaMeta }, tempoMs) {
  const frases = [];
  const meta = formatarDecimal(SIMULADO.metaMinPorQuestao, 2);
  if (ritmo === 0) {
    frases.push("Nenhuma questão respondida — não dá para medir o ritmo.");
  } else if (dentroDaMeta) {
    frases.push(`Ritmo de ${formatarDecimal(ritmo)} min/questão, dentro da meta de ${meta} min.`);
  } else {
    frases.push(`Ritmo de ${formatarDecimal(ritmo)} min/questão, acima da meta de ${meta} min. ` +
      "Na prova real, marque as difíceis e volte a elas no fim.");
  }
  frases.push(`Tempo total: ${formatarDuracao(tempoMs)} de ${formatarDuracao(SIMULADO.duracaoMs)}.`);
  if (emBranco > 0) {
    frases.push(`${emBranco} em branco. Na Fuvest não há desconto por erro: chute sempre.`);
  }
  return frases;
}

function recomendacoes(assuntos, errosFuvest) {
  const prioridadeFuvest = new Set(errosFuvest.map((i) => `${i.materia}|${assuntoDoTema(i.tema)}`));
  const ordenados = [...assuntos].sort((a, b) => {
    const pa = prioridadeFuvest.has(`${a.materia}|${a.assunto}`) ? 1 : 0;
    const pb = prioridadeFuvest.has(`${b.materia}|${b.assunto}`) ? 1 : 0;
    return pb - pa || b.erros - a.erros;
  });
  return ordenados.slice(0, FEEDBACK.numRecomendacoes).map((a) => {
    const base = prioridadeFuvest.has(`${a.materia}|${a.assunto}`) ? "inclui erro em questão nível Fuvest" : "";
    const detalhe = [`${a.erros} erro${a.erros > 1 ? "s" : ""}`, base].filter(Boolean).join(", ");
    return `Revisar ${nomeMateria(a.materia)} — ${a.assunto} (${detalhe}): refaça as questões erradas pelo “Revisar erros” e depois resolva novas do mesmo assunto.`;
  });
}

export function analisarProva(sessao) {
  const materias = porMateria(sessao.itens);
  const assuntos = assuntosErrados(sessao.itens);
  const errosFuvest = sessao.itens.filter((i) => !i.acertou && i.nivel === "fuvest");
  const errosAcima = sessao.itens.filter((i) => !i.acertou && i.nivel === "acima");
  const tempo = analiseTempo(sessao);
  return {
    nota: placar(sessao.itens),
    abaixoDoCorte: sessao.acertos < SIMULADO.corteEliminatorio,
    materias,
    areas: porArea(sessao.itens),
    fortes: materias.filter((m) => m.taxa >= FEEDBACK.limiarForte),
    fracos: doPiorParaOMelhor(materias.filter((m) => m.taxa <= FEEDBACK.limiarFraco)),
    assuntos,
    errosFuvest,
    errosAcima,
    tempo,
    frasesTempo: frasesDeTempo(tempo, sessao.tempoMs),
    recomendacoes: recomendacoes(assuntos, errosFuvest),
  };
}

// ---------- Relatório em texto puro ----------

function linhaPlacar(rotulo, p) {
  return `- ${rotulo}: ${p.acertos}/${p.total} (${formatarPercentual(p.taxa)})`;
}

function respostaEmLetra(item) {
  return item.escolhida === null ? "branco" : letraDe(item.ordem, item.escolhida);
}

export function relatorioTexto(sessao, analise) {
  const { nota } = analise;
  const linhas = [
    `Simulado Fuvest 1ª fase — ${formatarData(sessao.entregueEm)}`,
    `Nota: ${nota.acertos}/${nota.total} (${formatarPercentual(nota.taxa)})` +
      (analise.abaixoDoCorte ? ` — abaixo do corte eliminatório de ${SIMULADO.corteEliminatorio}` : ""),
    `Tempo: ${formatarDuracao(sessao.tempoMs)}; ritmo ${formatarDecimal(analise.tempo.ritmo)} min/questão ` +
      `(meta ${formatarDecimal(SIMULADO.metaMinPorQuestao, 2)}); em branco: ${analise.tempo.emBranco}`,
    "",
    "Por área:",
    ...analise.areas.map((a) => linhaPlacar(a.nome, a)),
    "",
    "Por matéria:",
    ...analise.materias.map((m) => linhaPlacar(m.nome, m)),
    "",
    `Erros em questões nível Fuvest (${analise.errosFuvest.length}): ` +
      (analise.errosFuvest.map((i) => i.qid).join(", ") || "nenhum"),
    `Erros em questões acima da Fuvest (${analise.errosAcima.length}): ` +
      (analise.errosAcima.map((i) => i.qid).join(", ") || "nenhum"),
    "",
    "Temas errados:",
    ...(analise.assuntos.length
      ? analise.assuntos.flatMap((a) => a.temas.map((t) => {
        const ids = sessao.itens.filter((i) => !i.acertou && i.tema === t).map((i) => i.qid);
        return `- ${nomeMateria(a.materia)} | ${t}: ${ids.join(", ")}`;
      }))
      : ["- nenhum"]),
    "",
    "Respostas (nº. id — marcada/certa):",
    ...sessao.itens.map((item, n) =>
      `${n + 1}. ${item.qid} — ${respostaEmLetra(item)}/${letraDe(item.ordem, item.correta)} ` +
      `${item.acertou ? "✓" : "✗"}`),
  ];
  return linhas.join("\n");
}
