// Inicialização: tema, banco de dados, banco de questões, rotas e PWA.

import { carregarBanco } from "./banco.js";
import { iniciarDb } from "./db.js";
import { antesDeTrocarDeTela, iniciarRoteador, registrarTela } from "./navegacao.js";
import { pedirPersistenciaNoPrimeiroUso, registrarServiceWorker } from "./pwa.js";
import { fecharRascunho } from "./rascunho.js";
import { acompanharSistema, aplicarTema } from "./tema.js";
import * as inicio from "./telas/inicio.js";
import * as filtros from "./telas/filtros.js";
import * as questao from "./telas/questao.js";
import * as simulado from "./telas/simulado.js";
import * as resultado from "./telas/resultado.js";
import * as revisao from "./telas/revisao.js";
import * as historico from "./telas/historico.js";
import * as ajustes from "./telas/ajustes.js";

const TELAS = {
  "": inicio,
  filtros,
  pratica: questao,
  erros: questao,
  simulado,
  resultado,
  revisao,
  historico,
  ajustes,
};

function mostrarFalhaDeCarga(raiz, erro) {
  console.error(erro);
  raiz.innerHTML = "";
  const caixa = document.createElement("div");
  caixa.className = "pagina estado-vazio";
  const titulo = document.createElement("h1");
  titulo.textContent = "Não foi possível carregar as questões";
  const texto = document.createElement("p");
  texto.textContent = "Abra o app uma vez com internet para baixar o banco de questões.";
  const botao = document.createElement("button");
  botao.className = "botao botao-primario";
  botao.textContent = "Tentar de novo";
  botao.addEventListener("click", () => location.reload());
  caixa.append(titulo, texto, botao);
  raiz.append(caixa);
}

async function iniciar() {
  aplicarTema();
  acompanharSistema();
  const raiz = document.getElementById("app");
  const [, carga] = await Promise.allSettled([iniciarDb(), carregarBanco()]);
  if (carga.status === "rejected") {
    mostrarFalhaDeCarga(raiz, carga.reason);
    registrarServiceWorker();
    return;
  }
  Object.entries(TELAS).forEach(([nome, tela]) => registrarTela(nome, tela));
  antesDeTrocarDeTela(() => fecharRascunho({ porHistorico: true }));
  await iniciarRoteador(raiz);
  registrarServiceWorker();
  pedirPersistenciaNoPrimeiroUso().catch((erro) => console.warn(erro));
}

iniciar();
