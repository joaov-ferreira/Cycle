import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { ProgramDetailScreen } from './program-detail-screen';

const T = 'cycle-531-custom';

describe('ProgramDetailScreen (en)', () => {
  it('shows identity, source and the original structure with the default percentages', async () => {
    await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />);
    expect(await screen.findByRole('header', { name: '5/3/1 (custom)' })).toBeOnTheScreen();
    expect(screen.getByText('Verified')).toBeOnTheScreen();
    expect(screen.getByText('Version: custom — SPEC v1.1')).toBeOnTheScreen();
    expect(screen.getByText('Author: CYCLE project (user-defined)')).toBeOnTheScreen();
    expect(screen.getByText('Reference: docs/SPEC.md §3.3-A')).toBeOnTheScreen();
    expect(screen.getByText('Accessed: Nov 5, 2026')).toBeOnTheScreen();
    expect(screen.getByText(/Notes: .*not Wendler/)).toBeOnTheScreen();
    expect(screen.getByText('Lifts: Bench Press, Squat, Deadlift')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Week 1' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Week 3' })).toBeOnTheScreen();
    expect(screen.getByText('3 × 5 @ 75%')).toBeOnTheScreen();
    expect(screen.getByText('3 × 3 @ 85%')).toBeOnTheScreen();
    expect(screen.getByText('3 × 1 @ 95%')).toBeOnTheScreen();
  });

  it('edits a percentage: updates the structure and persists the fraction', async () => {
    const { repos, profileId } = await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />);
    await fireEvent.changeText(await screen.findByLabelText('Week 1 percentage'), '80');
    expect(await screen.findByText('3 × 5 @ 80%')).toBeOnTheScreen();
    expect(await repos.programParams.getAll(profileId)).toEqual({ [T]: { week1Percent: 0.8 } });
  });

  it('accepts the 30 % and 105 % limits', async () => {
    const { repos, profileId } = await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />);
    await fireEvent.changeText(await screen.findByLabelText('Week 1 percentage'), '30');
    await fireEvent.changeText(screen.getByLabelText('Week 3 percentage'), '105');
    expect(await screen.findByText('3 × 1 @ 105%')).toBeOnTheScreen();
    expect(await repos.programParams.getAll(profileId)).toEqual({
      [T]: { week1Percent: 0.3, week3Percent: 1.05 },
    });
  });

  it('explains out-of-range and off-step values and stores nothing', async () => {
    const { repos, profileId } = await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />);
    const field = await screen.findByLabelText('Week 2 percentage');
    await fireEvent.changeText(field, '29.5');
    expect(await screen.findByText('Must be at least 30')).toBeOnTheScreen();
    await fireEvent.changeText(field, '106');
    expect(await screen.findByText('Must be at most 105')).toBeOnTheScreen();
    await fireEvent.changeText(field, '85.3');
    expect(await screen.findByText('Use steps of 0.5')).toBeOnTheScreen();
    expect(screen.getByText('3 × 3 @ 85%')).toBeOnTheScreen();
    expect(await repos.programParams.getAll(profileId)).toEqual({});
  });

  it('restores the default percentages', async () => {
    const { repos, profileId } = await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />);
    await fireEvent.changeText(await screen.findByLabelText('Week 1 percentage'), '80');
    await fireEvent.press(screen.getByRole('button', { name: 'Restore default percentages' }));
    expect(await screen.findByText('3 × 5 @ 75%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week 1 percentage').props.value).toBe('75');
    expect(await repos.programParams.getAll(profileId)).toEqual({});
  });

  it('shows saved percentages when opened later', async () => {
    await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />, {
      seed: async (repos, profileId) => {
        await repos.programParams.set(profileId, T, 'week2Percent', 0.9);
      },
    });
    expect(await screen.findByText('3 × 3 @ 90%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week 2 percentage').props.value).toBe('90');
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderInApp(<ProgramDetailScreen templateId={T} onBack={onBack} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('says so when the program does not exist', async () => {
    await renderInApp(<ProgramDetailScreen templateId="nope" onBack={() => {}} />);
    expect(await screen.findByText('This program does not exist.')).toBeOnTheScreen();
  });
});

describe('ProgramDetailScreen (pt-BR)', () => {
  it('uses the decimal comma for typing and display', async () => {
    const { repos, profileId } = await renderInApp(<ProgramDetailScreen templateId={T} onBack={() => {}} />, {
      language: 'pt-BR',
    });
    expect(await screen.findByText('Acessado em: 5 de nov. de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Exercícios: Supino, Agachamento, Levantamento Terra')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Semana 2' })).toBeOnTheScreen();
    expect(
      screen.getByText('Defina o percentual do seu 1RM para cada semana, de 30% a 105%, em passos de 0,5%.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Percentual da semana 1'), '75,5');
    expect(await screen.findByText('3 × 5 @ 75,5%')).toBeOnTheScreen();
    expect(await repos.programParams.getAll(profileId)).toEqual({ [T]: { week1Percent: 0.755 } });

    await fireEvent.changeText(screen.getByLabelText('Percentual da semana 2'), '85.3');
    expect(await screen.findByText('Use múltiplos de 0,5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Restaurar percentuais padrão' })).toBeOnTheScreen();
  });
});
