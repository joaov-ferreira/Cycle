import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { validatePlanContent } from '@/domain/plan';
import { listPlanTemplates } from '@/library/plan-templates';
import { selectFindExercise } from '@/state/selectors';
import { renderInApp } from '@/test-utils/render-app';

import { PlanTemplatesScreen } from './plan-templates-screen';

const templates = listPlanTemplates();

describe('PlanTemplatesScreen', () => {
  it('lists the six templates in English with their summary', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />);
    expect(templates).toHaveLength(6);
    for (const template of templates) {
      expect(await screen.findByRole('button', { name: `Open ${template.name.en}` })).toBeOnTheScreen();
    }
    expect(screen.getAllByText('4 workouts · 4 sessions per week').length).toBeGreaterThan(0);
    expect(screen.getByText('3 workouts · 6 sessions per week')).toBeOnTheScreen();
  });

  it('lists the six templates in Portuguese', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />, { language: 'pt-BR' });
    for (const template of templates) {
      expect(await screen.findByRole('button', { name: `Abrir ${template.name['pt-BR']}` })).toBeOnTheScreen();
    }
    expect(screen.getByText('3 treinos · 6 sessões por semana')).toBeOnTheScreen();
  });

  it('shows the workouts and exercises of a template, with targets', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />, { language: 'pt-BR' });
    const upperLower = templates.find((template) => template.id === 'upper-lower-4x')!;
    await fireEvent.press(await screen.findByRole('button', { name: `Abrir ${upperLower.name['pt-BR']}` }));
    expect(await screen.findByRole('header', { name: upperLower.name['pt-BR'] })).toBeOnTheScreen();
    expect(screen.getByText(upperLower.workouts[0].name['pt-BR'])).toBeOnTheScreen();
    const first = upperLower.workouts[0].exercises[0];
    expect(screen.getAllByText(`${first.sets} × ${first.repMin}–${first.repMax}`).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Usar este modelo' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Todos os modelos' }));
    expect(await screen.findByRole('button', { name: `Abrir ${upperLower.name['pt-BR']}` })).toBeOnTheScreen();
  });

  it('creates a valid plan with the experience cycle and UI-language names', async () => {
    const onCreated = jest.fn();
    const created = await renderInApp(<PlanTemplatesScreen onCreated={onCreated} />, {
      language: 'pt-BR',
      seed: (r, profileId) => r.settings.update(profileId, { experience: 'advanced' }),
    });
    const abc = templates.find((template) => template.id === 'abc')!;
    await fireEvent.press(await screen.findByRole('button', { name: `Abrir ${abc.name['pt-BR']}` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar este modelo' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    const state = created.store.getState();
    expect(state.plans).toHaveLength(1);
    const plan = state.plans[0];
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: plan.id }));
    expect(plan.name).toBe(abc.name['pt-BR']);
    expect(plan.workouts[0].name).toBe(abc.workouts[0].name['pt-BR']);
    expect(plan.cycle.loadWeeks).toBe(4);
    expect(validatePlanContent(plan, selectFindExercise(state))).toEqual([]);
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} onBack={onBack} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
