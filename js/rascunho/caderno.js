// Desenhos guardados por questão (qid → lista de traços) enquanto uma sessão está aberta.
// `aoGuardar()` é chamado a cada mudança, para quem quiser persistir (simulado).

export class Caderno {
  constructor(inicial = {}, aoGuardar = null) {
    const entradas = Object.entries(inicial ?? {}).filter(([, tracos]) => Array.isArray(tracos));
    this.porQuestao = new Map(entradas);
    this.aoGuardar = aoGuardar;
  }

  tracos(qid) {
    return this.porQuestao.get(qid) ?? [];
  }

  guardar(qid, tracos) {
    if (tracos.length) this.porQuestao.set(qid, tracos);
    else this.porQuestao.delete(qid);
    this.aoGuardar?.();
  }

  paraObjeto() {
    return Object.fromEntries(this.porQuestao);
  }
}
