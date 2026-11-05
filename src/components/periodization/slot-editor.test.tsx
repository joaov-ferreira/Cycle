import { fireEvent, screen, within } from '@testing-library/react-native';

import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import type { ProgramTemplate } from '@/programs/schema';
import { renderInApp } from '@/test-utils/render-app';

import { SlotEditor, type SlotEditorProps } from './slot-editor';

/** Fake 6-week, 4-day squat/bench program (not a real one). */
const long: ProgramTemplate = {
  ...cycle531Custom,
  id: 'long',
  name: 'Long program',
  configurable: [],
  durationWeeks: 6,
  daysPerWeek: 4,
  allowedLifts: ['bench', 'squat'],
  weeks: [],
};
const TEMPLATES = [cycle531Custom, long];

function setup(overrides: Partial<SlotEditorProps> = {}, language: 'en' | 'pt-BR' = 'en') {
  const props: SlotEditorProps = {
    slot: { id: 4, lift: 'squat', templateId: 'long', programDay: 2, startWeek: 3 },
    number: 2,
    isFirst: false,
    isLast: false,
    templates: TEMPLATES,
    onChange: jest.fn(),
    onMove: jest.fn(),
    onDuplicate: jest.fn(),
    onRemove: jest.fn(),
    onOpenProgram: jest.fn(),
    ...overrides,
  };
  return renderInApp(<SlotEditor {...props} />, { language }).then(() => props);
}

describe('SlotEditor (en)', () => {
  it('shows the session number and the current choices', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: 'Session 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Squat' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Long program' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Day 2' })).toBeSelected();
    expect(screen.getByText('Block starts at program week 3 of 6')).toBeOnTheScreen();
  });

  it('changing the lift keeps an allowed program and lists only programs for that lift', async () => {
    const props = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Bench Press' }));
    expect(props.onChange).toHaveBeenCalledWith({ lift: 'bench', templateId: 'long', programDay: 2, startWeek: 3 });
  });

  it('changing to a lift the program does not allow switches program and resets day and week', async () => {
    const props = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Deadlift' }));
    expect(props.onChange).toHaveBeenCalledWith({
      lift: 'deadlift',
      templateId: 'cycle-531-custom',
      programDay: 1,
      startWeek: 1,
    });
  });

  it('changes the program, the day and the block start week (1 to 6 − 2 = 4)', async () => {
    const props = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: '5/3/1 (custom)' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ lift: 'squat', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 });
    await fireEvent.press(screen.getByRole('button', { name: 'Day 4' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ lift: 'squat', templateId: 'long', programDay: 4, startWeek: 3 });
    await fireEvent.press(screen.getByRole('button', { name: 'Start session 2 one week later' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ lift: 'squat', templateId: 'long', programDay: 2, startWeek: 4 });
    await fireEvent.press(screen.getByRole('button', { name: 'Start session 2 one week earlier' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ lift: 'squat', templateId: 'long', programDay: 2, startWeek: 2 });
  });

  it('limits the start week to the program (no earlier than 1, no later than durationWeeks − 2)', async () => {
    const props = await setup({ slot: { id: 4, lift: 'squat', templateId: 'long', programDay: 1, startWeek: 4 } });
    const later = await screen.findByRole('button', { name: 'Start session 2 one week later' });
    expect(later).toBeDisabled();
    await fireEvent.press(later);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('hides day and start week for a one-day, three-week program and offers its settings', async () => {
    const props = await setup({ slot: { id: 4, lift: 'bench', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 } });
    await screen.findByRole('header', { name: 'Session 2' });
    expect(screen.queryByRole('button', { name: 'Day 1' })).toBeNull();
    expect(screen.queryByText(/Block starts/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open the settings of 5/3/1 (custom)' }));
    expect(props.onOpenProgram).toHaveBeenCalledWith('cycle-531-custom');
  });

  it('moves, duplicates and removes the session', async () => {
    const props = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Move session 2 up' }));
    expect(props.onMove).toHaveBeenCalledWith(-1);
    await fireEvent.press(screen.getByRole('button', { name: 'Move session 2 down' }));
    expect(props.onMove).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate session 2' }));
    expect(props.onDuplicate).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove session 2' }));
    expect(props.onRemove).toHaveBeenCalled();
  });

  it('disables moving past the edges', async () => {
    await setup({ isFirst: true, isLast: true });
    expect(await screen.findByRole('button', { name: 'Move session 2 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move session 2 down' })).toBeDisabled();
  });
});

describe('SlotEditor (pt-BR)', () => {
  it('translates labels and lift names', async () => {
    await setup({}, 'pt-BR');
    expect(await screen.findByRole('header', { name: 'Sessão 2' })).toBeOnTheScreen();
    const lifts = screen.getByLabelText('Exercício da sessão 2');
    expect(within(lifts).getByRole('button', { name: 'Agachamento' })).toBeOnTheScreen();
    expect(screen.getByText('O bloco começa na semana 3 de 6 do programa')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dia 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mover a sessão 2 para cima' })).toBeOnTheScreen();
  });
});
