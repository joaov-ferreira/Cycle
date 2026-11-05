# CYCLE — Especificação Funcional e Técnica

> Gerenciador de periodização de powerlifting com IA. Esta spec é a fonte de verdade
> do produto. O plano de implementação está em [`PLAN.md`](./PLAN.md) e as regras de
> desenvolvimento em [`../AGENTS.md`](../AGENTS.md).

- **Status:** v1.0 (rascunho aprovado para implementação)
- **Plataforma:** Expo SDK 58 / React Native 0.88 / Expo Router (iOS, Android e Web)
- **Público:** powerlifters intermediários e avançados
- **Prioridades (em ordem):** precisão matemática → fidelidade aos programas originais →
  flexibilidade de configuração de sessões → acompanhamento de progressão de longo prazo

---

## 0. Glossário

| Termo | Definição |
|---|---|
| **Lift** | Um dos três levantamentos principais: `bench` (Supino), `squat` (Agachamento), `deadlift` (Levantamento Terra). |
| **Reference 1RM** | 1RM de referência informado pelo usuário. Base de todos os cálculos de carga. Versionado (histórico). |
| **e1RM** | 1RM *estimado* a partir de um set real (peso, reps, RIR). Sempre exibido como estimativa. |
| **Program template** | Programa da base interna (ex.: "Smolov Jr. — original"), com fonte, versão e status de verificação. |
| **Program day** | Um dia de treino dentro da estrutura original de um template (ex.: Smolov Jr., semana 1, dia 3). |
| **Session slot** | Uma sessão configurada pelo usuário: `(ordem, lift, template, program day)`. |
| **Block** | Janela de 3 semanas do programa sendo visualizada/gerada. Para programas > 3 semanas o usuário escolhe a semana inicial do bloco. |
| **Periodization** | Resultado gerado: lista de prescrições por semana × sessão, com cargas calculadas. |
| **RIR / RPE** | Repetições em reserva / Rate of Perceived Exertion. Relação: `RPE = 10 − RIR`. |

---

## 1. Conceito central

O usuário configura **independentemente** cada sessão de treino da semana escolhendo:
exercício, programa, número da sessão e semana/bloco do programa. O app gera
automaticamente uma **periodização completa de 3 semanas** a partir dessas escolhas e dos
1RMs de referência.

- Programas e exercícios podem ser misturados livremente na mesma semana.
- Sessões podem ser adicionadas, removidas, editadas e reordenadas.
- Qualquer alteração (exercício, programa, sessão, 1RM, incremento) **recalcula
  imediatamente** a periodização.

Exemplo de configuração (deve ser reproduzível em teste E2E):

| Sessão | Exercício | Programa |
|---|---|---|
| 1 | Bench Press | 5/3/1 (custom) |
| 2 | Bench Press | Smolov Jr. |
| 3 | Squat | 5/3/1 (custom) |
| 4 | Deadlift | Sheiko (template selecionado) |

### 1.1 Mapeamento sessão ↔ programa

Cada session slot aponta para **um program day** do template escolhido
(`programDayIndex`, 1-based dentro da semana do programa). Para 5/3/1 custom existe
apenas um dia por semana. Para Smolov Jr. o usuário escolhe qual dos 4 dias semanais a
sessão representa.

- O app **nunca altera** a frequência original do programa. Se a configuração do usuário
  não cobre todos os dias semanais do template (ex.: só 1 dos 4 dias do Smolov Jr.), o
  app exibe um **aviso de fidelidade** ("Este programa prevê 4 sessões/semana; sua
  configuração usa 1"), sem bloquear.
- Atalho "Adicionar todos os dias deste programa" cria os slots correspondentes de uma vez.

---

## 2. Registro inicial de 1RM

- Tela de onboarding (primeiro uso) com campos editáveis em kg para Bench, Squat e Deadlift.
- Validação: número > 0 e ≤ 600 kg, até 2 casas decimais; obrigatório para todos os lifts
  que tenham sessões configuradas (pode-se deixar um lift vazio se não for treinado; o app
  impede gerar sessões para esse lift até que seja preenchido).
- O usuário pode atualizar os 1RMs a qualquer momento (Ajustes → 1RMs).
- **Cada alteração cria um novo registro versionado** (`reference_1rm_history`: lift,
  valor, data efetiva, origem = `manual | from_e1rm | onboarding`). Nunca sobrescrever.
- A periodização sempre usa o 1RM de referência **vigente**; sessões já registradas
  guardam um *snapshot* do 1RM e das cargas usados no momento do treino.

---

## 3. Base de dados de programas

### 3.1 Regras invioláveis

1. **Nunca inventar** sets, reps ou percentuais.
2. Nunca combinar variações diferentes sem identificá-las como templates distintos.
3. Preservar a estrutura original (duração, frequência, ordem dos dias, progressão).
4. Todo template contém `source` (autor, obra/publicação, URL quando houver, data de
   consulta) e `version`.
5. Programas com mais de 3 semanas são armazenados **completos**; o usuário visualiza um
   bloco de 3 semanas escolhendo a semana inicial. Nunca comprimir.
6. Dados ausentes ou não verificados são marcados explicitamente
   (`verification: 'verified' | 'partial' | 'unverified'` no template e
   `unverified: true` / `note` na prescrição). A UI exibe um selo
   "Dados não verificados" e **não calcula carga** para prescrições sem percentual
   confirmado — mostra "—" e a observação.
7. Os dados vivem em `src/programs/data/*.ts`, validados por schema em tempo de teste
   (um teste falha se algum template violar o schema ou omitir `source`).

### 3.2 Schema (TypeScript)

```ts
type Lift = 'bench' | 'squat' | 'deadlift';

interface ProgramTemplate {
  id: string;                 // 'cycle-531-custom', 'smolov-jr', 'smolov', 'sheiko-29' …
  family: '531-custom' | 'smolov' | 'smolov-jr' | 'sheiko';
  name: string;
  version: string;            // ex.: 'original (S. Smolov, 1970s) — transcrição v1'
  source: { author: string; reference: string; url?: string; accessedAt: string; notes?: string };
  verification: 'verified' | 'partial' | 'unverified';
  durationWeeks: number;
  daysPerWeek: number;
  allowedLifts: Lift[];       // lifts para os quais o template pode ser aplicado
  liftSelectable: boolean;    // true = usuário escolhe o lift (ex.: Smolov Jr.)
  configurable?: ConfigurableParam[]; // parâmetros que o ORIGINAL deixa ao atleta (ver 3.4)
  weeks: ProgramWeek[];
}

interface ProgramWeek { week: number; phase?: string; days: ProgramDay[] }
interface ProgramDay  { day: number; label?: string; items: PrescriptionItem[] }

type PrescriptionItem =
  | { kind: 'main'; lift: Lift | 'selected'; sets: SetPrescription[]; note?: string }
  | { kind: 'accessory'; name: string; text: string; note?: string }; // não calculado

interface SetPrescription {
  reps: number;
  percent?: number;           // fração do 1RM (0.75) — ausente => sem cálculo
  addKg?: ParamRef;           // incremento absoluto definido pelo original (Smolov/Jr.)
  amrap?: boolean;
  repeat?: number;            // nº de sets idênticos (6x6 => repeat: 6)
  unverified?: boolean;
  note?: string;
}
```

### 3.3 Templates

**A. 5/3/1 — versão custom do usuário** (`cycle-531-custom`, `verification: 'verified'`,
fonte = definição do usuário nesta spec). **Não é o 5/3/1 de Wendler** — não usar
percentuais, sets AMRAP ou deload de Wendler.

| Semana | Sets | Reps | % padrão |
|---|---|---|---|
| 1 | 3 | 5 | 75% |
| 2 | 3 | 3 | 85% |
| 3 | 3 | 1 | 95% |

- Exatamente 3 sets de trabalho em todas as semanas.
- Percentual por semana configurável pelo usuário (por perfil; faixa 30–105%,
  passo 0,5%). Default 75/85/95. Lift selecionável.

**B. Smolov (original, agachamento)** (`smolov`). Programa completo (~13 semanas:
microciclo introdutório, mesociclo base, fase de transição/switching, mesociclo intenso
e taper/teste). Deve ser transcrito integralmente de fonte primária/consolidada
identificada, incluindo frequência (até 4x/semana), sets, reps, percentuais e
incrementos absolutos. Lift fixo: squat.

**C. Smolov Jr.** (`smolov-jr`). 3 semanas, 4 dias/semana (6×6 @70%, 7×5 @75%,
8×4 @80%, 10×3 @85% na semana 1, com incrementos absolutos nas semanas 2 e 3 conforme o
original). Lift selecionável. Os incrementos (faixa recomendada pelo original, que
difere entre membros superiores e inferiores) são `configurable` — o usuário escolhe um
valor **dentro da faixa original**; fora da faixa é bloqueado.

**D. Sheiko** (`sheiko-*`). Múltiplos templates originais (ex.: as rotinas numeradas
amplamente difundidas como #29, #30, #31, #32, #37, #39 — a lista final depende de
verificação de fontes). Cada template é um registro próprio com seu número/nome,
fonte, duração e dias. Itens de acessórios são `kind: 'accessory'` (exibidos, não
calculados). Percentuais referem-se ao 1RM de competição do lift correspondente.

> Os valores numéricos de Smolov, Smolov Jr. e Sheiko **não** são definidos nesta spec
> por design: eles devem ser transcritos de fonte identificada pela etapa de
> implementação correspondente (ver PLAN), com testes de "snapshot" de dados e o campo
> `source` preenchido. Os números citados acima servem apenas como checagem de sanidade.

### 3.4 Parâmetros configuráveis

Somente parâmetros que o próprio programa original deixa à escolha do atleta (ex.:
incremento semanal do Smolov Jr.) ou que esta spec define como configuráveis (percentuais
do 5/3/1 custom). Cada parâmetro tem `min`, `max`, `default` e `source`.

### 3.5 Tela "Programas"

Lista de templates com nome, versão, fonte, duração, frequência, selo de verificação.
Detalhe mostra a estrutura completa semana a semana (percentuais e reps), sem cálculos
de carga, e permite navegar por todo o programa original.

---

## 4. Gerador automático de periodização (feature central)

### 4.1 Interface de configuração

Lista ordenável de session slots. Para cada slot:
1. Exercício (lift)
2. Programa (template; filtrado por `allowedLifts`)
3. Dia do programa (quando `daysPerWeek > 1`)
4. Semana inicial do bloco (quando `durationWeeks > 3`; default 1; máximo
   `durationWeeks − 2`; blocos parciais no fim do programa mostram apenas as semanas
   existentes)
5. Parâmetros configuráveis do template, se houver

Ações: adicionar, duplicar, remover, reordenar (setas ↑/↓ acessíveis + arrastar onde
suportado), "Gerar periodização". A geração também é reativa: qualquer edição atualiza a
saída instantaneamente (cálculo puro, síncrono, < 50 ms para 10 slots).

### 4.2 Saída

Para cada `(semana do bloco 1..3) × (slot)`, uma `GeneratedSession` com:

- semana do bloco e semana original do programa
- número da sessão (ordem do slot)
- lift, nome + versão do programa, dia do programa
- lista de sets: reps, % do 1RM, carga calculada (kg, exata), carga arredondada (kg)
- itens acessórios (texto)
- **volume total**: tonelagem `Σ reps × carga arredondada` (kg) e nº total de reps;
  também agregados por semana e por lift
- avisos (dados não verificados, frequência incompleta, 1RM ausente)

### 4.3 Cálculo de carga

```
exactKg   = reference1RM[lift] × percent  (+ Σ addKg acumulados, quando o original define)
roundedKg = round(exactKg, increment)      // ver §5
```

Cálculo feito em `src/domain/` (puro, determinístico, sem I/O), com testes unitários.
Usar aritmética que evite erro de ponto flutuante (trabalhar em gramas inteiras ou
arredondar o resultado final a 3 casas antes de exibir).

### 4.4 Persistência

A configuração (slots) é salva por perfil. Uma periodização gerada pode ser
"ativada" (salva com data de início), o que fixa um snapshot usado pelo calendário e
pelo tracker; regenerar com outra configuração cria uma nova periodização sem apagar a
anterior.

---

## 5. Incrementos e arredondamento

- Opções: 1; 1,25; 1,5; 2; 2,5 kg; custom (0,1–25 kg, passo 0,05).
  Default: 2,5 kg.
- Configuração global do perfil (opcional: override por lift).
- Modo de arredondamento: **ao mais próximo** (default; empate arredonda para baixo, para
  não prescrever acima do percentual), com opções "sempre para baixo" e "sempre para cima".
- Sempre exibir a carga original calculada e a carga prática arredondada
  (ex.: `96,25 → 95,0 kg`).
- Testes de borda obrigatórios: múltiplos exatos, empates, incrementos decimais
  (1,25; 1,5), valores grandes, resultado nunca negativo.

---

## 6. Dashboard de treino e visualização

- **Visão A — Tabela 3 semanas:** linhas = sessões (slot), colunas = semanas 1–3,
  célula = sets×reps @ % → kg arredondado. Em telas estreitas, rolagem horizontal da
  tabela com primeira coluna fixa, ou alternância por semana; em telas largas, as 3
  semanas lado a lado.
- **Visão B — Calendário:** grade semana × sessão; cada card mostra lift, programa,
  resumo de sets; tocar abre `/session/[id]` com a prescrição detalhada (e acesso ao
  registro de desempenho).
- Ambas as visões leem a **mesma** fonte de dados (store/selector) — sincronizadas por
  construção. Teste garante que alterar um slot reflete nas duas.

---

## 7. Registro de desempenho real

Para cada set de trabalho de uma sessão gerada:

| Campo | Regra |
|---|---|
| Peso real (kg) | obrigatório, > 0, pré-preenchido com a carga arredondada prescrita |
| Reps completadas | obrigatório, inteiro ≥ 0 (0 = falha) |
| RIR | inteiro 0–10; `5+` aceito |
| RPE | opcional, 1–10 em passos de 0,5; preenchido automaticamente a partir do RIR |
| Notas | opcional, texto ≤ 500 chars (por set e por sessão) |

Relação RIR ↔ RPE (`src/domain/rpe.ts`):

| RIR | RPE aprox. |
|---|---|
| 0 | 10 |
| 1 | 9 |
| 2 | 8 |
| 3 | 7 |
| 4 | 6 |
| 5+ | ≤ 5 |

- `RPE = 10 − RIR` (para RIR ≥ 5, RPE ≤ 5). Se o usuário edita o RPE, o RIR passa a ser
  `10 − RPE` (permitindo meio ponto, ex.: RPE 8,5 → RIR 1,5).
- Se ambos forem informados e divergirem em mais de 0,5, exibir erro de validação.
- Sets extras (não prescritos) podem ser adicionados e são marcados como `extra`.
- Comparação prescrito × real por set (Δ kg, Δ reps) e por sessão (Δ tonelagem).
- Salvamento local imediato (rascunho) e "Concluir sessão" que grava data e snapshot.

---

## 8. Calculadora automática de e1RM (feature crítica)

### 8.1 Fórmulas (todas consideram RIR)

Seja `w` = peso, `r` = reps completadas, `RIR` = repetições em reserva,
`n = r + RIR` (reps até a falha estimadas).

| ID | Nome | Fórmula | Fonte |
|---|---|---|---|
| `rts` (**default**) | Tabela RPE de Tuchscherer (Reactive Training Systems) | `e1RM = w / pct(r, RPE)` com `pct` da tabela RTS (reps 1–12 × RPE 6–10, meio ponto interpolado) | M. Tuchscherer, *The Reactive Training Manual* (2008) |
| `epley-rir` | Epley ajustado por RIR | `e1RM = w × (1 + n/30)`; se `n = 1`, `e1RM = w` | Epley (1985) + ajuste RIR (Zourdos et al., 2016) |
| `brzycki-rir` | Brzycki ajustado por RIR | `e1RM = w × 36 / (37 − n)` | Brzycki (1993) + ajuste RIR |

A tabela RTS deve ser transcrita de fonte identificada em `src/domain/e1rm/rts-table.ts`
com `source`. O usuário escolhe a fórmula em Ajustes; a fórmula usada é gravada junto de
cada estimativa (recalcular histórico com outra fórmula é uma visão, não uma reescrita).

**Exemplo de aceitação** (Bench, 80 kg × 5 @ RIR 1 / RPE 9):
- `epley-rir`: 80 × (1 + 6/30) = **96,0 kg**
- `brzycki-rir`: 80 × 36/31 = **92,9 kg**
- `rts`: 80 / pct(5 reps, RPE 9) — valor esperado obtido da tabela transcrita
  (≈ 95–96 kg; o teste deve usar o valor exato da tabela).

### 8.2 Validade

Um set é **válido para e1RM** se: `r ≥ 1`, `RIR ≤ 4` (RPE ≥ 6) e `n ≤ 12`
(ou limite da tabela). Sets fora disso exibem e1RM "baixa confiabilidade" e não entram
no histórico. Sets sem RIR/RPE não geram e1RM.

### 8.3 Estimativa representativa da sessão

Uma sessão gera **no máximo um e1RM por lift**, nunca um por set:

1. Filtrar sets válidos do lift.
2. Escolher o set com menor `n` (mais próximo de um esforço máximo → menor
   extrapolação).
3. Empate → maior peso; novo empate → menor RIR; novo empate → primeiro set.
4. e1RM da sessão = e1RM desse set. Os e1RMs por set são exibidos apenas como
   informação.

### 8.4 Exibição e histórico

- Mostrar e1RM imediatamente após completar um set válido e no resumo da sessão,
  sempre rotulado "estimado" (ex.: "e1RM ≈ 96 kg (estimativa)").
- Comparar com o e1RM anterior do mesmo lift (Δ kg e Δ %).
- Histórico `e1rm_history` (lift, data, valor, fórmula, set de origem, sessão).
- Ação "Usar como novo 1RM de referência" → cria registro em
  `reference_1rm_history` com origem `from_e1rm` (confirmação explícita; nunca
  automático).

---

## 9. Dashboard de progressão de força

Por lift (Bench, Squat, Deadlift), cards com:

- 1RM de referência atual
- último e1RM, e1RM anterior, maior e1RM
- melhora absoluta (kg) e percentual: `último e1RM − baseline`, onde baseline = 1RM de
  referência vigente no início do período selecionado (default: primeiro registro)
- gráfico histórico (linha do e1RM + degraus do 1RM de referência), um por lift,
  com filtro de período (4 semanas, 3 meses, 6 meses, 1 ano, tudo)
- interativo: tocar/hover em um ponto mostra data, valor, sessão de origem

Gráficos com `react-native-svg` (instalado via `npx expo install`) e componentes
próprios — leves, sem animações desnecessárias.

---

## 10. Histórico de treinos

- Lista de sessões concluídas (mais recentes primeiro), filtro por lift, programa e
  período.
- Cada item: data, lift, programa (+ versão), sessão, sets×reps prescritos, pesos/reps
  reais, RIR/RPE, e1RM.
- Detalhe permite comparar com sessões anteriores do mesmo lift/programa/dia.
- Dados históricos são **imutáveis** em relação a mudanças posteriores de programa,
  configuração ou 1RM (snapshots). Edição de uma sessão passada é permitida, mas
  recalcula apenas o e1RM daquela sessão.

---

## 11. Design e UX

- Nome: **CYCLE**. Tema escuro por padrão (opção de claro em Ajustes).
- Paleta: fundo `#000000` / charcoal `#121212`, `#1C1C1E`; texto `#FFFFFF` /
  secundário `#A1A1AA`; acento vermelho sutil `#D32F2F` (uso restrito: ação primária,
  destaque de PR, seleção); bordas `#2A2A2A`.
- Tipografia com hierarquia forte; números tabulares (`fontVariant: ['tabular-nums']`).
- Sem animações decorativas; transições nativas padrão apenas.
- Responsivo: mobile (tabs) e desktop/web largo (sidebar). Breakpoint ≥ 900 px.
- Navegação:
  - Mobile (5 tabs): **Dashboard**, **Periodização** (Tabela | Calendário),
    **Treino** (registro de desempenho), **Progresso**, **Mais** (Programas, Histórico,
    Ajustes).
  - Web/desktop: sidebar com Dashboard, Periodização, Programas, Calendário, Treino,
    Progresso, Histórico, Ajustes.
- Acessibilidade: alvos ≥ 44 pt, `accessibilityLabel` em controles, contraste AA.
- Idioma da UI: português (pt-BR); textos centralizados em `src/i18n/pt-BR.ts`
  para facilitar tradução futura. Números com vírgula decimal na UI.

---

## 12. Requisitos técnicos

### 12.1 Arquitetura em camadas (separação obrigatória)

```
src/
  domain/      # motor matemático puro: rounding, loads, periodization, rpe, e1rm, stats
  programs/    # base de programas: schema, data/*.ts, validação, seleção de blocos
  data/        # persistência: expo-sqlite, migrations, repositories (interfaces + impl)
  state/       # stores/hooks que ligam data ↔ domain ↔ UI
  components/  # UI reutilizável (tabelas, cards, charts, inputs numéricos)
  i18n/        # textos
  app/         # rotas Expo Router (somente telas e layouts)
```

- `domain/` e `programs/` não importam React, Expo ou `data/`.
- `data/` expõe interfaces de repositório; testes usam implementação em memória.
- Nenhum valor aleatório ou "mock" em código de produção.

### 12.2 Persistência

- `expo-sqlite` (verificar API da versão SDK 58 na doc antes de usar).
- Migrations versionadas (`src/data/migrations/NNN_*.ts`), executadas no boot.
- Tabelas mínimas: `profiles`, `reference_1rm_history`, `settings`, `session_slots`,
  `periodizations`, `generated_sessions` (snapshot JSON), `performed_sessions`,
  `performed_sets`, `e1rm_history`.
- Perfis de usuário locais (múltiplos perfis por dispositivo; seletor em Ajustes).
  Todos os dados são escopados por `profile_id`.
- Web: usar o suporte web do expo-sqlite conforme documentação do SDK; se indisponível,
  adapter alternativo atrás da mesma interface de repositório.

### 12.3 Qualidade

- TDD (ver AGENTS.md). Cobertura mínima: `domain/` e `programs/` ≥ 95% linhas;
  global ≥ 80%.
- Jest com preset `jest-expo` + `@testing-library/react-native`.
- CI (GitHub Actions) em todo PR: `npm ci`, `npx expo lint`, `npx tsc --noEmit`,
  `npm test -- --coverage`.
- Validação de entrada em todos os formulários (mensagens claras em pt-BR).

### 12.4 Reatividade

Alterar exercício, programa, sessão, 1RM, incremento ou parâmetros configuráveis deve
recalcular automaticamente a periodização visível (selectors memorizados derivados do
estado; nada de recalcular manualmente em cada tela).

---

## 13. Fluxo-alvo de aceitação (E2E)

1. Abrir o app → onboarding → informar 1RMs (Bench 100, Squat 140, Deadlift 180).
2. Periodização → Sessão 1: Bench / 5/3/1 custom; Sessão 2: Bench / Smolov Jr. dia 1;
   Sessão 3: Squat / 5/3/1; Sessão 4: Deadlift / Sheiko (template X, dia Y).
3. Ver tabela de 3 semanas: Sessão 1 semana 1 = 3×5 @75% → 75,0 kg; semana 2 = 3×3
   @85% → 85,0 kg; semana 3 = 3×1 @95% → 95,0 kg (incremento 2,5 kg).
4. Alternar para calendário → abrir Sessão 1 / semana 1 → registrar 3 sets
   (80 kg × 5 @ RIR 1 no último).
5. Concluir → e1RM estimado exibido e gravado; Progresso mostra o ponto no gráfico de
   Bench; Histórico lista a sessão.
6. Alterar 1RM do Bench para 105 → periodização recalcula; sessão concluída permanece
   inalterada.

---

## 14. Fora de escopo (v1)

Sincronização em nuvem/contas remotas, recursos sociais, geração por LLM de programas,
exercícios acessórios com cálculo de carga, conversão lb (pode ser adicionada depois;
toda a lógica usa kg).
