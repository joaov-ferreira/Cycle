import { fireEvent, render, screen } from '@testing-library/react-native';

import { palettes, typography } from '@/constants/theme';
import type { LoggedSet, SetErrors } from '@/domain/workout';
import { I18nProvider, type AppLocale } from '@/i18n';

import { SetRow, type SetRowProps } from './set-row';

const working: LoggedSet = { kind: 'working', weightKg: 42.5, reps: null, rir: null, done: false };

function tree(locale: AppLocale, props: Partial<SetRowProps>, handlers: Handlers) {
  return (
    <I18nProvider locale={locale}>
      <SetRow index={1} set={working} {...handlers} {...props} />
    </I18nProvider>
  );
}

type Handlers = {
  onChange: jest.Mock;
  onToggleDone: jest.Mock;
  onToggleKind: jest.Mock;
  onRemove: jest.Mock;
};

async function renderRow(props: Partial<SetRowProps> = {}, locale: AppLocale = 'en') {
  const handlers: Handlers = {
    onChange: jest.fn(),
    onToggleDone: jest.fn(),
    onToggleKind: jest.fn(),
    onRemove: jest.fn(),
  };
  const view = await render(tree(locale, props, handlers));
  const rerenderWith = (next: Partial<SetRowProps>) =>
    view.rerender(tree(locale, { ...props, ...next }, handlers));
  return { ...handlers, rerenderWith };
}

describe('SetRow (en)', () => {
  it('shows the 1-based set number and the logged weight', async () => {
    await renderRow();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 2 weight')).toHaveDisplayValue('42.5');
  });

  it('shows the target reps as placeholder while reps are empty', async () => {
    await renderRow({ placeholderReps: 12 });
    expect(screen.getByLabelText('Set 2 reps')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Set 2 reps')).toHaveProp('placeholder', '12');
  });

  it('shows logged reps and RIR', async () => {
    await renderRow({ set: { ...working, reps: 8, rir: 2 } });
    expect(screen.getByLabelText('Set 2 reps')).toHaveDisplayValue('8');
    expect(screen.getByLabelText('Set 2 RIR')).toHaveDisplayValue('2');
  });

  it('shows the weight field without a visible label or unit, leaving column captions to the header', async () => {
    await renderRow();
    expect(screen.queryByText('Set 2 weight')).toBeNull();
    expect(screen.queryByText('kg')).toBeNull();
    expect(screen.queryByText('Reps')).toBeNull();
    expect(screen.queryByText('RIR')).toBeNull();
  });

  it('keeps the controls on one line that does not wrap', async () => {
    await renderRow();
    expect(screen.getByTestId('set-row-controls')).toHaveStyle({ flexDirection: 'row' });
    expect(screen.getByTestId('set-row-controls')).not.toHaveStyle({ flexWrap: 'wrap' });
  });

  it('gives the reps and RIR inputs their column widths', async () => {
    await renderRow();
    expect(screen.getByLabelText('Set 2 reps')).toHaveStyle({ width: 56 });
    expect(screen.getByLabelText('Set 2 RIR')).toHaveStyle({ width: 48 });
  });

  it('lets the weight field grow to at least 72 pt', async () => {
    await renderRow();
    expect(screen.getByTestId('set-row-weight')).toHaveStyle({ flexGrow: 1, minWidth: 64 });
  });

  it('reports parsed weight, reps and RIR', async () => {
    const { onChange } = await renderRow();
    await fireEvent.changeText(screen.getByLabelText('Set 2 weight'), '40');
    expect(onChange).toHaveBeenLastCalledWith({ weightKg: 40 });
    await fireEvent.changeText(screen.getByLabelText('Set 2 reps'), '12');
    expect(onChange).toHaveBeenLastCalledWith({ reps: 12 });
    await fireEvent.changeText(screen.getByLabelText('Set 2 RIR'), '1');
    expect(onChange).toHaveBeenLastCalledWith({ rir: 1 });
  });

  it('reports null when a field is cleared', async () => {
    const { onChange } = await renderRow({ set: { ...working, reps: 8, rir: 2 } });
    await fireEvent.changeText(screen.getByLabelText('Set 2 reps'), '');
    expect(onChange).toHaveBeenLastCalledWith({ reps: null });
    await fireEvent.changeText(screen.getByLabelText('Set 2 RIR'), '');
    expect(onChange).toHaveBeenLastCalledWith({ rir: null });
  });

  it('keeps only digits in reps and RIR', async () => {
    const { onChange } = await renderRow();
    await fireEvent.changeText(screen.getByLabelText('Set 2 reps'), '1x2');
    expect(onChange).toHaveBeenLastCalledWith({ reps: 12 });
  });

  it('shows the weight changed from outside, such as a copied previous set', async () => {
    const { rerenderWith } = await renderRow();
    await rerenderWith({ set: { ...working, weightKg: 45 } });
    expect(screen.getByLabelText('Set 2 weight')).toHaveDisplayValue('45');
  });

  it('marks the done checkbox from the set state and toggles it', async () => {
    const { onToggleDone } = await renderRow();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Set 2 done', checked: false }));
    expect(onToggleDone).toHaveBeenCalledTimes(1);
  });

  it('shows a checked checkbox for a done set', async () => {
    await renderRow({ set: { ...working, done: true } });
    expect(screen.getByRole('checkbox', { name: 'Set 2 done', checked: true })).toBeOnTheScreen();
  });

  it('shows a warm-up marker instead of the number for warm-up sets', async () => {
    const { onToggleKind } = await renderRow({ set: { ...working, kind: 'warmup' } });
    expect(screen.getByText('W')).toBeOnTheScreen();
    expect(screen.queryByText('2')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Set 2 type' }));
    expect(onToggleKind).toHaveBeenCalledTimes(1);
  });

  it('removes the set from the Remove action', async () => {
    const { onRemove } = await renderRow();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove set 2' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('gives the Remove action a hit area of at least 44 pt', async () => {
    await renderRow();
    const { hitSlop } = screen.getByRole('button', { name: 'Remove set 2' }).props;
    const captionLine = typography.caption.lineHeight ?? 18;
    expect(captionLine + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('shows a localized message for each error code', async () => {
    const errors: SetErrors = { weightKg: 'required', reps: 'outOfRange', rir: 'notInteger' };
    await renderRow({ errors });
    expect(screen.getByText('Enter the weight')).toBeOnTheScreen();
    expect(screen.getByText('Use from 1 to 100 reps')).toBeOnTheScreen();
    expect(screen.getByText('Use steps of 0.5')).toBeOnTheScreen();
  });

  it('shows the last time of the same exercise', async () => {
    await renderRow({ lastTime: { weightKg: 40, reps: 12 } });
    expect(screen.getByText('40 kg × 12')).toBeOnTheScreen();
    expect(screen.getByLabelText('Last time 40 kg × 12')).toBeOnTheScreen();
  });

  it('keeps the kind and done controls at least 44 pt', async () => {
    await renderRow();
    expect(screen.getByRole('button', { name: 'Set 2 type' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
    expect(screen.getByRole('checkbox', { name: 'Set 2 done' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
  });

  it('colors a done checkbox with the accent', async () => {
    await renderRow({ set: { ...working, done: true } });
    expect(screen.getByRole('checkbox', { name: 'Set 2 done' })).toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
  });
});

describe('SetRow (pt-BR)', () => {
  it('shows the decimal weight with a comma and the Portuguese labels', async () => {
    await renderRow({}, 'pt-BR');
    expect(screen.getByLabelText('Carga da série 2')).toHaveDisplayValue('42,5');
    expect(screen.getByRole('checkbox', { name: 'Série 2 concluída' })).toBeOnTheScreen();
  });

  it('parses a comma decimal typed by the user', async () => {
    const { onChange } = await renderRow({}, 'pt-BR');
    await fireEvent.changeText(screen.getByLabelText('Carga da série 2'), '42,5');
    expect(onChange).toHaveBeenLastCalledWith({ weightKg: 42.5 });
  });

  it('shows the last time with pt-BR number formatting', async () => {
    await renderRow({ lastTime: { weightKg: 42.5, reps: 12 } }, 'pt-BR');
    expect(screen.getByText('42,5 kg × 12')).toBeOnTheScreen();
  });

  it('shows Portuguese error messages', async () => {
    const errors: SetErrors = { weightKg: 'zeroLoadNotAllowed', reps: 'required' };
    await renderRow({ errors }, 'pt-BR');
    expect(screen.getByText('Só exercícios de peso corporal e elástico aceitam 0 kg')).toBeOnTheScreen();
    expect(screen.getByText('Informe as repetições')).toBeOnTheScreen();
  });

  it('formats the weight error limits with the locale', async () => {
    await renderRow({ errors: { weightKg: 'outOfRange' } }, 'pt-BR');
    expect(screen.getByText('Use de 0 a 1.000 kg')).toBeOnTheScreen();
  });

  it('labels the Remove action in Portuguese', async () => {
    const { onRemove } = await renderRow({}, 'pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: 'Remover série 2' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('SetRow drop sets', () => {
  const drop: LoggedSet = {
    kind: 'drop',
    weightKg: 32.5,
    reps: null,
    rir: null,
    done: false,
  };

  it('shows a D marker instead of the number, with the drop set labels', async () => {
    const { onToggleKind } = await renderRow({ set: drop });
    expect(screen.getByText('D')).toBeOnTheScreen();
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Drop set' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Drop set weight')).toHaveDisplayValue('32.5');
    expect(screen.getByLabelText('Drop set reps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Drop set RIR')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Drop set done' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove drop set' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Drop set' }));
    expect(onToggleKind).not.toHaveBeenCalled();
  });

  it('has no + Drop action on a drop set or a warm-up', async () => {
    await renderRow({ set: drop, onAddDrop: jest.fn() });
    expect(screen.queryByRole('button', { name: 'Add drop set' })).toBeNull();
    await renderRow({
      set: { ...working, kind: 'warmup' },
      onAddDrop: jest.fn(),
    });
    expect(screen.queryByRole('button', { name: 'Add drop set' })).toBeNull();
  });

  it('shows + Drop on a working set when onAddDrop is given and calls it', async () => {
    const onAddDrop = jest.fn();
    await renderRow({ onAddDrop });
    await fireEvent.press(screen.getByRole('button', { name: 'Add drop set' }));
    expect(onAddDrop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+ Drop')).toBeOnTheScreen();
  });

  it('hides + Drop without onAddDrop', async () => {
    await renderRow();
    expect(screen.queryByText('+ Drop')).toBeNull();
  });

  it('uses the Portuguese labels', async () => {
    await renderRow({ set: drop }, 'pt-BR');
    expect(screen.getByRole('button', { name: 'Drop-set' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Carga do drop-set')).toHaveDisplayValue('32,5');
    expect(screen.getByRole('checkbox', { name: 'Drop-set concluído' })).toBeOnTheScreen();
  });
});

describe('SetRow effort input', () => {
  it('takes half points of RIR and shows them with the locale separator', async () => {
    const { onChange } = await renderRow();
    await fireEvent.changeText(screen.getByLabelText('Set 2 RIR'), '1.5');
    expect(onChange).toHaveBeenLastCalledWith({ rir: 1.5 });
    await renderRow({ set: { ...working, rir: 0.5 } }, 'pt-BR');
    expect(screen.getByLabelText('RIR da série 2')).toHaveDisplayValue('0,5');
  });

  it('accepts a comma in pt-BR and ignores text that is not a number', async () => {
    const { onChange } = await renderRow({}, 'pt-BR');
    await fireEvent.changeText(screen.getByLabelText('RIR da série 2'), '1,5');
    expect(onChange).toHaveBeenLastCalledWith({ rir: 1.5 });
    onChange.mockClear();
    await fireEvent.changeText(screen.getByLabelText('RIR da série 2'), 'abc');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('passes an off-step value on, so the domain can name it', async () => {
    const { onChange } = await renderRow();
    await fireEvent.changeText(screen.getByLabelText('Set 2 RIR'), '1.3');
    expect(onChange).toHaveBeenLastCalledWith({ rir: 1.3 });
  });

  it('shows and takes RPE when the scale is RPE, storing RIR', async () => {
    const { onChange } = await renderRow({ effortScale: 'rpe', set: { ...working, reps: 5, rir: 2 } });
    expect(screen.queryByLabelText('Set 2 RIR')).toBeNull();
    expect(screen.getByLabelText('Set 2 RPE')).toHaveDisplayValue('8');
    await fireEvent.changeText(screen.getByLabelText('Set 2 RPE'), '9.5');
    expect(onChange).toHaveBeenLastCalledWith({ rir: 0.5 });
    await fireEvent.changeText(screen.getByLabelText('Set 2 RPE'), '');
    expect(onChange).toHaveBeenLastCalledWith({ rir: null });
  });

  it('names the drop set effort field by the scale', async () => {
    await renderRow({ effortScale: 'rpe', set: { kind: 'drop', weightKg: 30, reps: null, rir: null, done: false } });
    expect(screen.getByLabelText('Drop set RPE')).toBeOnTheScreen();
  });

  it('keeps the RPE input in the effort column width', async () => {
    await renderRow({ effortScale: 'rpe' });
    expect(screen.getByLabelText('Set 2 RPE')).toHaveStyle({ width: 48 });
  });
});

describe('SetRow prescription', () => {
  const prescribed = {
    reps: 5,
    amrap: false,
    unverified: false,
    percent: 72.5,
    addKg: 0,
    exactKg: 74.313,
    kg: 75,
  };

  it('shows the percent and the exact and rounded loads', async () => {
    await renderRow({ prescribed, placeholderReps: 5 });
    expect(screen.getByText(/^72\.5% → 74\.31 → 75\skg$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 2 reps')).toHaveProp('placeholder', '5');
  });

  it('formats the load line in Portuguese', async () => {
    await renderRow({ prescribed }, 'pt-BR');
    expect(screen.getByText(/^72,5% → 74,31 → 75\skg$/)).toBeOnTheScreen();
  });

  it('marks an AMRAP set and writes its reps placeholder as 5+', async () => {
    await renderRow({ prescribed: { ...prescribed, amrap: true }, placeholderReps: 5 });
    expect(screen.getByText('AMRAP')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 2 reps')).toHaveProp('placeholder', '5+');
  });

  it('badges an unverified set with no load', async () => {
    await renderRow({ prescribed: { ...prescribed, unverified: true, percent: null, exactKg: null, kg: null } });
    expect(screen.getByText('Unverified data')).toBeOnTheScreen();
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it('labels a set beyond the prescription as extra', async () => {
    await renderRow({ extra: true });
    expect(screen.getByText('Extra')).toBeOnTheScreen();
  });

  it('shows the e1RM of a done set', async () => {
    await renderRow({ estimateKg: 96 });
    expect(screen.getByText(/^e1RM ≈ 96\skg$/)).toBeOnTheScreen();
  });

  it('shows no prescription line for a plain set', async () => {
    await renderRow();
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.queryByText('Extra')).toBeNull();
  });
});
