import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createClock } from '@/test-utils/clock';
import { createTestStore, seedBodyMetrics } from '@/test-utils/seed';
import { renderInApp } from '@/test-utils/render-app';
import type { AppStore } from '@/state/types';
import type { Repositories } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';
import type { BodyMetricInput } from '@/domain/body';

import { BodyScreen, type BodyScreenProps } from './body-screen';

const NBSP = ' ';
/** Monday 2 March 2026 at noon, local time: "today" for every test below. */
const NOW = new Date(2026, 2, 2, 12, 0);

type Fixture = { store: AppStore; repos: Repositories };

async function fixture(entries: BodyMetricInput[] = []): Promise<Fixture> {
  const clock = createClock(NOW);
  const { store, repos } = await createTestStore({ clock });
  if (entries.length > 0) await seedBodyMetrics(store, entries);
  return { store, repos };
}

async function render(
  { store, repos }: Fixture,
  props: Partial<BodyScreenProps> = {},
  language: LanguageSetting = 'en',
) {
  await renderInApp(<BodyScreen now={NOW} {...props} />, { store, repos, language });
}

const SPEC_WEIGHTS = (): BodyMetricInput[] => [
  { date: '2026-01-31', kind: 'weight', value: 80 },
  { date: '2026-02-19', kind: 'weight', value: 79.4 },
  { date: '2026-02-28', kind: 'weight', value: 79 },
  { date: '2026-03-01', kind: 'weight', value: 78.6 },
];

const dateField = () => screen.getByLabelText('Date (YYYY-MM-DD)');
const valueField = () => screen.getByLabelText('Value');
/** Presses a button and lets the async work it starts (saving, deleting) settle. */
/** Types into a field and lets the state update it causes settle. */
type Field = ReturnType<typeof screen.getByLabelText>;
const typeInto = async (field: Field, text: string) => {
  await act(async () => {
    fireEvent.changeText(field, text);
  });
};

const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('BodyScreen: kind selector and form', () => {
  it('starts on weight, pre-fills today and shows the weight unit', async () => {
    await render(await fixture());
    expect(screen.getByRole('header', { name: 'Body' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weight', selected: true })).toBeOnTheScreen();
    expect(dateField().props.value).toBe('2026-03-02');
    expect(within(screen.getByTestId('body-form')).getByText('kg')).toBeOnTheScreen();
  });

  it('saves a weight: it joins the store and the entries list', async () => {
    const f = await fixture();
    await render(f);
    await typeInto(valueField(), '78.4');
    await press('Save');
    expect(await screen.findByRole('button', { name: `Edit entry Mar 2, 2026, 78.4${NBSP}kg` })).toBeOnTheScreen();
    expect(f.store.getState().bodyMetrics).toEqual([
      expect.objectContaining({ date: '2026-03-02', kind: 'weight', value: 78.4 }),
    ]);
    expect(valueField().props.value).toBe('');
  });

  it('shows localized messages for an empty value, an out-of-range value and a future date', async () => {
    const f = await fixture();
    await render(f);
    await press('Save');
    expect(await screen.findByText('Enter a value')).toBeOnTheScreen();

    await typeInto(valueField(), '500');
    await press('Save');
    expect(await screen.findByText('Use from 20 to 400 kg')).toBeOnTheScreen();

    await typeInto(valueField(), '78.4');
    await typeInto(dateField(), '2026-03-03');
    await press('Save');
    expect(await screen.findByText('The date cannot be in the future')).toBeOnTheScreen();
    expect(f.store.getState().bodyMetrics).toEqual([]);
  });

  it('shows the out-of-range and decimals messages in pt-BR', async () => {
    const f = await fixture();
    await render(f, {}, 'pt-BR');
    await typeInto(screen.getByLabelText('Valor'), '500');
    await press('Salvar');
    expect(await screen.findByText('Use de 20 a 400 kg')).toBeOnTheScreen();
    await typeInto(screen.getByLabelText('Valor'), '78,123');
    await press('Salvar');
    expect(await screen.findByText('Use no máximo 2 casas decimais')).toBeOnTheScreen();
  });

  it('replaces the value of the same day and kind', async () => {
    const f = await fixture([{ date: '2026-03-02', kind: 'weight', value: 80 }]);
    await render(f);
    await typeInto(valueField(), '79.5');
    await press('Save');
    await screen.findByRole('button', { name: `Edit entry Mar 2, 2026, 79.5${NBSP}kg` });
    const sameDay = f.store.getState().bodyMetrics.filter((m) => m.date === '2026-03-02');
    expect(sameDay.map((m) => m.value)).toEqual([79.5]);
  });
});

describe('BodyScreen: stats card', () => {
  it('shows the latest value, the change since the entry 4 weeks older and the 7-day average', async () => {
    await render(await fixture(SPEC_WEIGHTS()));
    const stats = within(screen.getByTestId('body-stats'));
    expect(stats.getByText(`78.6${NBSP}kg`)).toBeOnTheScreen();
    expect(stats.getByText('Mar 1, 2026')).toBeOnTheScreen();
    expect(stats.getByText(`−1.4${NBSP}kg since Jan 31, 2026`)).toBeOnTheScreen();
    expect(stats.getByText('7-day average')).toBeOnTheScreen();
    expect(stats.getByText(`78.8${NBSP}kg`)).toBeOnTheScreen();
  });

  it('localizes the stats in pt-BR', async () => {
    await render(await fixture(SPEC_WEIGHTS()), {}, 'pt-BR');
    const stats = within(screen.getByTestId('body-stats'));
    expect(stats.getByText(`78,6${NBSP}kg`)).toBeOnTheScreen();
    expect(stats.getByText(`−1,4${NBSP}kg desde 31 de jan. de 2026`)).toBeOnTheScreen();
    expect(stats.getByText('Média de 7 dias')).toBeOnTheScreen();
    expect(stats.getByText(`78,8${NBSP}kg`)).toBeOnTheScreen();
  });

  it('omits the rows whose value is null, and has no 7-day average for other kinds', async () => {
    await render(await fixture([{ date: '2026-03-01', kind: 'waist', value: 90 }]));
    await press('Waist');
    expect(within(screen.getByTestId('body-stats')).getByText(`90${NBSP}cm`)).toBeOnTheScreen();
    expect(screen.queryByText('Change')).toBeNull();
    expect(screen.queryByText('7-day average')).toBeNull();
  });
});

describe('BodyScreen: kinds', () => {
  it('switches to another kind with its unit and its own entries', async () => {
    await render(await fixture([...SPEC_WEIGHTS(), { date: '2026-02-01', kind: 'waist', value: 90.5 }]));
    await press('Waist');
    expect(screen.getByRole('button', { name: 'Waist', selected: true })).toBeOnTheScreen();
    expect(within(screen.getByTestId('body-form')).getByText('cm')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Edit entry Feb 1, 2026, 90.5${NBSP}cm` })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Edit entry Mar 1, 2026/ })).toBeNull();
  });

  it('shows the empty state when the kind has no entries', async () => {
    await render(await fixture(SPEC_WEIGHTS()));
    await press('Calf');
    expect(screen.getByText('No entries yet')).toBeOnTheScreen();
    expect(screen.getByText('Add the first Calf measurement above.')).toBeOnTheScreen();
  });
});

describe('BodyScreen: chart', () => {
  it('has one accessible point per entry of the kind', async () => {
    await render(await fixture(SPEC_WEIGHTS()));
    expect(screen.getByRole('button', { name: `Jan 31, 2026: 80${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Feb 19, 2026: 79.4${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Feb 28, 2026: 79${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Mar 1, 2026: 78.6${NBSP}kg` })).toBeOnTheScreen();
  });

  it('filters the points with the period control', async () => {
    await render(await fixture(SPEC_WEIGHTS()));
    await press('4 wks');
    expect(screen.getByRole('button', { name: '4 wks', selected: true })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: `Jan 31, 2026: 80${NBSP}kg` })).toBeNull();
    expect(screen.getByRole('button', { name: `Feb 19, 2026: 79.4${NBSP}kg` })).toBeOnTheScreen();
  });

  it('labels the points in pt-BR', async () => {
    await render(await fixture(SPEC_WEIGHTS()), {}, 'pt-BR');
    expect(screen.getByRole('button', { name: `31 de jan. de 2026: 80${NBSP}kg` })).toBeOnTheScreen();
  });
});

describe('BodyScreen: entries list', () => {
  it('lists the entries of the kind, newest first', async () => {
    await render(await fixture(SPEC_WEIGHTS()));
    const rows = screen.getAllByRole('button', { name: /^Edit entry / }).map((node) => node.props.accessibilityLabel);
    expect(rows).toEqual([
      `Edit entry Mar 1, 2026, 78.6${NBSP}kg`,
      `Edit entry Feb 28, 2026, 79${NBSP}kg`,
      `Edit entry Feb 19, 2026, 79.4${NBSP}kg`,
      `Edit entry Jan 31, 2026, 80${NBSP}kg`,
    ]);
  });

  it('loads an entry into the form for editing and saves the change', async () => {
    const f = await fixture(SPEC_WEIGHTS());
    await render(f);
    await press(`Edit entry Feb 19, 2026, 79.4${NBSP}kg`);
    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeOnTheScreen();
    expect(dateField().props.value).toBe('2026-02-19');
    expect(valueField().props.value).toBe('79.4');
    await typeInto(valueField(), '79.2');
    await press('Save');
    await screen.findByRole('button', { name: `Edit entry Feb 19, 2026, 79.2${NBSP}kg` });
    expect(f.store.getState().bodyMetrics).toHaveLength(4);
  });

  it('deletes an entry after confirming, and keeps it when cancelled', async () => {
    const f = await fixture(SPEC_WEIGHTS());
    await render(f);
    await press('Delete entry Feb 19, 2026');
    expect(screen.getByText('Delete this entry?')).toBeOnTheScreen();
    await press('Cancel');
    expect(f.store.getState().bodyMetrics).toHaveLength(4);

    await press('Delete entry Feb 19, 2026');
    await press('Delete');
    await waitFor(() => expect(screen.queryByRole('button', { name: /Edit entry Feb 19/ })).toBeNull());
    expect(f.store.getState().bodyMetrics.map((m) => m.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-01']);
  });

  it('calls back when Back is pressed', async () => {
    const onBack = jest.fn();
    await render(await fixture(), { onBack });
    await press('Back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('BodyScreen: pt-BR entries', () => {
  it('names the entries with localized dates and numbers', async () => {
    await render(await fixture(SPEC_WEIGHTS()), {}, 'pt-BR');
    expect(
      screen.getByRole('button', { name: `Editar registro de 1 de mar. de 2026, 78,6${NBSP}kg` }),
    ).toBeOnTheScreen();
    within(screen.getByTestId('body-entries')).getByText('Registros');
  });
});
