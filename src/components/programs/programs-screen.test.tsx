import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { ProgramsScreen } from './programs-screen';

describe('ProgramsScreen (en)', () => {
  it('lists the custom 5/3/1 with version, source, duration, frequency and verification', async () => {
    await renderInApp(<ProgramsScreen onOpen={() => {}} />);
    expect(await screen.findByRole('header', { name: 'Programs' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '5/3/1 (custom)' })).toBeOnTheScreen();
    expect(screen.getByText('Version: custom — SPEC v1.1')).toBeOnTheScreen();
    expect(screen.getByText('Author: CYCLE project (user-defined)')).toBeOnTheScreen();
    expect(screen.getByText('Reference: docs/SPEC.md §3.3-A')).toBeOnTheScreen();
    expect(screen.getByText('3 weeks')).toBeOnTheScreen();
    expect(screen.getByText('1 session per week')).toBeOnTheScreen();
    expect(screen.getByText('Verified')).toBeOnTheScreen();
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
    expect(screen.getByText('3 semanas')).toBeOnTheScreen();
    expect(screen.getByText('1 sessão por semana')).toBeOnTheScreen();
    expect(screen.getByText('Verificado')).toBeOnTheScreen();
    expect(screen.getByText('Autor: CYCLE project (user-defined)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir 5/3/1 (custom)' })).toBeOnTheScreen();
  });
});
