// Ajustes: backup (exportar/importar), armazenamento, versões, tema e apagar tudo.

import { VERSAO_APP } from "../config.js";
import { infoBanco } from "../banco.js";
import { apagarTudo, dbEhPersistente, exportarTudo, importarTudo } from "../db.js";
import { pedirPersistencia, statusPersistencia } from "../pwa.js";
import { TEMAS, escolherTema, temaEscolhido } from "../tema.js";
import { substituirPor } from "../navegacao.js";
import { html, montar } from "../render.js";
import { aoAgir, avisar, baixarArquivo, barraTopo, confirmar } from "../ui.js";
import { chaveDoDia, formatarDataHora, plural } from "../util.js";

function secaoTema() {
  const atual = temaEscolhido();
  return html`
    <section class="secao">
      <h2>Tema</h2>
      <div class="segmentado" id="escolha-tema">
        ${Object.entries(TEMAS).map(([chave, nome]) => html`
          <label><input type="radio" name="tema" value="${chave}" ${chave === atual ? "checked" : ""}><span>${nome}</span></label>`)}
      </div>
    </section>`;
}

function secaoBackup() {
  return html`
    <section class="secao">
      <h2>Backup do progresso</h2>
      <p class="texto-apoio">Seu progresso fica só neste aparelho. Exporte de vez em quando e guarde o arquivo no Drive.</p>
      <div class="pilha-botoes">
        <button type="button" class="botao botao-primario" data-acao="exportar">Exportar progresso</button>
        <label class="botao botao-secundario" for="arquivo-importar">Importar progresso</label>
        <input type="file" id="arquivo-importar" accept="application/json,.json" class="fora-da-tela">
      </div>
      <p class="texto-apoio">Importar junta o arquivo ao que já está aqui, sem duplicar.</p>
    </section>`;
}

function rotuloPersistencia(status) {
  if (!dbEhPersistente()) return "Armazenamento bloqueado: o progresso some ao fechar o app.";
  if (status === "concedido") return "Persistente: o navegador não apaga seus dados sozinho.";
  if (status === "não concedido") return "Não persistente: o navegador pode apagar os dados se faltar espaço.";
  return "Este navegador não informa o status do armazenamento.";
}

function secaoArmazenamento(status) {
  const banco = infoBanco();
  return html`
    <section class="secao">
      <h2>Armazenamento e versões</h2>
      <dl class="lista-dados">
        <div><dt>Armazenamento</dt><dd>${rotuloPersistencia(status)}</dd></div>
        <div><dt>Banco de questões</dt><dd>${plural(banco.total, "questão", "questões")}, versão ${banco.versao || "–"}${
          banco.geradoEm ? `, gerado em ${formatarDataHora(banco.geradoEm)}` : ""}</dd></div>
        <div><dt>App</dt><dd>versão ${VERSAO_APP}</dd></div>
      </dl>
      ${status === "não concedido" ? html`
        <button type="button" class="botao botao-secundario" data-acao="persistir">Pedir armazenamento persistente</button>` : ""}
    </section>`;
}

function secaoPerigo() {
  return html`
    <section class="secao secao-perigo">
      <h2>Apagar todo o progresso</h2>
      <p class="texto-apoio">Remove tentativas, simulados e o simulado em andamento. Não dá para desfazer.</p>
      <button type="button" class="botao botao-perigo" data-acao="apagar">Apagar todo o progresso</button>
    </section>`;
}

async function exportar() {
  const dados = await exportarTudo();
  baixarArquivo(`fuvest-progresso-${chaveDoDia(new Date())}.json`, JSON.stringify(dados));
  avisar(`Exportado: ${plural(dados.tentativas.length, "tentativa")} e ${plural(dados.sessoes.length, "simulado")}.`);
}

async function importar(arquivo) {
  try {
    const dados = JSON.parse(await arquivo.text());
    const r = await importarTudo(dados);
    avisar(`Importado: ${plural(r.tentativas, "tentativa nova", "tentativas novas")}, ` +
      `${plural(r.sessoes, "simulado novo", "simulados novos")}.`);
  } catch (erro) {
    console.warn(erro);
    avisar(erro instanceof SyntaxError ? "O arquivo não é um JSON válido." : erro.message);
  }
}

async function apagar() {
  const primeira = await confirmar({
    titulo: "Apagar todo o progresso?",
    mensagem: "Tentativas, simulados e o simulado em andamento serão apagados deste aparelho.",
    sim: "Continuar",
    perigo: true,
  });
  if (!primeira) return false;
  const segunda = await confirmar({
    titulo: "Tem certeza?",
    mensagem: "Se não exportou um backup, o progresso será perdido para sempre.",
    sim: "Apagar tudo",
    nao: "Manter progresso",
    perigo: true,
  });
  if (!segunda) return false;
  await apagarTudo();
  avisar("Progresso apagado.");
  return true;
}

export async function mostrar(raiz, { sinal }) {
  const status = await statusPersistencia();
  montar(raiz, html`
    ${barraTopo({ titulo: "Ajustes e backup" })}
    <div class="pagina ajustes">
      ${secaoTema()}
      ${secaoBackup()}
      ${secaoArmazenamento(status)}
      ${secaoPerigo()}
    </div>`);

  raiz.querySelector("#escolha-tema").addEventListener("change", (e) => escolherTema(e.target.value), { signal: sinal });
  raiz.querySelector("#arquivo-importar").addEventListener("change", async (e) => {
    const [arquivo] = e.target.files;
    e.target.value = "";
    if (arquivo) await importar(arquivo);
  }, { signal: sinal });
  aoAgir(raiz, sinal, {
    exportar: () => exportar().catch((erro) => avisar(`Falha ao exportar: ${erro.message}`)),
    persistir: async () => {
      avisar((await pedirPersistencia()) ? "Armazenamento persistente concedido." : "O navegador não concedeu.");
      substituirPor("#/ajustes");
    },
    apagar: async () => {
      if (await apagar()) substituirPor("#/ajustes");
    },
  });
}
