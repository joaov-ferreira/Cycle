# CYCLE — Plano de Implementação

> Implementa [`SPEC.md`](./SPEC.md) seguindo as regras de [`../AGENTS.md`](../AGENTS.md).

## Como este plano funciona

- O trabalho é dividido em **etapas**. Cada etapa é executada por **um agente em
  contexto limpo** (sem memória das etapas anteriores) e da família indicada:
  - **haiku** — tarefas pequenas, mecânicas e bem delimitadas.
  - **sonnet** — implementação de features de UI + lógica com escopo claro.
  - **opus** — decisões de arquitetura, motor matemático crítico, pesquisa e transcrição
    fiel de programas de treino, revisão final.
- **Uma feature por vez, fechada end-to-end** (domínio → persistência → estado → UI →
  testes → PR mergeado na `main`) antes de iniciar a próxima. Nenhuma etapa começa
  antes da anterior estar mergeada.
- Cada etapa = **1 branch + 1 PR → `main`**, seguindo o workflow TDD do AGENTS.md.
- O agente deve, ao final, marcar a etapa como concluída na tabela de status abaixo
  (no próprio PR) e registrar decisões relevantes em `docs/DECISIONS.md`.

### Prompt padrão para iniciar uma etapa

```
Você é o agente da Etapa <N> do projeto CYCLE. Leia, nesta ordem:
AGENTS.md, docs/SPEC.md, docs/PLAN.md (seção da Etapa <N>) e docs/DECISIONS.md.
Siga estritamente o workflow TDD e de branch/PR do AGENTS.md.
Implemente somente o escopo da Etapa <N>. Ao final, abra o PR para main,
garanta CI verde, faça o merge e atualize o status da etapa no PLAN.md dentro do PR.
```

### Status

| Etapa | Feature | Modelo | Branch | Status |
|---|---|---|---|---|
| 0 | Fundação (testes, CI, tema, navegação, DB) | opus | `feat/00-foundation` | ⬜ |
| 1 | Perfil + registro de 1RM + histórico de 1RM | sonnet | `feat/01-reference-1rm` | ⬜ |
| 2 | Incrementos e arredondamento | haiku | `feat/02-rounding` | ⬜ |
| 3 | Base de programas + 5/3/1 custom + tela Programas | sonnet | `feat/03-programs-531` | ⬜ |
| 4 | Gerador de periodização + Tabela 3 semanas | opus | `feat/04-periodization` | ⬜ |
| 5 | Calendário + detalhe da sessão | sonnet | `feat/05-calendar` | ⬜ |
| 6 | Smolov Jr. | opus | `feat/06-smolov-jr` | ⬜ |
| 7 | Smolov (completo, seleção de bloco) | opus | `feat/07-smolov` | ⬜ |
| 8 | Sheiko (múltiplos templates) | opus | `feat/08-sheiko` | ⬜ |
| 9 | Registro de desempenho + RIR/RPE | sonnet | `feat/09-performance` | ⬜ |
| 10 | Motor de e1RM + estimativa da sessão | opus | `feat/10-e1rm` | ⬜ |
| 11 | Dashboard de progressão + gráficos | sonnet | `feat/11-progress` | ⬜ |
| 12 | Histórico de treinos | sonnet | `feat/12-history` | ⬜ |
| 13 | Dashboard inicial + responsividade desktop | sonnet | `feat/13-dashboard` | ⬜ |
| 14 | Revisão final, E2E e documentação | opus | `chore/14-final-review` | ⬜ |

Legenda: ⬜ pendente · 🟨 em andamento · ✅ mergeado

---

## Etapa 0 — Fundação · **opus**

**Objetivo:** base técnica sobre a qual todas as features serão construídas.
Escolhido opus porque as decisões aqui (camadas, DB, testes) afetam todas as etapas.

Escopo:
1. Ler a doc versionada do Expo SDK 58 (`https://docs.expo.dev/versions/v58.0.0/`) para
   `expo-sqlite`, Expo Router (tabs/stack), `jest-expo`.
2. Infra de testes: `jest-expo`, `@testing-library/react-native`, script
   `npm test`, config de cobertura com thresholds da SPEC §12.3 (aplicados a
   `src/domain` e `src/programs` desde já).
3. CI: `.github/workflows/ci.yml` (lint, tsc, test com cobertura) em `pull_request`
   e `push` para `main`.
4. Remover telas de exemplo do template (`explore`, componentes de demo não usados).
5. Estrutura de pastas da SPEC §12.1 com `README.md` curto em cada camada descrevendo
   as regras de dependência.
6. Tema CYCLE (SPEC §11): tokens em `src/constants/theme.ts`, dark por padrão;
   componentes base `Screen`, `Text`, `Card`, `Button`, `NumberInput` (vírgula decimal,
   validação), `SegmentedControl`.
7. Navegação: tabs mobile (Dashboard, Periodização, Treino, Progresso, Mais) com telas
   placeholder mínimas e funcionais; layout web com sidebar para largura ≥ 900 px.
8. Persistência: wrapper `expo-sqlite`, runner de migrations, migration `001_init`
   com `profiles` e `settings`; interface `Repository` + implementação em memória para
   testes; perfil padrão criado no primeiro boot.
9. `src/i18n/pt-BR.ts`, `docs/DECISIONS.md` (registrar escolhas: lib de estado, estratégia
   de testes de DB, layout web).
10. Ajustar `app.json` (nome "CYCLE", `userInterfaceStyle: "dark"`, cores do splash/ícone
    adaptativo para o tema).

Testes (escrever antes): runner de migrations (ordem, idempotência) com fake;
repositório de perfis em memória; render das tabs; tema dark aplicado por padrão.

Aceite: `npm test`, `npx expo lint`, `npx tsc --noEmit` verdes; app abre em web
(`npx expo start --web`) mostrando as 5 tabs com tema escuro; CI verde no PR.

---

## Etapa 1 — Perfil + 1RM de referência · **sonnet**

Escopo (SPEC §2, §12.2 perfis):
- Migration `reference_1rm_history`; repositório com `getCurrent(profileId, lift)`,
  `listHistory`, `record(value, source)` (append-only).
- `domain/validation.ts`: validação de 1RM (> 0, ≤ 600, 2 casas).
- Onboarding (primeiro boot sem 1RMs) → Ajustes → 1RMs (editar a qualquer momento)
  mostrando histórico por lift.
- Seletor/criação/renomeação de perfis em Ajustes; troca de perfil isola dados.

Testes: validação (bordas), append-only (editar cria novo registro), atual = mais
recente por data efetiva, isolamento por perfil, fluxo de onboarding (RTL).

Aceite: usuário informa 1RMs, reabre o app e os valores persistem; histórico mostra
versões anteriores.

---

## Etapa 2 — Incrementos e arredondamento · **haiku**

Escopo (SPEC §5): `domain/rounding.ts` (`roundLoad(kg, increment, mode)`), settings de
incremento (presets + custom, override por lift opcional, modo), UI em Ajustes com
preview "exemplo: 96,25 → 95,0 kg".

Testes (tabela de casos): múltiplos exatos; empate → para baixo no modo nearest;
1,25 / 1,5 / custom 0,5; modos down/up; valores grandes; sem erro de ponto flutuante
(ex.: `roundLoad(0.1+0.2, …)`); custom inválido rejeitado.

Aceite: alterar incremento persiste e o preview atualiza.

---

## Etapa 3 — Base de programas + 5/3/1 custom · **sonnet**

Escopo (SPEC §3.1–3.5):
- `programs/schema.ts` (tipos da SPEC §3.2) + validador; teste que roda o validador em
  **todos** os templates registrados (falha se faltar `source`, `version`, semanas
  inconsistentes, etc.).
- `programs/data/cycle-531-custom.ts` exatamente como SPEC §3.3-A.
- `programs/registry.ts` (lista, busca por id, filtro por lift) e
  `programs/blocks.ts` (`getBlock(template, startWeek)` → até 3 semanas, sem
  comprimir; já testado com um template fake de 13 semanas).
- Configuração dos percentuais do 5/3/1 por perfil (settings), faixa 30–105%.
- Tela "Programas" (lista + detalhe da estrutura original, selo de verificação).

Testes: schema, 5/3/1 = 3 sets em todas as semanas com reps 5/3/1, percentuais default
e customizados, `getBlock` em bordas (início, fim parcial).

Aceite: tela Programas lista o 5/3/1 custom com fonte e estrutura; percentuais editáveis.

---

## Etapa 4 — Gerador de periodização + Tabela · **opus**

Feature central; opus pela modelagem do motor e da reatividade.

Escopo (SPEC §1, §4, §6-A):
- Migration `session_slots`, `periodizations`, `generated_sessions`.
- `domain/periodization.ts`: `generatePeriodization(slots, templates, ref1RMs,
  rounding, params) → Periodization` puro; cálculo de carga exata + arredondada;
  tonelagem e reps totais por sessão/semana/lift; avisos (1RM ausente, frequência
  incompleta, dados não verificados → sem carga).
- Store/selectors memorizados: qualquer mudança em slots, 1RM, rounding ou parâmetros
  recalcula.
- UI Periodização: editor de slots (adicionar, duplicar, remover, reordenar ↑/↓,
  escolher lift → programa → dia → semana inicial do bloco), botão "Gerar/Ativar"
  (salva snapshot com data de início) e **Visão Tabela** (SPEC §6-A), responsiva.
- Nesta etapa só o 5/3/1 está disponível — o motor deve ser genérico (testado com
  templates fake multi-dia, multi-semana, com `addKg` e itens acessórios).

Testes: casos do fluxo E2E da SPEC §13 passo 3; mistura de lifts; reordenação altera
número da sessão; alterar 1RM recalcula; prescrição `unverified` não gera carga;
performance (10 slots < 50 ms); componente tabela renderiza valores exatos/arredondados.

Aceite: usuário monta 3 sessões com 5/3/1 (bench, squat, deadlift) e vê a tabela
correta de 3 semanas; editar 1RM em Ajustes atualiza a tabela.

---

## Etapa 5 — Calendário + detalhe da sessão · **sonnet**

Escopo (SPEC §6-B): toggle Tabela | Calendário na Periodização, grade semana × sessão,
rota `src/app/session/[id].tsx` com prescrição detalhada (sets, %, exata → arredondada,
volume, acessórios, avisos, programa+versão+fonte). Ambas as visões consomem o mesmo
selector.

Testes: sincronização (alterar slot reflete nas duas visões), navegação para o detalhe
com params corretos, render do detalhe.

Aceite: tocar em qualquer card abre o detalhe correto.

---

## Etapa 6 — Smolov Jr. · **opus**

Opus pela exigência de fidelidade e pesquisa de fontes.

Escopo (SPEC §3.3-C):
1. Pesquisar e identificar fonte(s) do Smolov Jr. original; registrar em
   `source` e `docs/DECISIONS.md` (citações, URLs, data de acesso, divergências entre
   fontes e qual foi adotada).
2. Transcrever para `programs/data/smolov-jr.ts`: 3 semanas × 4 dias, sets/reps/%
   e incrementos absolutos semanas 2–3 como parâmetro `configurable` com faixa original
   (diferenciando superiores/inferiores se o original o fizer).
3. Lift selecionável; UI de parâmetro no editor de slot (bloqueia fora da faixa).
4. Ação "Adicionar todos os dias deste programa"; aviso de frequência incompleta.

Testes: snapshot dos dados contra a tabela da fonte (teste explícito por dia), cálculo
de cargas das semanas 2–3 com incremento, validação da faixa, schema.

Aceite: configuração da SPEC §13 (Sessão 2 = Bench / Smolov Jr. dia 1) gera cargas
corretas nas 3 semanas.

---

## Etapa 7 — Smolov (original completo) · **opus**

Escopo (SPEC §3.3-B): pesquisa de fonte; transcrição completa (todas as fases e
semanas, incluindo microciclo introdutório, base, switching, intenso e taper/teste);
o que não for confirmável fica `unverified` com nota; seleção de semana inicial do
bloco na UI (bloco parcial no fim). Lift fixo squat.

Testes: snapshot por semana/dia, duração total, nenhuma semana comprimida,
`getBlock` em todas as posições válidas, prescrições `unverified` sem carga.

Aceite: usuário escolhe Smolov e navega por qualquer bloco de 3 semanas das ~13.

---

## Etapa 8 — Sheiko (múltiplos templates) · **opus**

Escopo (SPEC §3.3-D): pesquisa e seleção dos templates com fonte confiável (cada um
um arquivo `programs/data/sheiko-<id>.ts`); dias multi-lift (filtra itens pelo lift do
slot, mostra os demais itens do dia como informação); acessórios como
`kind: 'accessory'`; seletor de template no editor de slot; tela Programas agrupa
"Sheiko" com seus templates.

Testes: snapshot por template, filtro por lift em dias multi-lift, templates longos com
blocos, schema.

Aceite: Sessão 4 da SPEC §13 (Deadlift / Sheiko) gera prescrição correta; templates não
verificados exibem o selo e não calculam carga onde faltam dados.

---

## Etapa 9 — Registro de desempenho + RIR/RPE · **sonnet**

Escopo (SPEC §7): migrations `performed_sessions`, `performed_sets`; `domain/rpe.ts`
(mapeamento e conversões, inclusive meio ponto, validação de divergência); tela de
registro a partir do detalhe da sessão (pré-preenchimento com a carga prescrita, sets
extras, notas, rascunho auto-salvo, "Concluir sessão" com snapshot); comparação
prescrito × real; tab **Treino** mostra a próxima sessão pendente e sessões em andamento.

Testes: tabela RIR↔RPE completa, RPE→RIR com meio ponto, divergência > 0,5 é erro,
validações de campos, rascunho persiste, snapshot imutável após mudar 1RM.

Aceite: passo 4 do fluxo da SPEC §13.

---

## Etapa 10 — Motor de e1RM · **opus**

Escopo (SPEC §8): `domain/e1rm/` com `rts` (tabela transcrita com fonte),
`epley-rir`, `brzycki-rir`; regras de validade; seleção do set representativo;
migration `e1rm_history`; exibição imediata após set válido e no resumo; comparação
com e1RM anterior; seleção de fórmula em Ajustes; ação "Usar como novo 1RM de
referência" (confirmação, origem `from_e1rm`).

Testes: exemplo de aceitação da SPEC §8.1 (valores exatos), bordas de validade (RIR 5,
n = 13, r = 0), seleção representativa (todos os desempates), sessão com vários sets gera
um único registro por lift, troca de fórmula não reescreve histórico.

Aceite: passo 5 do fluxo da SPEC §13 (até o e1RM gravado).

---

## Etapa 11 — Dashboard de progressão · **sonnet**

Escopo (SPEC §9): `domain/stats.ts` (atual, último, anterior, maior, Δ kg, Δ %,
baseline por período); `npx expo install react-native-svg`; componente `LineChart`
próprio (linha e1RM + degraus de 1RM de referência, eixos, toque/hover com tooltip);
tela Progresso com 3 seções (Bench, Squat, Deadlift) e filtro de período.

Testes: estatísticas (histórico vazio, 1 ponto, vários, baseline por período), escala do
gráfico (domínio/ticks), render e interação do tooltip.

Aceite: após registrar sessões, os cards e gráficos refletem os dados.

---

## Etapa 12 — Histórico de treinos · **sonnet**

Escopo (SPEC §10): lista com filtros (lift, programa, período), detalhe com
prescrito × real, RIR/RPE, e1RM, comparação com sessões anteriores equivalentes;
edição de sessão passada recalcula apenas seu e1RM.

Testes: filtros, ordenação, imutabilidade (mudar programa/1RM não altera histórico),
edição recalcula e1RM daquela sessão apenas.

Aceite: passo 5–6 do fluxo da SPEC §13 (Histórico lista a sessão; ela não muda após
alterar 1RM).

---

## Etapa 13 — Dashboard inicial + responsividade · **sonnet**

Escopo (SPEC §11): tela Dashboard (periodização ativa: semana atual, próxima sessão,
último e1RM por lift, atalhos); revisão de layout desktop (sidebar com todas as seções,
tabela 3 semanas lado a lado) e mobile; auditoria de acessibilidade (labels, alvos,
contraste) e de textos pt-BR.

Testes: render do Dashboard com e sem dados; layout responsivo em larguras 375 / 1280
(mock de dimensões).

Aceite: navegação completa em mobile e web sem telas placeholder restantes.

---

## Etapa 14 — Revisão final, E2E e documentação · **opus**

Escopo: teste de integração cobrindo todo o fluxo da SPEC §13 (repositórios em
memória + telas); revisão crítica de precisão matemática e fidelidade dos dados dos
programas contra as fontes registradas; `npx expo-doctor`; README com setup, arquitetura,
fontes dos programas e limitações (dados `unverified`); corrigir divergências encontradas
(em PRs pequenos se necessário).

Aceite: fluxo E2E verde no CI; todas as etapas ✅ na tabela de status.
