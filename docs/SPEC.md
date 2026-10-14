# Especificação do banco de questões — App Fuvest 1ª fase (vestibular 2027)

O aluno (18 anos, quer Engenharia Mecatrônica na USP) vai fazer a 1ª fase da Fuvest em 01/11/2026.
A prova tem 80 questões de múltipla escolha, 5 alternativas, 5 horas, 1 ponto cada.
Ele pediu questões INÉDITAS, **um nível acima da Fuvest**, com explicações excelentes. Ele vai resolver no celular, no metrô.

## 1. Nível: "um degrau acima da Fuvest"

Mesmo conteúdo do programa oficial da Fuvest, mas:
- mais passos de raciocínio encadeados (2–4 etapas em exatas);
- combinação de dois tópicos (ex.: função + geometria; energia + momento; estequiometria + equilíbrio);
- mais informação para ler/filtrar (tabelas, textos de apoio, dados irrelevantes);
- distratores mais sutis: cada alternativa errada deve ser o resultado de um ERRO PLAUSÍVEL específico
  (erro de unidade, etapa intermediária, sinal, raio×diâmetro, linear×quadrático, causa/efeito invertidos,
  anacronismo, afirmação verdadeira que não responde à pergunta, extrapolação do texto, falso cognato...).

Proporção dentro de cada arquivo: ~30% `"nivel": "fuvest"` e ~70% `"nivel": "acima"`.

Referências de estilo (use como MOLDE de raciocínio, nunca copie enunciado):
- Matemática: Fuvest, Iezzi (Fundamentos de Matemática Elementar — seção de testes), ITA/IME fáceis e médias.
- Física: Fuvest, Tópicos de Física (níveis 2–3), ITA fácil, Vunesp difícil.
- Química: Fuvest, Feltre, ITA fácil.
- Biologia: Fuvest, Amabis & Martho, Unicamp (Comvest).
- Humanas e Linguagens: Fuvest, Unicamp (Comvest), Vunesp difícil.

PROIBIDO sair do programa da Fuvest. Fora do programa: números complexos, matrizes e determinantes,
relações de Girard e polinômios avançados, cálculo diferencial/integral.

Programa (resumo):
- Matemática: divisibilidade, bases, notação científica, PA/PG, porcentagem e juros, plano cartesiano (retas, circunferências, interseções), sistemas lineares até 3×3, funções (afim, quadrática, racionais simples, modular, exponencial, logarítmica, trigonométricas; composição, inversa), polinômios (fatoração, divisão), geometria plana e espacial (prismas, pirâmides, troncos, cilindro, cone, esfera, inscrição/circunscrição), isometrias e homotetias, lei dos senos e cossenos, combinatória, probabilidade (inclusive condicional), estatística (média, mediana, quartis, desvio-padrão, coeficiente de variação, box-plot).
- Física: Newton, trabalho/energia, impulso/colisões, gravitação/Kepler, termometria, calorimetria, dilatação, termodinâmica e ciclos, eletrostática, eletrodinâmica, magnetismo e indução, óptica geométrica, MHS e ondas (som, dB), física moderna (quantização, fotoelétrico, radioatividade, semicondutores), cosmologia básica, matriz energética.
- Química: leis ponderais, mol, estequiometria (rendimento, pureza, excesso), gases, soluções, coligativas, termoquímica, energia de ligação, cinética, equilíbrio, pH, eletroquímica, tabela periódica, ligações e forças intermoleculares, polaridade, isomeria, orgânica, polímeros, química ambiental e industrial.
- Biologia: citologia, metabolismo energético, mitose/meiose, DNA e biotecnologia, genética (inclusive ligada ao sexo e mitocondrial), evolução e filogenia, botânica, zoologia, ecologia e mudanças climáticas, fisiologia humana, endócrino e nervoso, doenças (vírus, bactérias, parasitas: Schistosoma, Ascaris, Ancylostoma, Taenia, Giardia, Trichomonas, T. cruzi, Plasmodium), vacinas, saneamento.
- Humanas: História Geral e do Brasil (foco em fontes, processos e longa duração), Geografia (cartografia, população, urbano/rural, agrária, clima, relevo, meio ambiente, energia, globalização, geopolítica), Filosofia (antiga a contemporânea, ética, política, epistemologia, estética, lógica e falácias), Sociologia (Durkheim, Weber, Marx, cultura, trabalho, Estado, identidade, mídia).
- Linguagens: interpretação, gêneros, coesão, operadores, intertextualidade, modalização, sintaxe (coordenação, subordinação, concordância, regência), variação linguística, figuras, escolas literárias; Inglês (interpretação, vocabulário em contexto, falsos cognatos, phrasal verbs, modais, referentes, ironia); Arte (linguagens artísticas, patrimônio, movimentos); Educação Física (práticas corporais como cultura, saúde, esporte e sociedade).

Leituras obrigatórias 2027: *Opúsculo Humanitário* (Nísia Floresta, 1853); *Nebulosas* (Narcisa Amália, 1872);
*Memórias de Martha* (Julia Lopes de Almeida, 1899); *Caminho de Pedras* (Rachel de Queiroz, 1937);
*A Paixão Segundo G.H.* (Clarice Lispector, 1964); *Geografia* (Sophia de Mello Breyner Andresen, 1967);
*Balada de Amor ao Vento* (Paulina Chiziane, 1990); *Canção para Ninar Menino Grande* (Conceição Evaristo, 2018);
*A Visão das Plantas* (Djaimilia Pereira de Almeida, 2019).

## 2. Regras de conteúdo (obrigatórias)

1. **Exatamente UMA alternativa correta.** Nada de "todas as anteriores", "nenhuma das anteriores", "I e II" sem que o item romano seja verificável. Itens romanos (I, II, III) são permitidos.
2. **Exatas: verifique cada conta rodando Python** (Bash: `python3 -c ...`) antes de gravar. Números devem ser "limpos" no final (o aluno resolve sem calculadora). Dê os valores de constantes no enunciado quando necessário (g = 10 m/s², etc.). Unidades sempre explícitas.
3. **Só fatos de que você tem certeza.** Em História, Geografia, Biologia, Literatura: se não tem certeza de uma data, nome, número ou enredo, não use. Prefira raciocínio sobre processos a decorebas.
4. **Direitos autorais:** não copie questões de provas nem de livros. Não reproduza trechos de obras com direitos (Clarice, Conceição Evaristo, Sophia, Chiziane, Djaimilia, Rachel de Queiroz, letras de música, artigos). Nas obras obrigatórias, trabalhe com enredo, temas, personagens, estilo e contexto descritos com suas palavras. Não invente citações atribuídas a pessoas reais. Textos de apoio devem ser escritos por você e identificados como `"Texto elaborado para esta questão."` (ou "adaptado de ideias de X" quando paráfrase de um pensador clássico, sem aspas). Textos em inglês: escreva você mesmo um texto original no estilo de divulgação científica/jornalismo.
5. **Sem figuras externas.** Se a questão precisar de tabela, use o campo `tabela`. Se precisar de gráfico simples, prefira descrever os dados em tabela. Só use `svg` se for realmente essencial e simples (veja formato).
6. **Notação matemática em Unicode**, não LaTeX: x², x³, √2, ∛, π, θ, Δ, ≤, ≥, ≠, ≈, ·, ×, →, ∞, ∈, ∪, ∩, ½, log₂ 8, sen, cos, tg, aₙ, Sₙ, H⁺, SO₄²⁻, CO₂. Frações como (a + b)/c ou a/b.
7. **As alternativas e explicações NÃO podem citar letras** ("alternativa C", "a letra B"), porque o app embaralha a ordem. Para se referir a uma alternativa, cite o conteúdo ("o valor 12 m/s").
8. Alternativas com tamanho e estilo parecidos; em alternativas numéricas, use ordem crescente lógica (o app pode embaralhar mesmo assim).
9. Português do Brasil, gramática impecável.

## 3. Explicação (o mais importante — capriche)

Campo `explicacao`: resolução completa e didática, como um ótimo professor de cursinho, em parágrafos curtos.
- Comece pela ideia-chave ("O ponto aqui é perceber que...").
- Mostre o caminho mais curto passo a passo, com as contas.
- Quando houver um atalho ou macete, mostre.
- Termine com "Para lembrar:" + 1 frase com o conceito que a questão testa.

Campo `erradas`: lista com 5 strings, uma por alternativa, na mesma ordem das alternativas. Para a correta, string vazia "". Para cada errada, explique QUAL erro leva àquela alternativa (a armadilha) — ex.: "Valor obtido ao usar o diâmetro no lugar do raio." Isso é essencial.

Questões estilo LIVRO (`"origem"` começando com "Estilo livro"): explicação ainda mais aprofundada, incluindo a teoria por trás (o porquê da fórmula/conceito), como num bom livro didático.

Use `\n\n` para separar parágrafos dentro das strings. Pode usar **negrito** com asteriscos duplos (o app renderiza). Nada de outro markdown.

## 4. Formato JSON

Cada arquivo é um ARRAY JSON válido de objetos:

```json
{
  "id": "MAT-A-001",
  "materia": "matematica",
  "tema": "Funções — exponencial e logaritmo",
  "nivel": "acima",
  "origem": "Estilo ITA/IME (fácil)",
  "inter": ["fisica"],
  "texto": "Texto de apoio opcional (pode ser omitido).",
  "tabela": {"titulo": "opcional", "cabecalho": ["Ano", "Valor"], "linhas": [["2020", "10"], ["2021", "12"]]},
  "enunciado": "Pergunta.",
  "alternativas": ["...", "...", "...", "...", "..."],
  "correta": 2,
  "explicacao": "Resolução completa.",
  "erradas": ["Armadilha da 1ª", "Armadilha da 2ª", "", "Armadilha da 4ª", "Armadilha da 5ª"]
}
```

- `materia` ∈ {"portugues","literatura","ingles","arte","edfisica","matematica","fisica","quimica","biologia","historia","geografia","filosofia","sociologia"}.
- `inter`: lista (pode ser vazia []) de outras matérias que a questão integra de verdade (interdisciplinar). Cada arquivo deve ter pelo menos ~15% de questões interdisciplinares genuínas.
- `origem`: um de "Estilo Fuvest", "Estilo Comvest (Unicamp)", "Estilo Vunesp (difícil)", "Estilo ITA/IME (fácil)", "Estilo ITA/IME (médio)", "Estilo livro (Iezzi)", "Estilo livro (Tópicos de Física)", "Estilo livro (Feltre)", "Estilo livro (Amabis & Martho)", "Estilo livro" — escolha o que corresponde ao molde usado. ITA/IME só em matemática/física (química opcional, só fácil). Inclua algumas de cada estilo pertinente; ~20% estilo livro.
- `correta`: índice 0–4. Varie a posição da correta.
- `texto`, `tabela`, `svg` são opcionais (omita se não usar).
- `svg` (raro): string de um SVG completo e simples, `viewBox` definido, sem width/height fixos, traços com `stroke="currentColor"`, texto com `fill="currentColor"`, font-size ≥ 12. Só se indispensável.

Grave o arquivo com a ferramenta Write e depois valide rodando:
`python3 /home/claude/fuvest-app/tools/validate.py <arquivo>`
Corrija até passar sem erros.
