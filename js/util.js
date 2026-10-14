// Utilitários puros: sorteio, identificadores, datas e formatação.

const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 86_400_000;

export function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function sortearUm(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

export function gerarId(prefixo = "") {
  const aleatorio = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefixo + aleatorio;
}

export function agruparPor(lista, chaveDe) {
  const grupos = new Map();
  for (const item of lista) {
    const chave = chaveDe(item);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  }
  return grupos;
}

export function razao(parte, total) {
  return total > 0 ? parte / total : 0;
}

export function formatarPercentual(fracao) {
  return `${Math.round(fracao * 100)}%`;
}

export function formatarDecimal(numero, casas = 1) {
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function minutos(ms) {
  return ms / MS_POR_MINUTO;
}

/** 3h05, 47min, 0min. */
export function formatarDuracao(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / MS_POR_MINUTO);
  const horas = Math.floor(totalMin / 60);
  const resto = totalMin % 60;
  if (horas === 0) return `${resto}min`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/** 1:02:09 (relógio). */
export function formatarRelogio(ms) {
  const totalSeg = Math.floor(Math.max(0, ms) / 1000);
  const horas = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;
  return `${horas}:${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatarDataHora(iso) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** Chave AAAA-MM-DD no fuso local. */
export function chaveDoDia(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diaAnterior(data) {
  const d = new Date(data);
  d.setDate(d.getDate() - 1);
  return d;
}

export function diasAte(dataAlvo, hoje = new Date()) {
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((dataAlvo - inicioHoje) / MS_POR_DIA);
}

export function plural(qtd, singular, pluralForma = `${singular}s`) {
  return `${qtd} ${qtd === 1 ? singular : pluralForma}`;
}
