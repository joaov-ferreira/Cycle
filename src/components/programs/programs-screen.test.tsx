import { fireEvent, screen, within } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { ProgramsScreen } from './programs-screen';

describe('ProgramsScreen (en)', () => {
  it('lists the custom 5/3/1 with version, source, duration, frequency and verification', async () => {
    await renderInApp(<ProgramsScreen onOpen={() => {}} />);
    expect(await screen.findByRole('header', { name: 'Programs' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '5/3/1 (custom)' })).toBeOnTheScreen();
    const card = within(screen.getByRole('button', { name: 'Open 5/3/1 (custom)' }));
    expect(card.getByText('Version: custom — SPEC v1.1')).toBeOnTheScreen();
    expect(card.getByText('Author: CYCLE project (user-defined)')).toBeOnTheScreen();
    expect(card.getByText('Reference: docs/SPEC.md §3.3-A')).toBeOnTheScreen();
    expect(card.getByText('3 weeks')).toBeOnTheScreen();
    expect(card.getByText('1 session per week')).toBeOnTheScreen();
    expect(card.getByText('Verified')).toBeOnTheScreen();
  });

  it('lists Smolov Jr. with its source, 3 weeks, 4 sessions per week and a partial-verification badge', async () => {
    await renderInApp(<ProgramsScreen onOpen={() => {}} />);
    const card = within(await screen.findByRole('button', { name: 'Open Smolov Jr.' }));
    expect(card.getByRole('header', { name: 'Smolov Jr.' })).toBeOnTheScreen();
    expect(card.getByText('Reference: smolovjr.com, “Smolov Jr. Program” (HeavyDuty.com, 2017)')).toBeOnTheScreen();
    expect(card.getByText('3 weeks')).toBeOnTheScreen();
    expect(card.getByText('4 sessions per week')).toBeOnTheScreen();
    expect(card.getByText('Partially verified')).toBeOnTheScreen();
  });

  it('opens a program and goes back', async () => {
    const onOpen = jest.fn();
    const onBack = jest.fn();
    await renderInApp(<ProgramsScreen onOpen={onOpen} onBack={onBack} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open 5/3/1 (custom)' }));
    expect(onOpen).toHaveBeenCalledWith('cycle-531-custom');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ProgramsScreen (pt-BR)', () => {
  it('is localized', async () => {
    await renderInApp(<ProgramsScreen onOpen={() => {}} onBack={() => {}} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Programas' })).toBeOnTheScreen();
    const card = within(screen.getByRole('button', { name: 'Abrir 5/3/1 (custom)' }));
    expect(card.getByText('3 semanas')).toBeOnTheScreen();
    expect(card.getByText('1 sessão por semana')).toBeOnTheScreen();
    expect(card.getByText('Verificado')).toBeOnTheScreen();
    expect(card.getByText('Autor: CYCLE project (user-defined)')).toBeOnTheScreen();
    const smolov = within(screen.getByRole('button', { name: 'Abrir Smolov Jr.' }));
    expect(smolov.getByText('4 sessões por semana')).toBeOnTheScreen();
    expect(smolov.getByText('Parcialmente verificado')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir 5/3/1 (custom)' })).toBeOnTheScreen();
  });
});
