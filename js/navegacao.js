// Roteador por hash (#/rota/parametro?chave=valor). Cada tela é um módulo com
// `mostrar(raiz, contexto)`. O contexto traz os parâmetros da rota, um AbortSignal
// abortado quando a tela sai (remove listeners e timers) e `aoSair(funcao)` para
// registrar trabalho assíncrono a concluir antes da próxima tela (ex.: salvar o simulado).

const ROTA_INICIAL = "";

const rotas = new Map();
const aoTrocarDeTela = [];
const antesDeNavegar = [];
let raiz = null;
let controleAtual = null;
let saidasAtuais = [];
let indiceAtual = 0;
let primeiraTela = true;
let geracao = 0;

export function registrarTela(nome, tela) {
  rotas.set(nome, tela);
}

/** Funções chamadas antes de cada troca de tela, por qualquer motivo (ex.: link, "voltar"). */
export function antesDeTrocarDeTela(funcao) {
  aoTrocarDeTela.push(funcao);
}

/** Funções assíncronas esperadas antes de o app navegar sozinho (ex.: fechar camadas abertas). */
export function antesDeNavegarPeloApp(funcao) {
  antesDeNavegar.push(funcao);
}

async function prepararNavegacao() {
  for (const funcao of antesDeNavegar) await funcao();
}

export function rotaPara(nome, parametro = "", consulta = {}) {
  const busca = new URLSearchParams(consulta).toString();
  return `#/${nome}${parametro ? `/${encodeURIComponent(parametro)}` : ""}${busca ? `?${busca}` : ""}`;
}

export async function irPara(hash) {
  await prepararNavegacao();
  if (location.hash === hash) renderizarRotaAtual();
  else location.hash = hash;
}

/** Troca a tela sem criar entrada no histórico (o "voltar" do Android pula a tela atual). */
export async function substituirPor(hash) {
  await prepararNavegacao();
  history.replaceState({ indice: indiceAtual }, "", hash);
  renderizarRotaAtual();
}

/** Volta uma tela se a anterior for do app; senão, vai para `destino`. */
export async function voltar(destino = "#/") {
  await prepararNavegacao();
  if (indiceAtual > 0) history.back();
  else substituirPor(destino);
}

/** Numera as entradas do histórico para saber se há uma tela do app antes desta. */
function numerarEntrada() {
  const indice = history.state?.indice;
  if (Number.isInteger(indice)) {
    indiceAtual = indice;
    return;
  }
  indiceAtual = primeiraTela ? 0 : indiceAtual + 1;
  history.replaceState({ ...history.state, indice: indiceAtual }, "");
}

function lerRota() {
  const [caminho, busca = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nome = ROTA_INICIAL, parametro = ""] = caminho.split("/");
  return {
    nome: rotas.has(nome) ? nome : ROTA_INICIAL,
    parametro: decodeURIComponent(parametro),
    consulta: Object.fromEntries(new URLSearchParams(busca)),
  };
}

async function sairDaTelaAtual() {
  aoTrocarDeTela.forEach((funcao) => funcao());
  controleAtual?.abort();
  const saidas = saidasAtuais;
  saidasAtuais = [];
  for (const saida of saidas) {
    try {
      await saida();
    } catch (erro) {
      console.error(erro);
    }
  }
}

/**
 * Cada tela desenha num contêiner próprio: se o usuário trocar de tela antes de
 * uma carga assíncrona terminar, a tela antiga escreve num nó já descartado.
 */
async function renderizarRotaAtual() {
  const minhaGeracao = ++geracao;
  await sairDaTelaAtual();
  if (minhaGeracao !== geracao) return;
  numerarEntrada();
  primeiraTela = false;
  const rota = lerRota();
  controleAtual = new AbortController();
  const sinal = controleAtual.signal;
  const saidas = [];
  saidasAtuais = saidas;
  const aoSair = (funcao) => (sinal.aborted ? funcao() : saidas.push(funcao));
  const conteiner = document.createElement("div");
  conteiner.className = "tela";
  raiz.replaceChildren(conteiner);
  raiz.dataset.tela = rota.nome || "inicio";
  window.scrollTo(0, 0);
  try {
    await rotas.get(rota.nome).mostrar(conteiner, { ...rota, sinal, aoSair });
  } catch (erro) {
    console.error(erro);
    if (!sinal.aborted) mostrarErro(conteiner, erro);
  }
  if (!sinal.aborted) conteiner.querySelector("h1")?.focus({ preventScroll: true });
}

function mostrarErro(conteiner, erro) {
  const caixa = document.createElement("div");
  caixa.className = "pagina erro-tela";
  const titulo = document.createElement("h1");
  titulo.tabIndex = -1;
  titulo.textContent = "Esta tela não abriu";
  const detalhe = document.createElement("p");
  detalhe.textContent = String(erro?.message ?? erro);
  const link = document.createElement("a");
  link.href = "#/";
  link.className = "botao botao-primario";
  link.textContent = "Voltar ao início";
  caixa.append(titulo, detalhe, link);
  conteiner.replaceChildren(caixa);
}

/** Links internos passam por `prepararNavegacao` (ex.: fechar a folha antes de sair). */
function interceptarLinks(evento) {
  if (evento.defaultPrevented) return;
  const link = evento.target.closest('a[href^="#"]');
  if (!link) return;
  evento.preventDefault();
  if (link.hasAttribute("data-voltar")) voltar(link.getAttribute("href"));
  else irPara(link.getAttribute("href"));
}

export function iniciarRoteador(elementoRaiz) {
  raiz = elementoRaiz;
  window.addEventListener("hashchange", renderizarRotaAtual);
  document.addEventListener("click", interceptarLinks);
  return renderizarRotaAtual();
}
