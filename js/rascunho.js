// Escrita à mão numa tela de questão. O botão ✏️ abre a FOLHA DE ESCRITA (folha em
// branco abaixo da questão, ou em tela cheia); dentro dela, "escrever sobre a questão"
// abre a camada transparente antiga. Guarda os dois desenhos por questão:
// em memória durante a sessão e, se `aoGuardar` for dado, onde quem chamou quiser.

import { abrirCamada } from "./camadas.js";
import { PilhaDeDesfazer } from "./pilha-desfazer.js";
import { Caderno } from "./rascunho/caderno.js";
import { FolhaDeEscrita } from "./rascunho/folha-escrita.js";
import { abrirSobreQuestao } from "./rascunho/sobre-questao.js";
import { VistaDaFolha } from "./rascunho/vista-folha.js";
import { html } from "./render.js";
import { alternativasParaConsulta, corpoQuestao } from "./vista-questao.js";
import { ampliarAoTocar } from "./visualizador.js";

export class EscritaDaTela {
  /**
   * `tela`: contêiner da tela (a folha entra logo depois dele).
   * `folhas`, `sobre`: desenhos já guardados ({ qid: traços }).
   * `aoGuardar({ folhas, sobre })`: chamado a cada mudança de desenho.
   */
  constructor(tela, { folhas = {}, sobre = {}, aoGuardar = null } = {}) {
    this.tela = tela;
    const guardar = () => aoGuardar?.(this.paraObjeto());
    this.folhas = new Caderno(folhas, guardar);
    this.sobre = new Caderno(sobre, guardar);
    this.memoria = new Map(); // qid → { pilha, vista }: desfazer e enquadramento, só nesta sessão
    this.questao = null;
    this.folha = null;
    this.fecharFolhaAberta = null;
  }

  paraObjeto() {
    return { folhas: this.folhas.paraObjeto(), sobre: this.sobre.paraObjeto() };
  }

  get folhaAberta() {
    return this.folha !== null;
  }

  /** A tela passou a mostrar `q` (com as alternativas na `ordem` exibida). */
  mostrarQuestao(q, ordem, titulo) {
    const trocou = this.questao?.q.id !== q.id;
    this.questao = { q, ordem, titulo };
    if (this.folha && trocou) this.carregarFolha();
  }

  abrirFolha() {
    if (this.folha || !this.questao) return;
    const rolagem = window.scrollY;
    this.folha = new FolhaDeEscrita({
      depoisDe: this.tela,
      painelDaQuestao: () => this.tela,
      aoMudar: (tracos) => this.folhas.guardar(this.questao.q.id, tracos),
      aoFechar: () => this.fecharFolha(),
      aoEscreverSobre: () => this.trocarParaEscritaSobre(),
    });
    this.controleFolha = new AbortController();
    ampliarAoTocar(this.folha.elemento, this.controleFolha.signal);
    this.fecharFolhaAberta = abrirCamada((motivo) => this.destruirFolha(motivo));
    this.tela.scrollTop = rolagem; // a questão continua no mesmo trecho, agora no painel de cima
    this.carregarFolha();
  }

  fecharFolha() {
    return this.fecharFolhaAberta?.() ?? Promise.resolve();
  }

  async trocarParaEscritaSobre() {
    await this.fecharFolha();
    this.abrirEscritaSobre();
  }

  abrirEscritaSobre() {
    if (!this.questao) return;
    const qid = this.questao.q.id;
    abrirSobreQuestao({ tracos: this.sobre.tracos(qid), aoMudar: (tracos) => this.sobre.guardar(qid, tracos) });
  }

  // ---------- interno ----------

  memoriaDe(qid) {
    if (!this.memoria.has(qid)) this.memoria.set(qid, { pilha: new PilhaDeDesfazer(), vista: new VistaDaFolha() });
    return this.memoria.get(qid);
  }

  carregarFolha() {
    const { q, ordem, titulo } = this.questao;
    const { pilha, vista } = this.memoriaDe(q.id);
    this.folha.carregar({ tracos: this.folhas.tracos(q.id), pilha, vista });
    this.folha.definirConsulta(titulo, html`${corpoQuestao(q)}${alternativasParaConsulta(q, ordem)}`);
  }

  destruirFolha(motivo) {
    const rolagem = this.tela.scrollTop;
    this.controleFolha?.abort();
    this.folha?.destruir();
    this.folha = null;
    this.fecharFolhaAberta = null;
    if (motivo !== "saida") window.scrollTo(0, rolagem);
  }
}
