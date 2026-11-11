import { fireEvent, screen } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { AiReviewScreen } from './ai-review-screen';

async function setup(options: { language?: LanguageSetting; planId?: number } = {}) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store);
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: { 'barbell-bench-press': { weightKg: 40, reps: [10, 10, 10] } },
  });
  const planId = options.planId ?? store.getState().plans[0].id;
  const callbacks = { onBack: jest.fn(), onImportAnswer: jest.fn(), share: jest.fn(() => Promise.resolve()) };
  await renderInApp(<AiReviewScreen planId={planId} {...callbacks} />, {
    store,
    repos,
    language: options.language,
  });
  return { planId, ...callbacks };
}

const promptText = () => String(screen.getByTestId('ai-review-prompt').props.children);

describe('AiReviewScreen', () => {
  it('shows the usage steps and a prompt with the plan JSON and the exercise list', async () => {
    await setup();

    expect(await screen.findByRole('header', { name: 'Review with AI' })).toBeOnTheScreen();
    expect(screen.getByText(/^1\. Copy or share the prompt/)).toBeOnTheScreen();
    expect(screen.getByText(/^2\. Paste it in ChatGPT, Claude, Gemini or any assistant/)).toBeOnTheScreen();
    expect(screen.getByText(/^3\. Copy the JSON answer/)).toBeOnTheScreen();
    expect(screen.getByText(/^4\. Come back here and import it/)).toBeOnTheScreen();

    const prompt = promptText();
    expect(prompt).toContain('"format": "cycle-plan"');
    expect(prompt).toContain('"name": "Sample plan"');
    expect(prompt).toContain('EXERCISE LIST');
    expect(prompt).toContain('barbell-bench-press');
    expect(prompt).toContain('40×10');
    expect(prompt).toContain('(write here how you feel, pains, schedule changes)');
  });

  it('puts the typed notes into the prompt as they change', async () => {
    await setup();
    const notes = await screen.findByLabelText('How do you feel? Pain, fatigue, schedule changes…');

    await fireEvent.changeText(notes, 'Left shoulder hurts');
    expect(promptText()).toContain('MY NOTES\nLeft shoulder hurts');
    expect(promptText()).not.toContain('(write here how you feel');

    await fireEvent.changeText(notes, 'Slept badly');
    expect(promptText()).toContain('MY NOTES\nSlept badly');
    expect(promptText()).not.toContain('Left shoulder hurts');
  });

  it('uses the Portuguese texts and prompt in pt-BR', async () => {
    await setup({ language: 'pt-BR' });

    expect(await screen.findByRole('header', { name: 'Revisar com IA' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Importar a resposta' })).toBeOnTheScreen();
    expect(promptText()).toContain('MINHAS OBSERVAÇÕES');
  });

  it('shares the current prompt', async () => {
    const { share } = await setup();
    await fireEvent.changeText(
      await screen.findByLabelText('How do you feel? Pain, fatigue, schedule changes…'),
      'Tired',
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(share).toHaveBeenCalledTimes(1);
    const shared = (share.mock.calls[0] as unknown as [string])[0];
    expect(shared).toBe(promptText());
    expect(shared).toContain('Tired');
  });

  it('opens the import with the plan id', async () => {
    const { onImportAnswer, onBack, planId } = await setup();

    await fireEvent.press(await screen.findByRole('button', { name: 'Import the answer' }));
    expect(onImportAnswer).toHaveBeenCalledWith(planId);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows not found for an unknown plan', async () => {
    const { onBack } = await setup({ planId: 999 });

    expect(await screen.findByText('Plan not found')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
