// Persistência em IndexedDB, sem biblioteca. Se o IndexedDB não abrir (modo privado,
// armazenamento bloqueado), cai para um armazém em memória com a mesma interface:
// o app continua funcionando, só não guarda o progresso entre aberturas.

const NOME_BANCO = "fuvest-app";
const VERSAO_BANCO = 1;
const CHAVE_ANDAMENTO = "atual";
const FORMATO_BACKUP = "fuvest-app-backup";
const VERSAO_BACKUP = 1;

const LOJAS = {
  tentativas: { keyPath: "id", indices: ["qid", "quando"] },
  sessoes: { keyPath: "id", indices: ["entregueEm"] },
  andamento: { keyPath: "id", indices: [] },
  ajustes: { keyPath: "chave", indices: [] },
};

function promessa(requisicao) {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });
}

function criarLojas(banco) {
  for (const [nome, { keyPath, indices }] of Object.entries(LOJAS)) {
    if (banco.objectStoreNames.contains(nome)) continue;
    const loja = banco.createObjectStore(nome, { keyPath });
    indices.forEach((indice) => loja.createIndex(indice, indice));
  }
}

function abrirIndexedDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
    pedido.onupgradeneeded = () => criarLojas(pedido.result);
    pedido.onsuccess = () => {
      const banco = pedido.result;
      banco.onversionchange = () => banco.close();
      resolve(banco);
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error("IndexedDB bloqueado por outra aba"));
  });
}

class ArmazemIndexedDb {
  constructor(banco) {
    this.banco = banco;
    this.persistente = true;
  }

  async transacao(loja, modo, operacao) {
    const tx = this.banco.transaction(loja, modo);
    const concluida = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
    });
    // Promise.all observa as duas promessas: nenhuma rejeição fica sem tratamento.
    const [resultado] = await Promise.all([operacao(tx.objectStore(loja)), concluida]);
    return resultado;
  }

  obter(loja, chave) {
    return this.transacao(loja, "readonly", (s) => promessa(s.get(chave)));
  }

  todos(loja) {
    return this.transacao(loja, "readonly", (s) => promessa(s.getAll()));
  }

  gravar(loja, registro) {
    return this.transacao(loja, "readwrite", (s) => promessa(s.put(registro)));
  }

  gravarVarios(loja, registros) {
    return this.transacao(loja, "readwrite", (s) => {
      registros.forEach((r) => s.put(r));
    });
  }

  apagar(loja, chave) {
    return this.transacao(loja, "readwrite", (s) => promessa(s.delete(chave)));
  }

  limpar(loja) {
    return this.transacao(loja, "readwrite", (s) => promessa(s.clear()));
  }
}

class ArmazemMemoria {
  constructor() {
    this.persistente = false;
    this.lojas = new Map(Object.keys(LOJAS).map((nome) => [nome, new Map()]));
  }

  chaveDe(loja, registro) {
    return registro[LOJAS[loja].keyPath];
  }

  async obter(loja, chave) {
    return structuredClone(this.lojas.get(loja).get(chave));
  }

  async todos(loja) {
    return [...this.lojas.get(loja).values()].map((r) => structuredClone(r));
  }

  async gravar(loja, registro) {
    this.lojas.get(loja).set(this.chaveDe(loja, registro), structuredClone(registro));
  }

  async gravarVarios(loja, registros) {
    registros.forEach((r) => this.lojas.get(loja).set(this.chaveDe(loja, r), structuredClone(r)));
  }

  async apagar(loja, chave) {
    this.lojas.get(loja).delete(chave);
  }

  async limpar(loja) {
    this.lojas.get(loja).clear();
  }
}

let armazem = new ArmazemMemoria();

/** Abre o banco. Nunca rejeita: em caso de falha, segue em memória. */
export async function iniciarDb() {
  try {
    armazem = new ArmazemIndexedDb(await abrirIndexedDb());
  } catch (erro) {
    console.warn("Sem IndexedDB; progresso só fica em memória.", erro);
    armazem = new ArmazemMemoria();
  }
  return { persistente: armazem.persistente };
}

export function dbEhPersistente() {
  return armazem.persistente;
}

// ---- Tentativas ----

export function registrarTentativa(tentativa) {
  return armazem.gravar("tentativas", tentativa);
}

export function registrarTentativas(tentativas) {
  return armazem.gravarVarios("tentativas", tentativas);
}

export async function listarTentativas() {
  const todas = await armazem.todos("tentativas");
  return todas.sort((a, b) => a.quando.localeCompare(b.quando));
}

export function obterTentativa(id) {
  return armazem.obter("tentativas", id);
}

// ---- Simulados entregues ----

export function salvarSessao(sessao) {
  return armazem.gravar("sessoes", sessao);
}

export function obterSessao(id) {
  return armazem.obter("sessoes", id);
}

export async function listarSessoes() {
  const todas = await armazem.todos("sessoes");
  return todas.sort((a, b) => b.entregueEm.localeCompare(a.entregueEm));
}

// ---- Simulado em andamento ----

export function obterAndamento() {
  return armazem.obter("andamento", CHAVE_ANDAMENTO);
}

export function salvarAndamento(simulado) {
  return armazem.gravar("andamento", { ...simulado, id: CHAVE_ANDAMENTO });
}

export function apagarAndamento() {
  return armazem.apagar("andamento", CHAVE_ANDAMENTO);
}

// ---- Ajustes ----

export async function lerAjuste(chave, padrao) {
  const registro = await armazem.obter("ajustes", chave);
  return registro ? registro.valor : padrao;
}

export function gravarAjuste(chave, valor) {
  return armazem.gravar("ajustes", { chave, valor });
}

// ---- Backup ----

export async function exportarTudo() {
  const [tentativas, sessoes, andamento, ajustes] = await Promise.all(
    ["tentativas", "sessoes", "andamento", "ajustes"].map((loja) => armazem.todos(loja)),
  );
  return {
    formato: FORMATO_BACKUP,
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    tentativas, sessoes, andamento, ajustes,
  };
}

function validarBackup(dados) {
  const valido = dados && dados.formato === FORMATO_BACKUP &&
    Array.isArray(dados.tentativas) && Array.isArray(dados.sessoes);
  if (!valido) throw new Error("Arquivo não é um backup deste app.");
}

async function mesclar(loja, registros, chave) {
  const existentes = new Set((await armazem.todos(loja)).map((r) => r[chave]));
  const novos = registros.filter((r) => r && r[chave] !== undefined && !existentes.has(r[chave]));
  if (novos.length) await armazem.gravarVarios(loja, novos);
  return novos.length;
}

/** Mescla um backup sem duplicar (chave = id). Ajustes locais são mantidos. */
export async function importarTudo(dados) {
  validarBackup(dados);
  const tentativas = await mesclar("tentativas", dados.tentativas, "id");
  const sessoes = await mesclar("sessoes", dados.sessoes, "id");
  const andamentoLocal = await obterAndamento();
  const andamentoImportado = (dados.andamento ?? [])[0];
  const andamento = !andamentoLocal && andamentoImportado ? 1 : 0;
  if (andamento) await salvarAndamento(andamentoImportado);
  return { tentativas, sessoes, andamento };
}

export async function apagarTudo() {
  await Promise.all(["tentativas", "sessoes", "andamento"].map((loja) => armazem.limpar(loja)));
}
