import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { validatePlanContent } from '@/domain/plan';
import { listAllPlanTemplates } from '@/library/plan-templates';
import { selectFindExercise } from '@/state/selectors';
import { renderInApp } from '@/test-utils/render-app';

import { PlanTemplatesScreen } from './plan-templates-screen';

const templates = listAllPlanTemplates();

describe('PlanTemplatesScreen', () => {
  it('lists the seven templates (hybrid included) in English with their summary', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />);
    expect(templates).toHaveLength(7);
    expect(templates.map((template) => template.id)).toContain('hybrid-531');
    for (const template of templates) {
      expect(await screen.findByRole('button', { name: `Open ${template.name.en}` })).toBeOnTheScreen();
    }
    expect(screen.getAllByText('4 workouts · 4 sessions per week').length).toBeGreaterThan(0);
    expect(screen.getByText('3 workouts · 6 sessions per week')).toBeOnTheScreen();
  });

  it('lists the seven templates in Portuguese', async () => {
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

  it('shows the program blocks of the hybrid template: program name → exercise', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Strength + hypertrophy (5/3/1)' }));
    expect(await screen.findByText('Squat day')).toBeOnTheScreen();
    expect(screen.getByText('5/3/1 (custom) → Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('5/3/1 (custom) → Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Leg Press')).toBeOnTheScreen();
  });

  it('shows the program blocks in Portuguese', async () => {
    await renderInApp(<PlanTemplatesScreen onCreated={jest.fn()} />, { language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir Força + hipertrofia (5/3/1)' }));
    expect(await screen.findByText('5/3/1 (custom) → Agachamento livre')).toBeOnTheScreen();
  });

  it('creates the hybrid plan with its blocks and its own 3 + 1 cycle', async () => {
    const onCreated = jest.fn();
    const created = await renderInApp(<PlanTemplatesScreen onCreated={onCreated} />, {
      seed: (r, profileId) => r.settings.update(profileId, { experience: 'advanced' }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Strength + hypertrophy (5/3/1)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Use this template' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const plan = created.store.getState().plans[0];
    expect(plan.cycle.loadWeeks).toBe(3);
    expect(plan.cycle.deloadWeeks).toBe(1);
    expect(plan.workouts[0].programs?.[0]).toMatchObject({ programId: 'cycle-531-custom', roles: { lift: 'barbell-back-squat' } });
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
