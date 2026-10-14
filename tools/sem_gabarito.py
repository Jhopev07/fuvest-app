"""Imprime as questões de um arquivo SEM gabarito e sem explicação, para resolução às cegas.

Uso: python3 tools/sem_gabarito.py questoes/mat_a.json [ID ...]
"""
import json
import sys

LETRAS = "ABCDE"


def imprimir(q):
    print(f"===== {q['id']} | {q['materia']} | {q['tema']} | nível {q['nivel']} =====")
    if q.get("texto"):
        print(q["texto"], "\n")
    tabela = q.get("tabela")
    if tabela:
        if tabela.get("titulo"):
            print(tabela["titulo"])
        print(" | ".join(tabela["cabecalho"]))
        for linha in tabela["linhas"]:
            print(" | ".join(linha))
        print()
    print(q["enunciado"])
    for letra, alt in zip(LETRAS, q["alternativas"]):
        print(f"  {letra}) {alt}")
    print()


def main():
    caminho, *ids = sys.argv[1:]
    for q in json.load(open(caminho, encoding="utf-8")):
        if not ids or q["id"] in ids:
            imprimir(q)


if __name__ == "__main__":
    main()
