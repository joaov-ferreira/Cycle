import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';
import { loggedSet, seedCompleted } from '@/test-utils/seed-history';

import { HistoryDetailScreen } from './history-detail-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);
const at = (iso: string) => `${iso}T12:00:00.000Z`;

let clock = at('2026-11-09');
const setNow = (iso: string) => {
  clock = iso;
};

/**
 * Bench 100 kg, 5/3/1 (custom), program day 1, three weeks; squat in slot 2.
 *  1  bench 1-w1 Nov 9   75×5, 75×5, 80×5 @ RIR 1      → 80 / 0.837 = 95.6;   tonnage 1150
 *  2  squat 2-w1 Nov 10  140×2 @ RIR 1                 → 140 / 0.922 = 151.8
 *  3  bench 1-w2 Nov 16  85×3, 85×3, 87.5×3 @ RIR 1    → 87.5 / 0.892 = 98.1; tonnage 772.5 (prescribed 765)
 *  4  bench 1-w3 Nov 23  95×1 ×3 (no RIR)              → no e1RM;             tonnage 285
 */
async function seed(repos: Repositories, profileId: number) {
  const periodization = await seedActivated(repos, profileId, { lifts: ['bench', 'squat'] });
  const complete = (key: string, sets: ReturnType<typeof loggedSet>[], date: string, notes = '') =>
    seedCompleted(repos, profileId, periodization, key, sets, { at: at(date), setNow, notes });
  await complete('1-w1', [loggedSet(0, 75, 5, null), loggedSet(1, 75, 5, null), loggedSet(2, 80, 5, 1)], '2026-11-09');
  await complete('2-w1', [loggedSet(0, 140, 2, 1, { weightKg: 105, reps: 5 })], '2026-11-10');
  const w2 = { weightKg: 85, reps: 3 };
  await complete(
    '1-w2',
    [loggedSet(0, 85, 3, null, w2), loggedSet(1, 85, 3, null, w2), loggedSet(2, 87.5, 3, 1, w2)],
    '2026-11-16',
    'felt strong',
  );
  const w3 = { weightKg: 95, reps: 1 };
  await complete(
    '1-w3',
    [loggedSet(0, 95, 1, null, w3), loggedSet(1, 95, 1, null, w3), loggedSet(2, 95, 1, null, w3)],
    '2026-11-23',
  );
}

async function renderDetail(
  id: number,
  options: { language?: 'en' | 'pt-BR'; onOpen?: (id: number) => void; onBack?: () => void } = {},
) {
  clock = at('2026-11-09');
  const repos = createMemoryRepositories({ clock: () => new Date(clock) });
  const result = await renderInApp(
    <HistoryDetailScreen performedSessionId={id} onOpen={options.onOpen} onBack={options.onBack} />,
    { repos, language: options.language ?? 'en', seed },
  );
  return { ...result, repos };
}

describe('HistoryDetailScreen: the session (en)', () => {
  it('shows the session, its snapshot and the notes', async () => {
    await renderDetail(3);
    expect(await screen.findByRole('header', { name: 'Session details' })).toBeOnTheScreen();
    expect(screen.getByText('Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Session 1 · Week 2')).toBeOnTheScreen();
    expect(screen.getByText(/Session completed on Nov 16, 2026/)).toBeOnTheScreen();
    expect(
      screen.getByText(
        kg(
          'Prescription as activated on Nov 9, 2026, with the 100.0 kg reference 1RM of that time. Later changes to programs or 1RMs do not affect it.',
        ),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('felt strong')).toBeOnTheScreen();
  });

  it('compares each set with its prescription, with RIR, RPE and the set e1RM', async () => {
    await renderDetail(3);
    const first = within(await screen.findByTestId('set-1'));
    expect(first.getByText(kg('Prescribed: 3 reps @ 85.0 kg'))).toBeOnTheScreen();
    expect(first.getByText(kg('85.0 kg × 3'))).toBeOnTheScreen();
    expect(first.getByText(kg('Δ 0.0 kg · 0 reps vs. prescribed'))).toBeOnTheScreen();
    const last = within(screen.getByTestId('set-3'));
    expect(last.getByText(kg('87.5 kg × 3 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(last.getByText(kg('Δ +2.5 kg · 0 reps vs. prescribed'))).toBeOnTheScreen();
    expect(last.getByText(kg('e1RM ≈ 98.1 kg (estimate)'))).toBeOnTheScreen();
  });

  it('shows the tonnage against the prescription: 772.5 performed, 765 prescribed, Δ +7.5', async () => {
    await renderDetail(3);
    expect(
      await screen.findByText(kg('Tonnage: 772.5 kg performed · 765.0 kg prescribed · Δ +7.5 kg')),
    ).toBeOnTheScreen();
  });

  it('shows the stored session e1RM with the comparison to the previous one (98.1 vs 95.6: +2.5 kg, +2.6%)', async () => {
    await renderDetail(3);
    const card = within(await screen.findByTestId('session-e1rm'));
    expect(card.getByText(kg('Bench Press: e1RM ≈ 98.1 kg (estimate), from set 3'))).toBeOnTheScreen();
    expect(card.getByText(kg('Previous e1RM: 95.6 kg · Δ +2.5 kg (+2.6%)'))).toBeOnTheScreen();
    expect(card.getByText('Formula: RTS chart')).toBeOnTheScreen();
  });

  it('says when the session is not found', async () => {
    await renderDetail(99);
    expect(await screen.findByText('This session was not found in the history.')).toBeOnTheScreen();
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderDetail(3, { onBack });
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('HistoryDetailScreen: equivalent previous sessions', () => {
  it('compares with the earlier session of the same lift, program and day: tonnage -377.5, e1RM +2.5 kg', async () => {
    await renderDetail(3);
    const card = within(await screen.findByTestId('history-equivalents'));
    expect(card.getByText('Equivalent previous sessions')).toBeOnTheScreen();
    expect(
      card.getByText('Earlier sessions of the same lift, program and program day (the 3 most recent).'),
    ).toBeOnTheScreen();
    const row = within(card.getByTestId('equivalent-1'));
    expect(row.getByText('Nov 9, 2026 · Session 1, week 1')).toBeOnTheScreen();
    expect(row.getByText(kg('Tonnage 1,150.0 kg · this session Δ -377.5 kg'))).toBeOnTheScreen();
    expect(row.getByText(kg('e1RM 95.6 kg · this session Δ +2.5 kg (+2.6%)'))).toBeOnTheScreen();
    // another lift is not equivalent
    expect(card.queryByTestId('equivalent-2')).toBeNull();
  });

  it('lists several, newest first, and says when the e1RM cannot be compared', async () => {
    await renderDetail(4);
    const card = within(await screen.findByTestId('history-equivalents'));
    const ids = card.getAllByTestId(/^equivalent-/).map((node) => node.props.testID);
    expect(ids).toEqual(['equivalent-3', 'equivalent-1']);
    const newest = within(card.getByTestId('equivalent-3'));
    expect(newest.getByText(kg('Tonnage 772.5 kg · this session Δ -487.5 kg'))).toBeOnTheScreen();
    expect(newest.getByText('e1RM: not available for both sessions.')).toBeOnTheScreen();
    const oldest = within(card.getByTestId('equivalent-1'));
    expect(oldest.getByText(kg('Tonnage 1,150.0 kg · this session Δ -865.0 kg'))).toBeOnTheScreen();
  });

  it('opens an equivalent session', async () => {
    const onOpen = jest.fn();
    await renderDetail(3, { onOpen });
    await fireEvent.press(await screen.findByRole('button', { name: 'Open the Bench Press session of Nov 9, 2026' }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it('says so when there is no earlier equivalent session', async () => {
    await renderDetail(1);
    expect(await screen.findByText('No earlier session of this lift, program and day.')).toBeOnTheScreen();
    await screen.findByTestId('history-equivalents');
  });

  it('does not treat a session of another lift as equivalent', async () => {
    await renderDetail(2);
    expect(await screen.findByText('No earlier session of this lift, program and day.')).toBeOnTheScreen();
  });
});

describe('HistoryDetailScreen: editing a past session', () => {
  const field = (label: string, set: number) => screen.getByLabelText(`${label}, set ${set}`);

  it('recomputes only that e1RM: 82.5 × 5 @ RIR 1 → 82.5 / 0.837 = 98.6 kg, other sessions untouched', async () => {
    const { repos } = await renderDetail(1);
    const otherBefore = await repos.e1rmHistory.revisions(1, 2);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit session' }));
    expect(await screen.findByText('Edit session')).toBeOnTheScreen();

    await fireEvent.changeText(field('Weight (kg)', 3), '82.5');
    // while editing, the live estimate compares with the estimate before this session
    expect(await screen.findByText(kg('Bench Press: e1RM ≈ 98.6 kg (estimate), from set 3'))).toBeOnTheScreen();

    setNow(at('2026-11-30'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Edited on Nov 30, 2026/)).toBeOnTheScreen();
    const card = within(await screen.findByTestId('session-e1rm'));
    expect(card.getByText(kg('Bench Press: e1RM ≈ 98.6 kg (estimate), from set 3'))).toBeOnTheScreen();
    expect(screen.getByText(/recomputed after an edit \(revision 2\)/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('set-3')).getByText(kg('82.5 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();

    expect((await repos.e1rmHistory.revisions(1, 1)).map((r) => [r.revision, r.valueKg])).toEqual([
      [1, 95.6],
      [2, 98.6],
    ]);
    expect(await repos.e1rmHistory.revisions(1, 2)).toEqual(otherBefore);
    expect((await repos.e1rmHistory.list(1)).map((r) => [r.performedSessionId, r.valueKg])).toEqual([
      [3, 98.1],
      [2, 151.8],
      [1, 98.6],
    ]);
  });

  it('keeps the date and the snapshot when editing', async () => {
    const { repos } = await renderDetail(1);
    const before = (await repos.performances.list(1)).find((r) => r.id === 1)!;
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit session' }));
    await fireEvent.changeText(field('Reps', 1), '4');
    setNow(at('2026-11-30'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Edited on Nov 30, 2026/);
    const after = (await repos.performances.list(1)).find((r) => r.id === 1)!;
    expect(after.completedAt).toBe(before.completedAt);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.sets[0].reps).toBe(4);
    expect(screen.getByText(/Session completed on Nov 9, 2026/)).toBeOnTheScreen();
  });

  it('does not save anything until "Save changes", and Cancel discards the edit', async () => {
    const { repos } = await renderDetail(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit session' }));
    await fireEvent.changeText(field('Weight (kg)', 3), '90');
    expect((await repos.performances.list(1)).find((r) => r.id === 1)!.sets[2].weightKg).toBe(80);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Edit session' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('set-3')).getByText(kg('80.0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(await repos.e1rmHistory.revisions(1, 1)).toHaveLength(1);
  });

  it('requires weight and reps on every set', async () => {
    const { repos } = await renderDetail(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit session' }));
    await fireEvent.changeText(field('Reps', 2), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Fill in the weight and reps of every set/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeOnTheScreen();
    expect((await repos.performances.list(1)).find((r) => r.id === 1)!.sets[1].reps).toBe(5);
  });

  it('removes the estimate when no set is valid any more, keeping the earlier revision', async () => {
    const { repos } = await renderDetail(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit session' }));
    await fireEvent.changeText(field('RIR', 3), '');
    await fireEvent.changeText(field('RPE', 3), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => expect((await repos.e1rmHistory.list(1)).map((r) => r.performedSessionId)).toEqual([3, 2]));
    expect(await screen.findByText(/No set is valid for an e1RM/)).toBeOnTheScreen();
    expect((await repos.e1rmHistory.revisions(1, 1)).map((r) => [r.revision, r.valueKg])).toEqual([
      [1, 95.6],
      [2, null],
    ]);
  });
});

describe('HistoryDetailScreen (pt-BR)', () => {
  it('formats numbers and dates and translates the texts', async () => {
    await renderDetail(3, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Detalhes da sessão' })).toBeOnTheScreen();
    expect(screen.getByText(/Sessão concluída em 16 de nov\. de 2026/)).toBeOnTheScreen();
    expect(
      screen.getByText(
        kg(
          'Prescrição como ativada em 9 de nov. de 2026, com o 1RM de referência de 100,0 kg da época. Mudanças posteriores em programas ou 1RMs não a afetam.',
        ),
      ),
    ).toBeOnTheScreen();
    const last = within(screen.getByTestId('set-3'));
    expect(last.getByText(kg('87,5 kg × 3 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(last.getByText(kg('Δ +2,5 kg · 0 reps vs. prescrito'))).toBeOnTheScreen();
    const card = within(screen.getByTestId('history-equivalents'));
    expect(card.getByText('Sessões anteriores equivalentes')).toBeOnTheScreen();
    const row = within(card.getByTestId('equivalent-1'));
    expect(row.getByText('9 de nov. de 2026 · Sessão 1, semana 1')).toBeOnTheScreen();
    expect(row.getByText(kg('Tonelagem 1.150,0 kg · esta sessão Δ -377,5 kg'))).toBeOnTheScreen();
    expect(row.getByText(kg('e1RM 95,6 kg · esta sessão Δ +2,5 kg (+2,6%)'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar sessão' })).toBeOnTheScreen();
  });
});
