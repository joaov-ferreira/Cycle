import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { PlanNewScreen } from './plan-new-screen';

describe('PlanNewScreen', () => {
  it.each([
    ['From a template', 'templates'],
    ['Start a strength program', 'programs'],
    ['Import', 'import'],
    ['Start from scratch', 'scratch'],
  ] as const)('calls onChoose for "%s"', async (name, kind) => {
    const onChoose = jest.fn();
    await renderInApp(<PlanNewScreen onChoose={onChoose} />);
    expect(await screen.findByRole('header', { name: 'New plan' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(onChoose).toHaveBeenCalledWith(kind);
  });

  it('describes the strength program option, next to templates and import', async () => {
    await renderInApp(<PlanNewScreen onChoose={jest.fn()} />);
    expect(await screen.findByText(/Pick a documented program/)).toBeOnTheScreen();
  });

  it('describes the import option', async () => {
    await renderInApp(<PlanNewScreen onChoose={jest.fn()} />);
    expect(await screen.findByText(/AI chatbot/)).toBeOnTheScreen();
  });

  it('is available in Portuguese and goes back', async () => {
    const onBack = jest.fn();
    await renderInApp(<PlanNewScreen onChoose={jest.fn()} onBack={onBack} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Nova periodização' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'A partir de um modelo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Começar do zero' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar um programa de força' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalled();
  });
});
