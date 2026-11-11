import { fireEvent, screen } from '@testing-library/react-native';

import type { ProgramTemplate } from '@/domain/program';
import { findProgram } from '@/library';
import { renderInApp } from '@/test-utils/render-app';

import { ProgramDetailScreen } from './program-detail-screen';

const NBSP = ' ';

function show(programId: string, extra: Partial<Parameters<typeof ProgramDetailScreen>[0]> = {}, language: 'en' | 'pt-BR' = 'en') {
  const props = { onBack: jest.fn(), onStart: jest.fn(), openUrl: jest.fn(), ...extra };
  return renderInApp(<ProgramDetailScreen programId={programId} {...props} />, { language }).then(() => props);
}

describe('ProgramDetailScreen', () => {
  it('shows the summary, verification with its explanation, version and source', async () => {
    await show('smolov-jr');
    expect(await screen.findByRole('header', { name: 'Smolov Jr.' })).toBeOnTheScreen();
    expect(screen.getByText('3 weeks · 4 days per week')).toBeOnTheScreen();
    expect(screen.getByLabelText('Verification: Partly verified')).toBeOnTheScreen();
    expect(
      screen.getByText('Part of the data comes from secondary sources or had to be interpreted. See the source notes.'),
    ).toBeOnTheScreen();
    const program = findProgram('smolov-jr')!;
    expect(screen.getByText(`Version: ${program.version}`)).toBeOnTheScreen();
    expect(screen.getByText(`Author: ${program.source.author}`)).toBeOnTheScreen();
    expect(screen.getByText(`Reference: ${program.source.reference}`)).toBeOnTheScreen();
    expect(screen.getByText('Consulted on Nov 5, 2026')).toBeOnTheScreen();
    expect(screen.getByText(`Notes: ${program.source.notes}`)).toBeOnTheScreen();
  });

  it('opens the source link', async () => {
    const props = await show('smolov-jr');
    await fireEvent.press(await screen.findByRole('button', { name: 'Open the source' }));
    expect(props.openUrl).toHaveBeenCalledWith(findProgram('smolov-jr')!.source.url);
  });

  it('has no link button for a source without a URL', async () => {
    await show('cycle-531-custom');
    expect(await screen.findByRole('header', { name: '5/3/1 (custom)' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open the source' })).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Verification: Verified')).toBeOnTheScreen();
  });

  it('lists roles and parameters', async () => {
    await show('smolov-jr');
    expect(await screen.findByText('Exercises of the program')).toBeOnTheScreen();
    expect(screen.getByText('You choose the exercise')).toBeOnTheScreen();
    expect(screen.getByText('Weekly increment')).toBeOnTheScreen();
    expect(screen.getByText(`From 2.5${NBSP}kg to 5.0${NBSP}kg, default 2.5${NBSP}kg`)).toBeOnTheScreen();
  });

  it('shows the default exercise of each role and what is written for one exercise only', async () => {
    await show('smolov');
    expect(await screen.findByText('Default exercise: Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Written for this exercise')).toBeOnTheScreen();
  });

  it('shows percentages as fractions of the 1RM in percent and parameters as percentages', async () => {
    await show('cycle-531-custom');
    expect(await screen.findByText('Week 1 percentage')).toBeOnTheScreen();
    expect(screen.getByText('From 30% to 105%, default 75%')).toBeOnTheScreen();
    expect(screen.getByText('3 × 5 @ 75 %')).toBeOnTheScreen();
  });

  it('opens the first week and collapses the rest; weeks expand on demand with increments', async () => {
    await show('smolov-jr');
    expect(await screen.findByRole('button', { name: 'Week 1', expanded: true })).toBeOnTheScreen();
    expect(screen.getByText('Day 1 · Monday')).toBeOnTheScreen();
    expect(screen.getByText('6 × 6 @ 70 %')).toBeOnTheScreen();
    expect(screen.getByText('10 × 3 @ 85 %')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Week 2', expanded: false })).toBeOnTheScreen();
    expect(screen.queryByText('6 × 6 @ 70 % + Weekly increment')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Week 2' }));
    expect(screen.getByText('6 × 6 @ 70 % + Weekly increment')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Week 3' }));
    expect(screen.getByText('6 × 6 @ 70 % + 2 × Weekly increment')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Week 2' }));
    expect(screen.queryByText('6 × 6 @ 70 % + Weekly increment')).not.toBeOnTheScreen();
  });

  it('never shows a load in kilograms of the athlete (no 1RM is involved)', async () => {
    await show('smolov-jr');
    await screen.findByRole('header', { name: 'Smolov Jr.' });
    expect(screen.getByText('Loads are calculated from your 1RM when you start the program.')).toBeOnTheScreen();
  });

  it('shows phases, unverified data with its note, accessories and variations', async () => {
    await show('smolov');
    const smolov = findProgram('smolov')!;
    const unverifiedWeek = smolov.weeks.find((week) =>
      week.days.some((day) => day.items.some((item) => item.kind === 'info' && item.unverified)),
    )!;
    const name = `Week ${unverifiedWeek.week} · ${unverifiedWeek.phase!.en}`;
    await fireEvent.press(await screen.findByRole('button', { name }));
    expect(screen.getAllByText('Unverified data').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Switching phase: light, explosive squat work/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No sets, reps, percentages or frequency confirmed\./).length).toBeGreaterThan(0);
  });

  it('shows accessories as name: sets × reps and the variation as the exercise name', async () => {
    await show('sheiko-29');
    const program = findProgram('sheiko-29')!;
    const days = program.weeks[0].days;
    const accessory = days.flatMap((day) => day.items).find((item) => item.kind === 'accessory')!;
    expect(accessory.kind).toBe('accessory');
    if (accessory.kind !== 'accessory') return;
    expect(
      (await screen.findAllByText(`${accessory.name.en}: ${accessory.sets} × ${accessory.reps}`)).length,
    ).toBeGreaterThan(0);
    const variation = days
      .flatMap((day) => day.items)
      .find((item): item is Extract<ProgramTemplate['weeks'][number]['days'][number]['items'][number], { kind: 'main' }> =>
        item.kind === 'main' && item.variation !== undefined,
      );
    if (variation?.variation) {
      expect(screen.getAllByText(variation.variation.name.en).length).toBeGreaterThan(0);
    }
  });

  it('lists every week of a program, collapsed except the first', async () => {
    await show('sheiko-29');
    expect(await screen.findByRole('button', { name: 'Week 1', expanded: true })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Week \d/ })).toHaveLength(findProgram('sheiko-29')!.durationWeeks);
  });

  it('starts the program and goes back', async () => {
    const props = await show('smolov-jr');
    await fireEvent.press(await screen.findByRole('button', { name: 'Start this program' }));
    expect(props.onStart).toHaveBeenCalledWith('smolov-jr');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('shows the not-found state for an unknown id', async () => {
    const props = await show('nope');
    expect(await screen.findByText('Program not found')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start this program' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('speaks Portuguese: labels, decimals, dates and data text', async () => {
    await show('smolov-jr', {}, 'pt-BR');
    expect(await screen.findByRole('header', { name: 'Smolov Jr.' })).toBeOnTheScreen();
    expect(screen.getByText('3 semanas · 4 dias por semana')).toBeOnTheScreen();
    expect(screen.getByLabelText('Verificação: Parcialmente verificado')).toBeOnTheScreen();
    expect(screen.getByText('Consultada em 5 de nov. de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Incremento semanal')).toBeOnTheScreen();
    expect(screen.getByText(`De 2,5${NBSP}kg a 5,0${NBSP}kg, padrão 2,5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Dia 1 · Segunda-feira')).toBeOnTheScreen();
    expect(screen.getByText('6 × 6 @ 70 %')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Semana 2' }));
    expect(screen.getByText('6 × 6 @ 70 % + Incremento semanal')).toBeOnTheScreen();
  });
});
