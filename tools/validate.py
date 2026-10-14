"""Valida um ou mais arquivos de questões contra a SPEC.md."""
import json
import re
import sys

MATERIAS = {
    "portugues", "literatura", "ingles", "arte", "edfisica", "matematica", "fisica",
    "quimica", "biologia", "historia", "geografia", "filosofia", "sociologia",
}
NIVEIS = {"fuvest", "acima"}
OBRIGATORIOS = ["id", "materia", "tema", "nivel", "origem", "enunciado",
                "alternativas", "correta", "explicacao", "erradas"]
FOLGA_TAMANHO = 1.12      # a correta pode ser até 12% maior que a maior errada...
FOLGA_CARACTERES = 8      # ...ou até 8 caracteres maior
LETRA = re.compile(r"\b(alternativa|letra|opção|opcao)\s+\(?[A-E]\)?\b", re.IGNORECASE)
LATEX = re.compile(r"\\(frac|sqrt|cdot|times|pi|theta|alpha|Delta|left|right)\b|\$")


def problemas_da_questao(q):
    erros = []
    for campo in OBRIGATORIOS:
        if campo not in q:
            erros.append(f"falta '{campo}'")
    if erros:
        return erros
    if q["materia"] not in MATERIAS:
        erros.append(f"materia inválida: {q['materia']}")
    if q["nivel"] not in NIVEIS:
        erros.append(f"nivel inválido: {q['nivel']}")
    alts, erradas = q["alternativas"], q["erradas"]
    if not isinstance(alts, list) or len(alts) != 5 or not all(isinstance(a, str) and a.strip() for a in alts):
        erros.append("precisa de 5 alternativas não vazias")
    elif len(set(a.strip() for a in alts)) != 5:
        erros.append("alternativas repetidas")
    if not isinstance(q["correta"], int) or not 0 <= q["correta"] <= 4:
        erros.append("correta deve ser inteiro 0–4")
    if not isinstance(erradas, list) or len(erradas) != 5:
        erros.append("erradas deve ter 5 itens")
    elif isinstance(q["correta"], int) and 0 <= q["correta"] <= 4:
        for i, txt in enumerate(erradas):
            if i == q["correta"] and txt.strip():
                erros.append("erradas[correta] deve ser string vazia")
            if i != q["correta"] and len(txt.strip()) < 15:
                erros.append(f"erradas[{i}] curta demais")
    for inter in q.get("inter", []):
        if inter not in MATERIAS or inter == q["materia"]:
            erros.append(f"inter inválido: {inter}")
    textos = [q["enunciado"], q["explicacao"], q.get("texto", "")] + list(alts) + list(erradas)
    junto = "\n".join(t for t in textos if isinstance(t, str))
    if LETRA.search(junto):
        erros.append(f"cita letra de alternativa: '{LETRA.search(junto).group(0)}'")
    if LATEX.search(junto):
        erros.append(f"parece LaTeX: '{LATEX.search(junto).group(0)}'")
    if isinstance(alts, list) and len(alts) == 5 and isinstance(q["correta"], int) and 0 <= q["correta"] <= 4:
        tamanho_correta = len(alts[q["correta"]])
        maior_errada = max(len(a) for i, a in enumerate(alts) if i != q["correta"])
        if tamanho_correta > maior_errada * FOLGA_TAMANHO and tamanho_correta - maior_errada > FOLGA_CARACTERES:
            erros.append("a correta é bem mais longa que as erradas (denuncia a resposta)")
    if len(q["explicacao"]) < 250:
        erros.append("explicação curta demais (<250 caracteres)")
    tabela = q.get("tabela")
    if tabela is not None:
        cab = tabela.get("cabecalho", [])
        for linha in tabela.get("linhas", []):
            if len(linha) != len(cab):
                erros.append("linha da tabela com nº de colunas diferente do cabeçalho")
                break
    return erros


def main(caminhos):
    ids, total, falhas = set(), 0, 0
    for caminho in caminhos:
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
        for q in dados:
            total += 1
            erros = problemas_da_questao(q)
            if q.get("id") in ids:
                erros.append("id duplicado")
            ids.add(q.get("id"))
            if erros:
                falhas += 1
                print(f"{caminho} :: {q.get('id')}: " + "; ".join(erros))
    print(f"{total} questões, {falhas} com problemas")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
