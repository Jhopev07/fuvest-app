// Filtros da prática: conversão entre objeto, URL e armazenamento.

import { MATERIAS } from "./config.js";

const FILTROS_PADRAO = Object.freeze({ materias: [], soAcima: false, priorizarNaoRespondidas: true });

export function filtrosDaConsulta(consulta) {
  const materias = (consulta.m ?? "").split(",").filter((m) => MATERIAS[m]);
  return {
    materias,
    soAcima: consulta.acima === "1",
    priorizarNaoRespondidas: consulta.priorizar !== "0",
  };
}

export function consultaDosFiltros(filtros) {
  const consulta = { priorizar: filtros.priorizarNaoRespondidas ? "1" : "0" };
  if (filtros.materias.length) consulta.m = filtros.materias.join(",");
  if (filtros.soAcima) consulta.acima = "1";
  return consulta;
}

export function normalizarFiltros(salvos) {
  if (!salvos || typeof salvos !== "object") return { ...FILTROS_PADRAO };
  return {
    materias: Array.isArray(salvos.materias) ? salvos.materias.filter((m) => MATERIAS[m]) : [],
    soAcima: Boolean(salvos.soAcima),
    priorizarNaoRespondidas: salvos.priorizarNaoRespondidas !== false,
  };
}
