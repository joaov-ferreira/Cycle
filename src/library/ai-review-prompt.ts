/**
 * AI review prompt (SPEC-v3 §7). Pure: no I/O, no display strings. The header templates are copied
 * from docs/SPEC-v3.md §7 (a test keeps them identical); the OUTPUT section is reused from the plan
 * prompt of ai-prompt.ts.
 */
import { type Exercise, type MuscleGroup } from '../domain/exercise';
import { aiPlanPromptOutputSection, type PromptLocale } from './ai-prompt';

/** Everything the review prompt needs, as plain data. */
export interface AiReviewInput {
  locale: 'en' | 'pt-BR';
  planJson: string;                                   // v2 §4.4 export, pretty-printed
  notes?: string;                                     // empty → the localized placeholder below
  period: { from: string; to: string } | null;        // YYYY-MM-DD
  sessions: { done: number; planned: number } | null;
  exercises: {
    exerciseId: string; name: string; stalled: boolean;
    sessions: { date: string; deload: boolean;        // newest first, at most 6 are printed
      sets: { weightKg: number; reps: number; rir: number | null; drop?: boolean }[] }[];
  }[];
  muscleSetsPerWeek: { muscle: MuscleGroup; sets: number }[];
  exerciseList: readonly Exercise[];                  // for the EXERCISE LIST block
}

type ReviewSession = AiReviewInput['exercises'][number]['sessions'][number];
type ReviewSet = ReviewSession['sets'][number];

/** Sessions printed per exercise in the summary. */
const MAX_SESSIONS_PER_EXERCISE = 6;

/** Tag after the date of a deload session; the same in both locales. */
const DELOAD_TAG = '(deload)';

export const AI_REVIEW_HEADER_TEMPLATE: Record<PromptLocale, string> = {
  en: `You are an experienced strength and hypertrophy coach. Below are my current training plan in the
CYCLE app and a summary of what I actually did. Review my results and give me an adjusted plan as a
file for the CYCLE app.

HOW TO REVIEW
Look at each exercise: where the load or the reps went up, keep what works; where I stalled or fell
below the rep range, change something (rep range, sets, exercise variation, order or rest). Check
the weekly sets per muscle group and my adherence, and rebalance the volume if needed. Keep the
exercises I am progressing on unless there is a reason to swap them. After the JSON, explain the
main changes in a few lines. If my notes are empty and you need to know how I feel (pain, fatigue,
schedule changes), ask me first and wait for my answer.

MY NOTES
{{NOTES}}

CURRENT PLAN (cycle-plan JSON)
{{PLAN}}

TRAINING SUMMARY
{{SUMMARY}}`,
  'pt-BR': `Você é um treinador experiente de força e hipertrofia. Abaixo estão a minha periodização atual no
app CYCLE e um resumo do que eu realmente fiz. Analise os meus resultados e me entregue uma
periodização ajustada como um arquivo para o app CYCLE.

COMO ANALISAR
Olhe cada exercício: onde a carga ou as repetições subiram, mantenha o que funciona; onde estagnei
ou fiquei abaixo da faixa de repetições, mude algo (faixa de repetições, séries, variação do
exercício, ordem ou descanso). Confira as séries semanais por grupo muscular e a minha aderência e
reequilibre o volume se for preciso. Mantenha os exercícios em que estou progredindo, a menos que
haja motivo para trocar. Depois do JSON, explique as principais mudanças em poucas linhas. Se as
minhas observações estiverem vazias e você precisar saber como me sinto (dor, fadiga, mudanças de
agenda), pergunte primeiro e espere a minha resposta.

MINHAS OBSERVAÇÕES
{{NOTES}}

PERIODIZAÇÃO ATUAL (JSON cycle-plan)
{{PLAN}}

RESUMO DOS TREINOS
{{SUMMARY}}`,
};

/** The notes placeholder sentence shown when the user wrote nothing. */
export const AI_REVIEW_NOTES_PLACEHOLDER: Record<PromptLocale, string> = {
  en: '(write here how you feel, pains, schedule changes)',
  'pt-BR': '(escreva aqui como você se sente, dores, mudanças de agenda)',
};

const SUMMARY_LABELS: Record<
  PromptLocale,
  {
    period: (from: string, to: string) => string;
    sessions: (done: string, planned: string, adherence: string) => string;
    notation: string;
    muscles: (list: string) => string;
    stalled: string;
    noSessions: string;
  }
> = {
  en: {
    period: (from, to) => `Period: ${from} to ${to}`,
    sessions: (done, planned, adherence) => `Sessions done: ${done} of ${planned} planned (adherence ${adherence}%)`,
    notation: 'Set notation: weight×reps@RIR in kg; d = drop set.',
    muscles: (list) => `Weekly sets per muscle group (average): ${list}`,
    stalled: '[stalled]',
    noSessions: '(no sessions)',
  },
  'pt-BR': {
    period: (from, to) => `Período: ${from} a ${to}`,
    sessions: (done, planned, adherence) => `Sessões feitas: ${done} de ${planned} planejadas (aderência ${adherence}%)`,
    notation: 'Notação das séries: carga×repetições@RIR em kg; d = drop set.',
    muscles: (list) => `Séries semanais por grupo muscular (média): ${list}`,
    stalled: '[estagnado]',
    noSessions: '(sem sessões)',
  },
};

/** A number with `.` as decimal separator, at most 2 decimals and no trailing zeros. */
export function formatReviewNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** One set in the summary notation: `40×12@2`, `35×8` (no RIR), `d28×10` (drop set). */
export function reviewSetText(set: ReviewSet): string {
  const body = `${set.drop ? 'd' : ''}${formatReviewNumber(set.weightKg)}×${formatReviewNumber(set.reps)}`;
  return set.rir === null ? body : `${body}@${formatReviewNumber(set.rir)}`;
}

function sessionLine(session: ReviewSession): string {
  const date = session.deload ? `${session.date} ${DELOAD_TAG}` : session.date;
  return `  ${date}: ${session.sets.map(reviewSetText).join(', ')}`;
}

function exerciseBlock(exercise: AiReviewInput['exercises'][number], locale: PromptLocale): string {
  const labels = SUMMARY_LABELS[locale];
  const heading = `${exercise.exerciseId} — ${exercise.name}${exercise.stalled ? ` ${labels.stalled}` : ''}`;
  const sessions = exercise.sessions.slice(0, MAX_SESSIONS_PER_EXERCISE);
  const body = sessions.length === 0 ? [`  ${labels.noSessions}`] : sessions.map(sessionLine);
  return [heading, ...body].join('\n');
}

/** The `{{SUMMARY}}` block: header lines, one block per exercise, then the weekly sets per muscle. */
export function buildReviewSummary(input: AiReviewInput): string {
  const labels = SUMMARY_LABELS[input.locale];
  const header: string[] = [];
  if (input.period !== null) header.push(labels.period(input.period.from, input.period.to));
  if (input.sessions !== null && input.sessions.planned > 0) {
    const { done, planned } = input.sessions;
    const adherence = Math.round((done / planned) * 100);
    header.push(labels.sessions(formatReviewNumber(done), formatReviewNumber(planned), formatReviewNumber(adherence)));
  }
  header.push(labels.notation);

  const sections = [header.join('\n'), ...input.exercises.map((exercise) => exerciseBlock(exercise, input.locale))];
  if (input.muscleSetsPerWeek.length > 0) {
    const list = input.muscleSetsPerWeek
      .map((entry) => `${entry.muscle} ${formatReviewNumber(entry.sets)}`)
      .join(', ');
    sections.push(labels.muscles(list));
  }
  return sections.join('\n\n');
}

/**
 * The review prompt: the header with `{{NOTES}}`, `{{PLAN}}` and `{{SUMMARY}}` replaced, a blank
 * line, then the plan prompt's OUTPUT section. The replacement is single-pass, so a value that
 * contains a placeholder (for example a plan name) is inserted literally.
 */
export function buildAiReviewPrompt(input: AiReviewInput): string {
  const notes = input.notes?.trim() ? input.notes.trim() : AI_REVIEW_NOTES_PLACEHOLDER[input.locale];
  const values: Record<'NOTES' | 'PLAN' | 'SUMMARY', string> = {
    NOTES: notes,
    PLAN: input.planJson,
    SUMMARY: buildReviewSummary(input),
  };
  const header = AI_REVIEW_HEADER_TEMPLATE[input.locale].replace(
    /\{\{(NOTES|PLAN|SUMMARY)\}\}/g,
    (_match, key: keyof typeof values) => values[key],
  );
  return `${header}\n\n${aiPlanPromptOutputSection(input.exerciseList, input.locale)}`;
}
