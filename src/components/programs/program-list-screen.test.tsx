import { fireEvent, screen } from '@testing-library/react-native';

import { PROGRAMS, programsByFamily } from '@/library';
import { renderInApp } from '@/test-utils/render-app';

import { ProgramListScreen } from './program-list-screen';

describe('ProgramListScreen', () => {
  it('lists every program under its family, with duration, days and verification', async () => {
    await renderInApp(<ProgramListScreen onOpenProgram={jest.fn()} />);
    expect(await screen.findByRole('header', { name: 'Strength programs' })).toBeOnTheScreen();
    for (const family of ['5/3/1 (custom)', 'Smolov Jr.', 'Smolov', 'Sheiko']) {
      expect(screen.getAllByRole('header', { name: family }).length).toBeGreaterThan(0);
    }
    for (const program of PROGRAMS) {
      expect(screen.getByRole('button', { name: `Open ${program.name}` })).toBeOnTheScreen();
    }
    expect(screen.getByText('13 weeks · 4 days per week')).toBeOnTheScreen();
    expect(screen.getByText('3 weeks · 1 day per week')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Verification: Partly verified').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Verification: Verified')).toBeOnTheScreen();
  });

  it('groups the Sheiko routines together', async () => {
    await renderInApp(<ProgramListScreen onOpenProgram={jest.fn()} />);
    const sheiko = programsByFamily().find((group) => group.family === 'sheiko')!;
    expect(sheiko.programs.length).toBeGreaterThan(1);
    expect(await screen.findAllByRole('header', { name: 'Sheiko' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: `Open ${sheiko.programs[0].name}` })).toBeOnTheScreen();
  });

  it('opens the detail of a program', async () => {
    const onOpenProgram = jest.fn();
    await renderInApp(<ProgramListScreen onOpenProgram={onOpenProgram} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Smolov Jr.' }));
    expect(onOpenProgram).toHaveBeenCalledWith('smolov-jr');
  });

  it('speaks Portuguese', async () => {
    await renderInApp(<ProgramListScreen onOpenProgram={jest.fn()} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Programas de força' })).toBeOnTheScreen();
    expect(screen.getAllByRole('header', { name: '5/3/1 (personalizado)' }).length).toBeGreaterThan(0);
    expect(screen.getByText('13 semanas · 4 dias por semana')).toBeOnTheScreen();
    expect(screen.getByLabelText('Verificação: Verificado')).toBeOnTheScreen();
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderInApp(<ProgramListScreen onOpenProgram={jest.fn()} onBack={onBack} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
