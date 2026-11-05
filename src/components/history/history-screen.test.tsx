import { fireEvent, screen, within } from '@testing-library/react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { findTemplate } from '@/programs/registry';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';
import { loggedSet, seedCompleted } from '@/test-utils/seed-history';

import { HistoryScreen } from './history-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);
const NOW = new Date('2026-11-20T12:00:00.000Z');
const at = (iso: string) => `${iso}T12:00:00.000Z`;

let clock = at('2026-11-09');
const repositories = () => createMemoryRepositories({ clock: () => new Date(clock) });

/**
 * Bench (5/3/1 custom, slot 1), squat (slot 2) and deadlift (Sheiko #29, slot 3):
 *  1  bench 1-w1  Nov 9   75×5, 75×5, 80×5 @ RIR 1  → rts 80 / 0.837 = 95.6;  tonnage 1150
 *  2  squat 2-w1  Nov 10  140×2 @ RIR 1             → rts 140 / 0.922 = 151.8; tonnage 280
 *  3  bench 1-w2  Nov 16  85×3, 85×3, 87.5×3 @ RIR 1 → rts 87.5 / 0.892 = 98.1; tonnage 772.5
 *  4  deadlift 3-w1 Nov 17 140×5 (no RIR)           → no e1RM;                  tonnage 700
 */
async function seed(repos: Repositories, profileId: number) {
  const periodization = await seedActivated(repos, profileId, {
    lifts: ['bench', 'squat', 'deadlift'],
    templates: { deadlift: 'sheiko-29' },
  });
  const setNow = (iso: string) => {
    clock = iso;
  };
  const complete = (key: string, sets: ReturnType<typeof loggedSet>[], date: string) =>
    seedCompleted(repos, profileId, periodization, key, sets, { at: at(date), setNow });
  await complete('1-w1', [loggedSet(0, 75, 5, null), loggedSet(1, 75, 5, null), loggedSet(2, 80, 5, 1)], '2026-11-09');
  await complete('2-w1', [loggedSet(0, 140, 2, 1, { weightKg: 105, reps: 5 })], '2026-11-10');
  const w2 = { weightKg: 85, reps: 3 };
  await complete(
    '1-w2',
    [loggedSet(0, 85, 3, null, w2), loggedSet(1, 85, 3, null, w2), loggedSet(2, 87.5, 3, 1, w2)],
    '2026-11-16',
  );
  await complete('3-w1', [loggedSet(null, 140, 5, null)], '2026-11-17');
  return periodization;
}

async function renderHistory(
  options: { language?: 'en' | 'pt-BR'; onOpen?: (id: number) => void; seedFn?: (repos: Repositories, profileId: number) => Promise<unknown>; now?: Date } = {},
) {
  clock = at('2026-11-09');
  const repos = repositories();
  return renderInApp(<HistoryScreen onOpen={options.onOpen ?? (() => undefined)} now={options.now ?? NOW} />, {
    repos,
    language: options.language ?? 'en',
    seed: options.seedFn ?? seed,
  });
}

const itemIds = async () =>
  (await screen.findAllByTestId(/^history-item-/)).map((node) => node.props.testID.replace('history-item-', ''));

describe('HistoryScreen (en)', () => {
  it('lists the completed sessions newest first with the count', async () => {
    await renderHistory();
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
    expect(screen.getByText('4 sessions')).toBeOnTheScreen();
  });

  it('shows date, lift, program and version, session, prescribed vs. performed, RIR/RPE, tonnage and e1RM', async () => {
    await renderHistory();
    const item = within(await screen.findByTestId('history-item-3'));
    const version = findTemplate('cycle-531-custom')!.version;
    expect(item.getByText('Nov 16, 2026 · Bench Press')).toBeOnTheScreen();
    expect(item.getByText(`5/3/1 (custom) (version ${version})`)).toBeOnTheScreen();
    expect(item.getByText('Session 1 · Week 2')).toBeOnTheScreen();
    expect(item.getByText(kg('Prescribed: 3×3 @ 85.0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('Performed: 2 × 85.0 kg × 3; 87.5 kg × 3 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(item.getByText(kg('Tonnage: 772.5 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('e1RM ≈ 98.1 kg (estimate)'))).toBeOnTheScreen();
  });

  it('shows the first session with 95.6 kg and 1,150 kg of tonnage', async () => {
    await renderHistory();
    const item = within(await screen.findByTestId('history-item-1'));
    expect(item.getByText(kg('Prescribed: 3×5 @ 75.0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('Performed: 2 × 75.0 kg × 5; 80.0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(item.getByText(kg('Tonnage: 1,150.0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
  });

  it('says so when a session has no e1RM, and shows an extra set without a prescription', async () => {
    await renderHistory();
    const item = within(await screen.findByTestId('history-item-4'));
    expect(item.getByText('No e1RM for this session.')).toBeOnTheScreen();
    expect(item.getByText(kg('Performed: 140.0 kg × 5'))).toBeOnTheScreen();
    expect(item.queryByText(/Prescribed:/)).toBeNull();
  });

  it('filters by lift', async () => {
    await renderHistory();
    await fireEvent.press(await screen.findByRole('button', { name: 'Squat' }));
    expect(await itemIds()).toEqual(['2']);
    expect(screen.getByText('1 session')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Bench Press' }));
    expect(await itemIds()).toEqual(['3', '1']);
    await fireEvent.press(screen.getByRole('button', { name: 'All lifts' }));
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
  });

  it('filters by program', async () => {
    await renderHistory();
    const sheiko = findTemplate('sheiko-29')!;
    await fireEvent.press(await screen.findByRole('button', { name: sheiko.name }));
    expect(await itemIds()).toEqual(['4']);
    await fireEvent.press(screen.getByRole('button', { name: '5/3/1 (custom)' }));
    expect(await itemIds()).toEqual(['3', '2', '1']);
    await fireEvent.press(screen.getByRole('button', { name: 'All programs' }));
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
  });

  it('filters by period counted back from now', async () => {
    // 4 weeks before Dec 10 is Nov 12: only the Nov 16 and Nov 17 sessions
    await renderHistory({ now: new Date('2026-12-10T12:00:00.000Z') });
    await fireEvent.press(await screen.findByRole('button', { name: '4 wks' }));
    expect(await itemIds()).toEqual(['4', '3']);
    await fireEvent.press(screen.getByRole('button', { name: '3 mo' }));
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
  });

  it('combines the filters and says when nothing matches', async () => {
    await renderHistory({ now: new Date('2026-12-10T12:00:00.000Z') });
    await fireEvent.press(await screen.findByRole('button', { name: 'Squat' }));
    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    expect(screen.queryAllByTestId(/^history-item-/)).toHaveLength(0);
    expect(screen.getByText('No sessions match these filters.')).toBeOnTheScreen();
    expect(screen.getByText('0 sessions')).toBeOnTheScreen();
  });

  it('opens a session', async () => {
    const onOpen = jest.fn();
    await renderHistory({ onOpen });
    await fireEvent.press(await screen.findByRole('button', { name: 'Open the Squat session of Nov 10, 2026' }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it('shows an empty state without completed sessions and ignores drafts', async () => {
    await renderHistory({
      seedFn: async (repos, profileId) => {
        const periodization = await seedActivated(repos, profileId);
        await repos.performances.saveDraft({
          profileId,
          periodizationId: periodization.id,
          sessionKey: '1-w1',
          sessionNumber: 1,
          blockWeek: 1,
          lift: 'bench',
          templateId: 'cycle-531-custom',
          templateName: '5/3/1 (custom)',
          notes: '',
          sets: [loggedSet(0, 75, 5, null)],
        });
      },
    });
    expect(await screen.findByText(/No completed sessions yet/)).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^history-item-/)).toHaveLength(0);
  });

  it('does not change after the bench 1RM changes and a new periodization is activated (SPEC §13 step 6)', async () => {
    await renderHistory({
      seedFn: async (repos, profileId) => {
        const periodization = await seed(repos, profileId);
        await repos.referenceOneRms.record({ profileId, lift: 'bench', value: 105, origin: 'manual' });
        await repos.periodizations.create({
          profileId,
          startDate: '2026-11-30',
          config: { ...periodization.config, oneRms: { ...periodization.config.oneRms, bench: 105 } },
          sessions: [],
        });
      },
    });
    const item = within(await screen.findByTestId('history-item-1'));
    expect(item.getByText(kg('Prescribed: 3×5 @ 75.0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
    expect(await itemIds()).toEqual(['4', '3', '2', '1']);
  });
});

describe('HistoryScreen (pt-BR)', () => {
  it('formats numbers and dates and translates the texts', async () => {
    await renderHistory({ language: 'pt-BR' });
    expect(await screen.findByText('4 sessões')).toBeOnTheScreen();
    const item = within(await screen.findByTestId('history-item-1'));
    expect(item.getByText('9 de nov. de 2026 · Supino')).toBeOnTheScreen();
    expect(item.getByText('Sessão 1 · Semana 1')).toBeOnTheScreen();
    expect(item.getByText(kg('Prescrito: 3×5 @ 75,0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('Realizado: 2 × 75,0 kg × 5; 80,0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(item.getByText(kg('Tonelagem: 1.150,0 kg'))).toBeOnTheScreen();
    expect(item.getByText(kg('e1RM ≈ 95,6 kg (estimativa)'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('history-item-4')).getByText('Sem e1RM nesta sessão.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Todos os levantamentos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Todos os programas' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '4 sem' })).toBeOnTheScreen();
  });

  it('filters in Portuguese', async () => {
    await renderHistory({ language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Agachamento' }));
    expect(await itemIds()).toEqual(['2']);
    expect(screen.getByText('1 sessão')).toBeOnTheScreen();
  });
});
