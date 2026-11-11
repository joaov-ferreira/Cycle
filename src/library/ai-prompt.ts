/**
 * AI plan prompt (IMPORT_FORMAT.md §8, SPEC §4.5). Pure: no I/O, no display strings.
 * The templates are copied verbatim from docs/IMPORT_FORMAT.md §8.1 and §8.2; a test keeps
 * them identical to the Markdown.
 */
import { type Equipment, type Exercise, type MuscleGroup } from '../domain/exercise';

export type PromptLocale = 'en' | 'pt-BR';

/** The placeholder replaced by the exercise list. */
const EXERCISES_PLACEHOLDER = '{{EXERCISES}}';

export const AI_PLAN_PROMPT_TEMPLATE: Record<PromptLocale, string> = {
  en: `You are an experienced strength and hypertrophy coach. Create a weight-training plan for me and deliver it as a file for the CYCLE app.

BEFORE WRITING THE PLAN
You need to know: my goal (hypertrophy, strength, general fitness…), my training experience (beginner, intermediate or advanced), how many days per week I can train and for how long, the equipment I have (full gym, home gym, dumbbells only…), injuries or movements to avoid, exercises I like or dislike, and — optionally — the loads I currently use. If any of this is missing from my message, ask me first and wait for my answer. Do not invent my data.

OUTPUT
Reply with ONE JSON document inside a single \`\`\`json code block, with no comments and nothing else in the block. You may add a short explanation after the block. The document must follow this format:

{
  "format": "cycle-plan",
  "version": 1,
  "name": "plan name, up to 60 characters",
  "description": "optional, up to 500 characters",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "my-exercise", "name": "Exercise name", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "workout name, up to 40 characters",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120,
          "startLoad": 60, "note": "optional, up to 200 characters" }
      ] }
  ]
}

RULES
1. "exercise" must be an id from the EXERCISE LIST below, copied exactly. Only when the exercise I need is not in the list, define it in "customExercises" and use its "key" as "exercise".
2. primaryMuscle / secondaryMuscles: chest, back, shoulders, traps, biceps, triceps, forearms, abs, lowerBack, glutes, quads, hamstrings, adductors, abductors, calves. equipment: barbell, dumbbell, machine, cable, smith, kettlebell, bodyweight, band, other. mechanics: compound or isolation.
3. Limits: 1–14 workouts; 1–30 exercises per workout; sets 1–20; reps 1–100; rir 0–5; rest 0–900 seconds; sessionsPerWeek 1–14; loadWeeks 1–16; deloadWeeks 0–2; deloadVolumeFactor 0.3–1; deloadLoadFactor 0.5–1.
4. "reps" is a range such as "8-12". The app uses double progression: I add reps inside the range and the app raises the load when every set reaches the top of the range, so always give a range (a single number such as "5" means the load goes up whenever all sets reach it).
5. "rir" is the target reps in reserve and "rest" the rest between sets in seconds.
6. "startLoad" (kg) only when I told you the load I use on that exercise; otherwise leave it out.
7. "sessionsPerWeek" is the number of sessions I do per week; the workouts are done in rotation.
8. "cycle": loadWeeks 8 for a beginner, 6 for an intermediate, 4 for an advanced lifter, followed by 1 deload week, unless I ask for something else.
9. All weights in kilograms. Write names and notes in the language I am using.
10. Supersets: to have 2 to 4 consecutive exercises done back to back, give each of them the same "superset" label, for example "superset": "A". Leave it out otherwise.
11. Effort ramp (optional): add "rirRamp": { "start": 3, "end": 0 } inside "cycle" to make the target RIR fall week by week during the load weeks. Use it only if I ask for it or it suits my experience.

EXERCISE LIST (id — name — primary muscle — equipment)
{{EXERCISES}}`,
  'pt-BR': `Você é um treinador experiente de força e hipertrofia. Monte uma periodização de musculação para mim e entregue como um arquivo para o app CYCLE.

ANTES DE MONTAR O TREINO
Você precisa saber: meu objetivo (hipertrofia, força, condicionamento geral…), minha experiência de treino (iniciante, intermediário ou avançado), quantos dias por semana posso treinar e por quanto tempo, os equipamentos que tenho (academia completa, academia em casa, só halteres…), lesões ou movimentos a evitar, exercícios de que gosto ou não gosto e — opcionalmente — as cargas que uso hoje. Se algo disso faltar na minha mensagem, pergunte primeiro e espere a minha resposta. Não invente os meus dados.

SAÍDA
Responda com UM documento JSON dentro de um único bloco de código \`\`\`json, sem comentários e sem mais nada dentro do bloco. Você pode acrescentar uma explicação curta depois do bloco. O documento deve seguir este formato (os nomes das propriedades ficam em inglês, exatamente como abaixo):

{
  "format": "cycle-plan",
  "version": 1,
  "name": "nome da periodização, até 60 caracteres",
  "description": "opcional, até 500 caracteres",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "meu-exercicio", "name": "Nome do exercício", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "nome do treino, até 40 caracteres",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120,
          "startLoad": 60, "note": "opcional, até 200 caracteres" }
      ] }
  ]
}

REGRAS
1. "exercise" deve ser um id da LISTA DE EXERCÍCIOS abaixo, copiado exatamente. Somente quando o exercício de que preciso não estiver na lista, defina-o em "customExercises" e use a "key" dele em "exercise".
2. primaryMuscle / secondaryMuscles: chest (peito), back (costas), shoulders (ombros), traps (trapézio), biceps (bíceps), triceps (tríceps), forearms (antebraços), abs (abdômen), lowerBack (lombar), glutes (glúteos), quads (quadríceps), hamstrings (posteriores de coxa), adductors (adutores), abductors (abdutores), calves (panturrilhas). equipment: barbell (barra), dumbbell (halteres), machine (máquina), cable (polia), smith, kettlebell, bodyweight (peso corporal), band (elástico), other (outro). mechanics: compound (multiarticular) ou isolation (isolado).
3. Limites: 1–14 treinos; 1–30 exercícios por treino; sets (séries) 1–20; reps (repetições) 1–100; rir 0–5; rest (descanso) 0–900 segundos; sessionsPerWeek 1–14; loadWeeks 1–16; deloadWeeks 0–2; deloadVolumeFactor 0.3–1; deloadLoadFactor 0.5–1.
4. "reps" é uma faixa, como "8-12". O app usa dupla progressão: eu aumento as repetições dentro da faixa e o app sobe a carga quando todas as séries chegam ao topo da faixa; por isso sempre informe uma faixa (um número único, como "5", significa que a carga sobe sempre que todas as séries o atingirem).
5. "rir" é a meta de repetições na reserva e "rest" o descanso entre as séries, em segundos.
6. "startLoad" (kg) somente quando eu disser a carga que uso naquele exercício; caso contrário, omita.
7. "sessionsPerWeek" é o número de sessões que faço por semana; os treinos são feitos em rodízio.
8. "cycle": loadWeeks 8 para iniciante, 6 para intermediário, 4 para avançado, seguidas de 1 semana de deload, a menos que eu peça outra coisa.
9. Todas as cargas em quilogramas. Escreva nomes e observações em português.
10. Bi-sets: para que 2 a 4 exercícios seguidos sejam feitos sem descanso entre eles, dê a cada um o mesmo rótulo "superset", por exemplo "superset": "A". Caso contrário, omita.
11. Rampa de esforço (opcional): acrescente "rirRamp": { "start": 3, "end": 0 } dentro de "cycle" para que a meta de RIR caia semana a semana durante as semanas de carga. Use somente se eu pedir ou se combinar com a minha experiência.

LISTA DE EXERCÍCIOS (id — nome — músculo principal — equipamento)
{{EXERCISES}}`,
};

/** One exercise line of the prompt: `id — name — primary muscle — equipment`. */
export function exercisePromptLine(exercise: Exercise, locale: PromptLocale): string {
  const muscle: MuscleGroup = exercise.primaryMuscle;
  const equipment: Equipment = exercise.equipment;
  return [exercise.id, exercise.name[locale], muscle, equipment].join(' — ');
}

/** The first line of the OUTPUT block of each locale, where the reusable part of the prompt starts. */
const OUTPUT_LINE: Record<PromptLocale, string> = { en: 'OUTPUT', 'pt-BR': 'SAÍDA' };

/** Replaces `{{EXERCISES}}` in `text` with one line per non-archived exercise, in the given order. */
function fillExerciseList(text: string, exercises: readonly Exercise[], locale: PromptLocale): string {
  const lines = exercises
    .filter((exercise) => !exercise.archived)
    .map((exercise) => exercisePromptLine(exercise, locale))
    .join('\n');
  // split/join, not String.replace: a name containing "$&" must stay literal.
  return text.split(EXERCISES_PLACEHOLDER).join(lines);
}

/**
 * The prompt for `locale`: the template with one line per non-archived exercise, in the order
 * given (callers pass the built-in library first, then custom exercises).
 */
export function buildAiPlanPrompt(exercises: readonly Exercise[], locale: PromptLocale): string {
  return fillExerciseList(AI_PLAN_PROMPT_TEMPLATE[locale], exercises, locale);
}

/**
 * The plan prompt from its OUTPUT / SAÍDA line to the end (output format, rules and exercise list),
 * with the exercise list filled as in `buildAiPlanPrompt`. Reused by the AI review prompt.
 */
export function aiPlanPromptOutputSection(exercises: readonly Exercise[], locale: PromptLocale): string {
  // The marker is present in both static templates (pinned by ai-review-prompt.test.ts).
  const template = AI_PLAN_PROMPT_TEMPLATE[locale];
  const start = template.indexOf(`\n${OUTPUT_LINE[locale]}\n`) + 1;
  return fillExerciseList(template.slice(start), exercises, locale);
}
