import { fireEvent, screen } from '@testing-library/react-native';

import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout } from '@/test-utils/seed';

import { HistoryDetailScreen } from './history-detail-screen';

const BENCH = 'barbell-bench-press';

/** One bench set of 40 kg × 10 at RIR 2 (RPE 8), logged in the store, then the profile switches to RPE. */
async function renderRpeHistory(language: 'en' | 'pt-BR' = 'en') {
  const clock = createClock('2026-03-02T10:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  const { workout } = await seedCompletedWorkout(store, {
    name: 'Push',
    logs: { [BENCH]: { weightKg: 40, reps: [10], rir: 2 } },
  });
  await store.getState().setEffortScale('rpe');
  await renderInApp(
    <HistoryDetailScreen
      workoutId={workout.id}
      onBack={jest.fn()}
      onOpenExercise={jest.fn()}
      onDeleted={jest.fn()}
      onRepeated={jest.fn()}
    />,
    { store, repos, language },
  );
}

describe('HistoryDetailScreen: effort scale', () => {
  it('shows the logged effort as RPE when the profile reads RPE', async () => {
    await renderRpeHistory();
    expect(await screen.findByText('RPE 8')).toBeOnTheScreen();
    expect(screen.queryByText(/RIR/)).toBeNull();
  });

  it('edits the effort as RPE: the column header and the field are RPE', async () => {
    await renderRpeHistory();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByText('RPE')).toBeOnTheScreen();
    expect(screen.queryByText('RIR')).toBeNull();
    expect(screen.getByLabelText('Set 1 RPE')).toHaveDisplayValue('8');
    expect(screen.queryByLabelText('Set 1 RIR')).toBeNull();
  });

  it('labels the field in Portuguese', async () => {
    await renderRpeHistory('pt-BR');
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar' }));
    expect(await screen.findByLabelText('RPE da série 1')).toHaveDisplayValue('8');
  });
});
