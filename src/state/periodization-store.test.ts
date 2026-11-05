import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { GeneratedMainItem, GeneratedSession, Periodization } from '@/domain/periodization';

import {
  createAppStore,
  InvalidSessionSlotError,
  InvalidStartDateError,
  PeriodizationNotReadyError,
} from './app-store';
import { selectCurrentOneRms, selectPeriodization } from './periodization-selectors';

const T = 'cycle-531-custom';

async function readyStore(oneRms: { bench?: number; squat?: number; deadlift?: number } = { bench: 100, squat: 140, deadlift: 180 }) {
  const repos = createMemoryRepositories({ clock: () => new Date('2026-11-05T10:00:00.000Z') });
  const store = createAppStore(repos);
  await store.getState().init('Default');
  await store.getState().saveReferenceOneRms(oneRms, 'manual');
  return { repos, store };
}

const firstSet = (session: GeneratedSession) => (session.items[0] as GeneratedMainItem).sets[0];

/** `[sessionNumber, lift, roundedKg]` of each session in block week `week`. */
const summary = (p: Periodization, week = 1) =>
  p.weeks[week - 1].sessions.map((s) => [s.sessionNumber, s.lift, firstSet(s).roundedKg]);

describe('app store: session slots', () => {
  it('starts without slots and adds a slot with the first program for the lift', async () => {
    const { repos, store } = await readyStore();
    expect(store.getState().sessionSlots).toEqual([]);
    await store.getState().addSessionSlot('squat');
    expect(store.getState().sessionSlots).toEqual([
      { id: 1, profileId: 1, lift: 'squat', templateId: T, programDay: 1, startWeek: 1 },
    ]);
    expect(await repos.sessionSlots.list(1)).toEqual(store.getState().sessionSlots);
  });

  it('generates the SPEC §13 table: bench 100 → 75.0 / 85.0 / 95.0 kg', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    const p = selectPeriodization(store.getState());
    expect([1, 2, 3].map((week) => summary(p, week))).toEqual([
      [[1, 'bench', 75]],
      [[1, 'bench', 85]],
      [[1, 'bench', 95]],
    ]);
  });

  it('updates a slot and rejects one that does not fit its program', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().updateSessionSlot(1, { lift: 'deadlift', templateId: T, programDay: 1, startWeek: 1 });
    // 180 × 0.75 = 135
    expect(summary(selectPeriodization(store.getState()))).toEqual([[1, 'deadlift', 135]]);

    await expect(
      store.getState().updateSessionSlot(1, { lift: 'bench', templateId: T, programDay: 2, startWeek: 1 }),
    ).rejects.toEqual(new InvalidSessionSlotError('invalidProgramDay'));
    await expect(
      store.getState().updateSessionSlot(1, { lift: 'bench', templateId: 'nope', programDay: 1, startWeek: 1 }),
    ).rejects.toThrow(InvalidSessionSlotError);
    expect(store.getState().sessionSlots[0].lift).toBe('deadlift');
  });

  it('duplicates a slot right below it, removes and reorders slots', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().addSessionSlot('squat');
    await store.getState().duplicateSessionSlot(1);
    expect(store.getState().sessionSlots.map((s) => [s.id, s.lift])).toEqual([
      [1, 'bench'],
      [3, 'bench'],
      [2, 'squat'],
    ]);

    await store.getState().moveSessionSlot(2, -1);
    // squat moves up: it is now session 2, and 105 = 140 × 0.75
    expect(summary(selectPeriodization(store.getState()))).toEqual([
      [1, 'bench', 75],
      [2, 'squat', 105],
      [3, 'bench', 75],
    ]);
    await store.getState().moveSessionSlot(1, -1); // already first: unchanged
    await store.getState().moveSessionSlot(3, 1); // already last: unchanged
    expect(store.getState().sessionSlots.map((s) => s.id)).toEqual([1, 2, 3]);

    await store.getState().removeSessionSlot(2);
    expect(store.getState().sessionSlots.map((s) => s.id)).toEqual([1, 3]);
  });

  it('adds the missing days of a slot’s program right below it (SPEC §1.1)', async () => {
    const { repos, store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().addSessionSlot('bench');
    await store.getState().updateSessionSlot(2, { lift: 'bench', templateId: 'smolov-jr', programDay: 3, startWeek: 1 });
    await store.getState().addSessionSlot('squat');
    await store.getState().addMissingProgramDays(2);
    expect(store.getState().sessionSlots.map((s) => [s.id, s.lift, s.templateId, s.programDay])).toEqual([
      [1, 'bench', T, 1],
      [2, 'bench', 'smolov-jr', 3],
      [4, 'bench', 'smolov-jr', 1],
      [5, 'bench', 'smolov-jr', 2],
      [6, 'bench', 'smolov-jr', 4],
      [3, 'squat', T, 1],
    ]);
    expect(await repos.sessionSlots.list(1)).toEqual(store.getState().sessionSlots);
    // Every day is now covered: no incomplete-frequency warning, and nothing more to add.
    expect(selectPeriodization(store.getState()).warnings).toEqual([]);
    await store.getState().addMissingProgramDays(2);
    expect(store.getState().sessionSlots).toHaveLength(6);
  });

  it('copies the start week to the added days and rejects an unknown slot', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('squat');
    await store.getState().updateSessionSlot(1, { lift: 'squat', templateId: 'smolov-jr', programDay: 1, startWeek: 1 });
    await store.getState().addMissingProgramDays(1);
    expect(store.getState().sessionSlots.map((s) => [s.programDay, s.startWeek])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
    await expect(store.getState().addMissingProgramDays(99)).rejects.toThrow();
  });

  it('keeps slots per profile and across restarts', async () => {
    const { repos, store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().createProfile('Bruno');
    expect(store.getState().sessionSlots).toEqual([]);
    await store.getState().switchProfile(1);
    expect(store.getState().sessionSlots).toHaveLength(1);

    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(restarted.getState().sessionSlots).toHaveLength(1);
  });

  it('rejects slot actions before init', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().addSessionSlot('bench')).rejects.toThrow('App store is not ready');
  });
});

describe('app store: reactive periodization (SPEC §12.5)', () => {
  it('memoizes the periodization until an input changes', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    const first = selectPeriodization(store.getState());
    expect(selectPeriodization(store.getState())).toBe(first);
    await store.getState().setLanguage('pt-BR'); // unrelated change
    expect(selectPeriodization(store.getState())).toBe(first);
  });

  it('recalculates when the 1RM changes (bench 105: 78.75 → 77.5)', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    const before = selectPeriodization(store.getState());
    await store.getState().saveReferenceOneRms({ bench: 105 }, 'manual');
    const after = selectPeriodization(store.getState());
    expect(after).not.toBe(before);
    // 105 × 0.75 = 78.75, a tie between 77.5 and 80 → down
    expect(firstSet(after.weeks[0].sessions[0])).toMatchObject({ exactKg: 78.75, roundedKg: 77.5 });
    expect(selectCurrentOneRms(store.getState())).toEqual({ bench: 105, squat: 140, deadlift: 180 });
  });

  it('recalculates when the increment, mode or a per-lift override changes', async () => {
    const { store } = await readyStore({ bench: 105 });
    await store.getState().addSessionSlot('bench');
    await store.getState().setIncrementKg(1);
    // 78.75 with 1 kg: 78.75 − 78 = 0.75 > 0.5 → 79
    expect(firstSet(selectPeriodization(store.getState()).weeks[0].sessions[0]).roundedKg).toBe(79);
    await store.getState().setRoundingMode('down');
    expect(firstSet(selectPeriodization(store.getState()).weeks[0].sessions[0]).roundedKg).toBe(78);
    await store.getState().setLiftIncrementKg('bench', 2.5);
    // down to a multiple of 2.5 → 77.5
    expect(firstSet(selectPeriodization(store.getState()).weeks[0].sessions[0]).roundedKg).toBe(77.5);
  });

  it('recalculates when a program parameter changes (week 1 at 80%: 100 × 0.8 = 80)', async () => {
    const { store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().setProgramParam(T, 'week1Percent', 0.8);
    expect(firstSet(selectPeriodization(store.getState()).weeks[0].sessions[0])).toMatchObject({
      percent: 0.8,
      roundedKg: 80,
    });
  });
});

describe('app store: activating a periodization (SPEC §4.4)', () => {
  it('saves a snapshot with the start date and keeps it after the 1RM changes', async () => {
    const { repos, store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().addSessionSlot('squat');
    await store.getState().activatePeriodization('2026-11-09');

    const active = store.getState().activePeriodization;
    expect(active).toMatchObject({
      id: 1,
      startDate: '2026-11-09',
      createdAt: '2026-11-05T10:00:00.000Z',
      config: {
        slots: [
          { id: 1, lift: 'bench', templateId: T, programDay: 1, startWeek: 1 },
          { id: 2, lift: 'squat', templateId: T, programDay: 1, startWeek: 1 },
        ],
        oneRms: { bench: 100, squat: 140, deadlift: 180 },
        rounding: { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} },
        params: {},
      },
    });
    const sessions = await repos.periodizations.listSessions(1, 1);
    expect(sessions.map((s) => [s.session.blockWeek, s.session.sessionNumber, firstSet(s.session).roundedKg])).toEqual([
      [1, 1, 75],
      [1, 2, 105],
      [2, 1, 85],
      [2, 2, 120],
      [3, 1, 95],
      [3, 2, 132.5],
    ]);

    await store.getState().saveReferenceOneRms({ bench: 110 }, 'manual');
    const stored = await repos.periodizations.listSessions(1, 1);
    expect(firstSet(stored[0].session).roundedKg).toBe(75);

    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(restarted.getState().activePeriodization).toEqual(active);
  });

  it('activating again creates a new periodization and keeps the previous one', async () => {
    const { repos, store } = await readyStore();
    await store.getState().addSessionSlot('bench');
    await store.getState().activatePeriodization('2026-11-09');
    await store.getState().activatePeriodization('2026-11-30');
    expect(store.getState().activePeriodization?.id).toBe(2);
    expect((await repos.periodizations.list(1)).map((p) => p.startDate)).toEqual(['2026-11-30', '2026-11-09']);
  });

  it('refuses to activate without sessions, with a missing 1RM or an invalid date', async () => {
    const { repos, store } = await readyStore({ bench: 100 });
    await expect(store.getState().activatePeriodization('2026-11-09')).rejects.toEqual(
      new PeriodizationNotReadyError(['noSessions']),
    );
    await store.getState().addSessionSlot('squat');
    await expect(store.getState().activatePeriodization('2026-11-09')).rejects.toEqual(
      new PeriodizationNotReadyError(['missingOneRm']),
    );
    await store.getState().updateSessionSlot(1, { lift: 'bench', templateId: T, programDay: 1, startWeek: 1 });
    await expect(store.getState().activatePeriodization('9/11/2026')).rejects.toEqual(
      new InvalidStartDateError('invalidDate'),
    );
    expect(await repos.periodizations.list(1)).toEqual([]);
    expect(store.getState().activePeriodization).toBeNull();
  });
});
