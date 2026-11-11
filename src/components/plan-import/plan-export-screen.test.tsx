import { fireEvent, screen } from '@testing-library/react-native';

import { BENCH, SQUAT, createTestStore, seedPlan, seedReferenceMax, v4PlanContent } from '@/test-utils/seed';
import { renderInApp } from '@/test-utils/render-app';

import { PlanExportScreen } from './plan-export-screen';

async function renderExport(options: { planId?: number; language?: 'en' | 'pt-BR' } = {}) {
  const { store, repos } = await createTestStore();
  const plan = await seedPlan(store);
  const share = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  await renderInApp(<PlanExportScreen planId={options.planId ?? plan.id} onBack={onBack} share={share} />, {
    store,
    repos,
    language: options.language,
  });
  return { plan, share, onBack };
}

describe('PlanExportScreen', () => {
  it('shows the plan as cycle-plan JSON and shares it', async () => {
    const { share } = await renderExport();
    const field = await screen.findByLabelText('Plan JSON');
    const text = field.props.children as string;
    const document = JSON.parse(text);
    expect(document.format).toBe('cycle-plan');
    expect(document.name).toBe('Sample plan');
    expect(document.workouts[0].exercises[0].exercise).toBe('barbell-bench-press');
    expect(screen.getByText(/another device/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(text);
  });

  it('carries the 1RMs of the exercises the plan is based on', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent());
    await seedReferenceMax(store, BENCH, 100);
    await seedReferenceMax(store, SQUAT, 140);
    await seedReferenceMax(store, 'overhead-press', 60);
    await renderInApp(<PlanExportScreen planId={plan.id} onBack={jest.fn()} share={jest.fn()} />, { store, repos });
    const document = JSON.parse((await screen.findByLabelText('Plan JSON')).props.children as string);
    expect(document.referenceMaxes).toEqual([
      { exercise: BENCH, kg: 100 },
      { exercise: SQUAT, kg: 140 },
    ]);
    expect(document.workouts[0].programs[0].program).toBe('cycle-531-custom');
  });

  it('is available in Portuguese and goes back', async () => {
    const { onBack } = await renderExport({ language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Exportar periodização' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows a localized not-found message for an unknown plan', async () => {
    await renderExport({ planId: 999 });
    expect(await screen.findByText('Plan not found')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});
