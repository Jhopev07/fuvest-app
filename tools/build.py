"""Gera data/questoes.json a partir de questoes/*.json e atualiza VERSAO no sw.js.

- Valida cada questão com tools/validate.py (problemas_da_questao) e ids duplicados; aborta se houver erro.
- Confere se todos os arquivos do app estão na lista de pré-cache do sw.js.
- Idempotente: rodar duas vezes sem mudanças não altera nenhum arquivo.

Uso: python3 tools/build.py
"""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True  # não deixa __pycache__ no repositório
sys.path.insert(0, str(RAIZ / "tools"))

from validate import problemas_da_questao  # noqa: E402

PASTA_QUESTOES = RAIZ / "questoes"
SAIDA = RAIZ / "data" / "questoes.json"
SERVICE_WORKER = RAIZ / "sw.js"
TAMANHO_HASH = 10
PADRAO_VERSAO = re.compile(r'const VERSAO = "[^"]*";')
PADRAO_LISTA_SW = re.compile(r'"\./([^"]*)"')
ARQUIVOS_DO_APP = ["index.html", "manifest.webmanifest", "css/*.css", "js/**/*.js", "icons/*.png"]


def hash_curto(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()[:TAMANHO_HASH]


def carregar_questoes():
    questoes, erros = [], []
    for caminho in sorted(PASTA_QUESTOES.glob("*.json")):
        try:
            dados = json.loads(caminho.read_text(encoding="utf-8"))
        except json.JSONDecodeError as erro:
            erros.append(f"{caminho.name}: JSON inválido ({erro})")
            continue
        if not isinstance(dados, list):
            erros.append(f"{caminho.name}: o arquivo deve ser um array de questões")
            continue
        questoes.extend((caminho.name, q) for q in dados)
    return questoes, erros


def validar(questoes):
    erros, ids = [], set()
    for arquivo, q in questoes:
        problemas = problemas_da_questao(q) if isinstance(q, dict) else ["não é um objeto"]
        qid = q.get("id") if isinstance(q, dict) else None
        if qid in ids:
            problemas.append("id duplicado")
        ids.add(qid)
        if problemas:
            erros.append(f"{arquivo} :: {qid}: " + "; ".join(problemas))
    return erros


def gerado_em_anterior(versao):
    """Mantém a data de geração se o conteúdo não mudou (idempotência)."""
    try:
        anterior = json.loads(SAIDA.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    return anterior.get("geradoEm") if anterior.get("versao") == versao else None


def gravar_se_mudou(caminho: Path, conteudo: str) -> bool:
    if caminho.exists() and caminho.read_text(encoding="utf-8") == conteudo:
        return False
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(conteudo, encoding="utf-8")
    return True


def gerar_banco(questoes):
    lista = [q for _, q in questoes]
    conteudo = json.dumps(lista, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    versao = hash_curto(conteudo.encode("utf-8"))
    gerado_em = gerado_em_anterior(versao) or datetime.now(timezone.utc).isoformat(timespec="seconds")
    banco = {"versao": versao, "geradoEm": gerado_em, "questoes": lista}
    texto = json.dumps(banco, ensure_ascii=False, separators=(",", ":"))
    return versao, gravar_se_mudou(SAIDA, texto)


def arquivos_do_app():
    encontrados = set()
    for padrao in ARQUIVOS_DO_APP:
        encontrados.update(p.relative_to(RAIZ).as_posix() for p in RAIZ.glob(padrao) if p.is_file())
    return sorted(encontrados)


def conferir_lista_do_sw(texto_sw):
    listados = set(PADRAO_LISTA_SW.findall(texto_sw))
    faltando = [a for a in arquivos_do_app() if a not in listados]
    inexistentes = [a for a in listados if a and not (RAIZ / a).is_file()]
    erros = [f"sw.js: falta pré-cachear ./{a}" for a in faltando]
    erros += [f"sw.js: lista ./{a}, que não existe" for a in inexistentes]
    return erros


def versao_do_app(versao_banco, texto_sw):
    """Muda quando o banco OU qualquer arquivo do app muda (o SW novo traz o código novo)."""
    resumo = hashlib.sha256(versao_banco.encode())
    for caminho in arquivos_do_app():
        resumo.update(caminho.encode())
        resumo.update((RAIZ / caminho).read_bytes())
    resumo.update(PADRAO_VERSAO.sub('const VERSAO = "";', texto_sw).encode())
    return resumo.hexdigest()[:TAMANHO_HASH]


def atualizar_sw(versao_banco):
    texto = SERVICE_WORKER.read_text(encoding="utf-8")
    if not PADRAO_VERSAO.search(texto):
        raise SystemExit('sw.js: não encontrei a linha const VERSAO = "...";')
    erros = conferir_lista_do_sw(texto)
    if erros:
        raise SystemExit("\n".join(erros))
    versao = versao_do_app(versao_banco, texto)
    novo = PADRAO_VERSAO.sub(f'const VERSAO = "{versao}";', texto, count=1)
    return versao, gravar_se_mudou(SERVICE_WORKER, novo)


def main():
    questoes, erros = carregar_questoes()
    erros += validar(questoes)
    if erros:
        print("\n".join(erros), file=sys.stderr)
        print(f"Build abortado: {len(erros)} problema(s).", file=sys.stderr)
        return 1
    versao_banco, mudou_banco = gerar_banco(questoes)
    versao_sw, mudou_sw = atualizar_sw(versao_banco)
    print(f"{len(questoes)} questões | banco {versao_banco} ({'atualizado' if mudou_banco else 'sem mudanças'}) "
          f"| sw {versao_sw} ({'atualizado' if mudou_sw else 'sem mudanças'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
