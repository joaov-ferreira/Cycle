import { fireEvent, screen, within } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { RoundingSection } from './rounding-section';

const NBSP = ' ';

describe('RoundingSection (en)', () => {
  it('shows the default increment, nearest mode and the 96.25 kg example', async () => {
    await renderInApp(<RoundingSection />);
    expect(await screen.findByRole('header', { name: 'Increments and rounding' })).toBeOnTheScreen();
    expect(screen.getByText(`Example: 96.25${NBSP}kg → 95.0${NBSP}kg`)).toBeOnTheScreen();
    const defaults = screen.getByLabelText('Default increment');
    expect(within(defaults).getByRole('button', { name: '2.5', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nearest', selected: true })).toBeOnTheScreen();
  });

  it('changes the default increment, updates the example and persists it', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />);
    await fireEvent.press(
      within(await screen.findByLabelText('Default increment')).getByRole('button', { name: '1.25' }),
    );
    expect(await screen.findByText(`Example: 96.25${NBSP}kg → 96.25${NBSP}kg`)).toBeOnTheScreen();
    expect((await repos.rounding.get(profileId)).incrementKg).toBe(1.25);
  });

  it('accepts a custom increment and applies it to the example', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />);
    await fireEvent.press(
      within(await screen.findByLabelText('Default increment')).getByRole('button', { name: 'Custom' }),
    );
    await fireEvent.changeText(screen.getByLabelText('Default increment (custom)'), '0.75');
    expect(await screen.findByText(`Example: 96.25${NBSP}kg → 96.0${NBSP}kg`)).toBeOnTheScreen();
    expect((await repos.rounding.get(profileId)).incrementKg).toBe(0.75);
  });

  it('explains an invalid custom increment and keeps the stored one', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />);
    await fireEvent.press(
      within(await screen.findByLabelText('Default increment')).getByRole('button', { name: 'Custom' }),
    );
    await fireEvent.changeText(screen.getByLabelText('Default increment (custom)'), '0.82');
    expect(await screen.findByText('Use steps of 0.05')).toBeOnTheScreen();
    expect((await repos.rounding.get(profileId)).incrementKg).toBe(2.5);
  });

  it('changes the rounding mode, updates the example and persists it', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Always up' }));
    expect(await screen.findByText(`Example: 96.25${NBSP}kg → 97.5${NBSP}kg`)).toBeOnTheScreen();
    expect((await repos.rounding.get(profileId)).mode).toBe('up');
  });

  it('overrides the increment of one lift and removes the override', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />);
    const source = within(await screen.findByLabelText('Bench Press increment source'));
    await fireEvent.press(source.getByRole('button', { name: 'Own' }));
    await fireEvent.press(
      within(await screen.findByLabelText('Bench Press increment')).getByRole('button', { name: '1' }),
    );
    expect((await repos.rounding.get(profileId)).liftIncrementsKg).toEqual({ bench: 1 });
    expect(await screen.findByText(`Example: 96.25${NBSP}kg → 95.0${NBSP}kg`)).toBeOnTheScreen();

    await fireEvent.press(source.getByRole('button', { name: 'Use default' }));
    expect(screen.queryByLabelText('Bench Press increment')).toBeNull();
    expect((await repos.rounding.get(profileId)).liftIncrementsKg).toEqual({});
  });
});

describe('RoundingSection (pt-BR)', () => {
  it('formats the example and options with Portuguese conventions', async () => {
    await renderInApp(<RoundingSection />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Incrementos e arredondamento' })).toBeOnTheScreen();
    expect(screen.getByText(`Exemplo: 96,25${NBSP}kg → 95,0${NBSP}kg`)).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Incremento padrão')).getByRole('button', { name: '1,25' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mais próximo', selected: true })).toBeOnTheScreen();
  });

  it('changes the mode in Portuguese and persists it', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />, { language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Sempre para cima' }));
    expect(await screen.findByText(`Exemplo: 96,25${NBSP}kg → 97,5${NBSP}kg`)).toBeOnTheScreen();
    expect((await repos.rounding.get(profileId)).mode).toBe('up');
  });

  it('sets a per-lift increment with a decimal comma', async () => {
    const { repos, profileId } = await renderInApp(<RoundingSection />, { language: 'pt-BR' });
    await fireEvent.press(
      within(await screen.findByLabelText('Origem do incremento de Supino')).getByRole('button', { name: 'Próprio' }),
    );
    await fireEvent.press(
      within(await screen.findByLabelText('Incremento de Supino')).getByRole('button', { name: '1,25' }),
    );
    expect((await repos.rounding.get(profileId)).liftIncrementsKg).toEqual({ bench: 1.25 });
  });
});
