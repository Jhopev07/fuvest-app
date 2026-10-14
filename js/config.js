// Constantes do app. Nada aqui depende do DOM.

export const VERSAO_APP = "1.0.0";

export const CAMINHO_BANCO = "./data/questoes.json";

export const DATA_PROVA = new Date(2026, 10, 1); // 01/11/2026 (mês 10 = novembro)

export const LETRAS = ["A", "B", "C", "D", "E"];

export const AREAS = {
  linguagens: { nome: "Linguagens" },
  matematica: { nome: "Matemática" },
  natureza: { nome: "Natureza" },
  humanas: { nome: "Humanas" },
};

// Ordem das áreas no simulado, como no caderno da prova.
export const ORDEM_AREAS = ["linguagens", "matematica", "natureza", "humanas"];

export const MATERIAS = {
  portugues: { nome: "Português", area: "linguagens" },
  literatura: { nome: "Literatura", area: "linguagens" },
  ingles: { nome: "Inglês", area: "linguagens" },
  arte: { nome: "Arte", area: "linguagens" },
  edfisica: { nome: "Educação Física", area: "linguagens" },
  matematica: { nome: "Matemática", area: "matematica" },
  fisica: { nome: "Física", area: "natureza" },
  quimica: { nome: "Química", area: "natureza" },
  biologia: { nome: "Biologia", area: "natureza" },
  historia: { nome: "História", area: "humanas" },
  geografia: { nome: "Geografia", area: "humanas" },
  filosofia: { nome: "Filosofia", area: "humanas" },
  sociologia: { nome: "Sociologia", area: "humanas" },
};

export const NIVEIS = {
  fuvest: "Nível Fuvest",
  acima: "Acima da Fuvest",
};

export const SIMULADO = {
  distribuicao: {
    portugues: 7, literatura: 5, ingles: 7, arte: 2, edfisica: 1,
    matematica: 10,
    fisica: 8, quimica: 9, biologia: 9,
    historia: 9, geografia: 9, filosofia: 2, sociologia: 2,
  },
  duracaoMs: 300 * 60 * 1000,
  metaMinPorQuestao: 3.75,
  corteEliminatorio: 24,
};

export const FEEDBACK = {
  limiarForte: 0.7,
  limiarFraco: 0.5,
  numRecomendacoes: 3,
  numQuestoesLentas: 3,
};

export const MODOS = {
  aleatorias: "aleatorias",
  erros: "erros",
  simulado: "simulado",
};

export const INTERVALO_SALVAR_SIMULADO_MS = 10_000;

export const TOTAL_SIMULADO = Object.values(SIMULADO.distribuicao).reduce((a, b) => a + b, 0);

export function nomeMateria(chave) {
  return MATERIAS[chave]?.nome ?? chave;
}

export function areaDaMateria(chave) {
  return MATERIAS[chave]?.area ?? "linguagens";
}
