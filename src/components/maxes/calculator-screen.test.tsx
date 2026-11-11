import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { renderInApp } from '@/test-utils/render-app';
import { SQUAT, createTestStore } from '@/test-utils/seed';

import { CalculatorScreen } from './calculator-screen';

const NBSP = ' ';

async function setup(language: LanguageSetting = 'en', prepare?: (store: Awaited<ReturnType<typeof createTestStore>>['store']) => Promise<void>) {
  const { store, repos } = await createTestStore();
  await prepare?.(store);
  const onBack = jest.fn();
  await renderInApp(<CalculatorScreen onBack={onBack} />, { store, repos, language });
  return { store, onBack };
}

const type = async (label: string, text: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), text);
  });
};
const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });
};
const enterSet = async (weight: string, reps: string, effort: string, effortLabel = 'RIR', labels = ['Weight', 'Reps']) => {
  await type(labels[0], weight);
  await type(labels[1], reps);
  await type(effortLabel, effort);
};
const row = (percent: number) => within(screen.getByTestId(`calc-row-${percent}`));

describe('CalculatorScreen', () => {
  it('works with no profile data and shows nothing to calculate until a set is entered', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: '1RM calculator' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save as 1RM of…', disabled: true })).toBeOnTheScreen();
    expect(screen.queryByText('Loads by percentage')).toBeNull();
  });

  it('shows the three formulas for 80 kg x 5 @ RIR 1 and highlights the profile formula', async () => {
    await setup();
    await enterSet('80', '5', '1');
    expect(await screen.findByRole('button', { name: `Epley, 96.0${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Brzycki, 92.9${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `RTS, 95.6${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Epley, 96.0${NBSP}kg`, selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Your formula')).toBeOnTheScreen();
    expect(screen.queryByText('Low confidence')).toBeNull();
  });

  it('highlights the formula chosen in the profile', async () => {
    await setup('en', (store) => store.getState().setE1rmFormula('rts'));
    await enterSet('80', '5', '1');
    expect(await screen.findByRole('button', { name: `RTS, 95.6${NBSP}kg`, selected: true })).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: `RTS, 95.6${NBSP}kg` })).getByText('Your formula')).toBeOnTheScreen();
  });

  it('marks low confidence', async () => {
    await setup();
    await enterSet('60', '15', '0');
    expect(await screen.findByRole('button', { name: `Epley, 90.0${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getAllByText('Low confidence').length).toBeGreaterThanOrEqual(1);
  });

  it('builds the 50-100 % table with 2.5 kg increments and rounds to the nearest (ties down)', async () => {
    await setup();
    await enterSet('80', '5', '1');
    expect(await screen.findByText('Loads by percentage')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `2.5${NBSP}kg`, selected: true })).toBeOnTheScreen();
    // Epley 96.0: 100% -> 95, 95% 91.2 -> 90, 90% 86.4 -> 87.5, 75% 72 -> 72.5, 50% 48 -> 47.5
    expect(row(100).getByText(`95${NBSP}kg`)).toBeOnTheScreen();
    expect(row(95).getByText(`90${NBSP}kg`)).toBeOnTheScreen();
    expect(row(90).getByText(`87.5${NBSP}kg`)).toBeOnTheScreen();
    expect(row(75).getByText(`72.5${NBSP}kg`)).toBeOnTheScreen();
    expect(row(50).getByText(`47.5${NBSP}kg`)).toBeOnTheScreen();
    expect(row(90).getByText('90%')).toBeOnTheScreen();
    for (const percent of [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]) {
      expect(screen.getByTestId(`calc-row-${percent}`)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId('calc-row-45')).toBeNull();
    expect(screen.getByText('Rounding: Nearest')).toBeOnTheScreen();
  });

  it('follows the increment and the profile rounding mode', async () => {
    await setup('en', (store) => store.getState().setRoundingMode('down'));
    await enterSet('80', '5', '1');
    await press(`1${NBSP}kg`);
    // 96.0 x 90% = 86.4 -> 86 (down, 1 kg)
    expect(row(90).getByText(`86${NBSP}kg`)).toBeOnTheScreen();
    await press(`2.5${NBSP}kg`);
    // down, 2.5 kg: 86.4 -> 85
    expect(row(90).getByText(`85${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Rounding: Always down')).toBeOnTheScreen();
  });

  it('builds the table from the formula selected in the calculator', async () => {
    await setup();
    await enterSet('80', '5', '1');
    await press(`Brzycki, 92.9${NBSP}kg`);
    // Brzycki 92.903: 100% -> 92.5
    expect(row(100).getByText(`92.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Brzycki, 92.9${NBSP}kg`, selected: true })).toBeOnTheScreen();
  });

  it('reads the effort as RPE when the profile uses that scale', async () => {
    await setup('en', (store) => store.getState().setEffortScale('rpe'));
    await enterSet('80', '5', '9', 'RPE');
    expect(await screen.findByRole('button', { name: `Epley, 96.0${NBSP}kg` })).toBeOnTheScreen();
  });

  it('saves the rounded-down estimate as the 1RM of a picked exercise (origin fromE1rm)', async () => {
    const { store } = await setup();
    await enterSet('80', '5', '1');
    await press('Save as 1RM of…');
    expect(await screen.findByText('Save the 1RM as…')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Barbell Back Squat');
    const choice = await screen.findByRole('button', { name: /Barbell Back Squat/ });
    await act(async () => {
      fireEvent.press(choice);
    });
    await waitFor(() => expect(store.getState().referenceMaxes).toHaveLength(1));
    expect(store.getState().referenceMaxes[0]).toMatchObject({ exerciseId: SQUAT, kg: 96, origin: 'fromE1rm' });
    expect(await screen.findByText(`Saved 96.0${NBSP}kg as the 1RM of Barbell Back Squat.`)).toBeOnTheScreen();
  });

  it('saves the value of the selected formula rounded down to 0.5 kg', async () => {
    const { store } = await setup();
    await enterSet('80', '5', '1');
    await press(`Brzycki, 92.9${NBSP}kg`);
    await press('Save as 1RM of…');
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Barbell Back Squat');
    const choice = await screen.findByRole('button', { name: /Barbell Back Squat/ });
    await act(async () => {
      fireEvent.press(choice);
    });
    await waitFor(() => expect(store.getState().referenceMaxes).toHaveLength(1));
    expect(store.getState().referenceMaxes[0].kg).toBe(92.5);
  });

  it('goes back', async () => {
    const { onBack } = await setup();
    await press('Back');
    expect(onBack).toHaveBeenCalled();
  });

  it('is available in Portuguese with comma decimals', async () => {
    await setup('pt-BR');
    await enterSet('80', '5', '1', 'RIR', ['Carga', 'Repetições']);
    expect(await screen.findByRole('button', { name: `Epley, 96,0${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Brzycki, 92,9${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByText('Sua fórmula')).toBeOnTheScreen();
    expect(screen.getByText('Cargas por porcentagem')).toBeOnTheScreen();
    expect(row(90).getByText(`87,5${NBSP}kg`)).toBeOnTheScreen();
    expect(row(90).getByText('90%')).toBeOnTheScreen();
    expect(screen.getByText('Arredondamento: Mais próximo')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `2,5${NBSP}kg`, selected: true })).toBeOnTheScreen();
  });
});
