/**
 * Test helper: seeds the repositories with 1RMs, the given session slots and an activated
 * periodization (as `activatePeriodization` stores it), so UI tests can start from a state with
 * a snapshot to log against. Returns the stored periodization.
 */
import type { Repositories, StoredPeriodization } from '@/data/repositories';
import type { Lift } from '@/domain/lifts';
import { generatePeriodization } from '@/domain/periodization';
import { listTemplates } from '@/programs/registry';

export async function seedActivated(
  repos: Repositories,
  profileId: number,
  {
    oneRms = { bench: 100, squat: 140, deadlift: 180 },
    lifts = ['bench', 'squat'],
    startDate = '2026-11-09',
  }: { oneRms?: Partial<Record<Lift, number>>; lifts?: Lift[]; startDate?: string } = {},
): Promise<StoredPeriodization> {
  for (const [lift, value] of Object.entries(oneRms)) {
    await repos.referenceOneRms.record({ profileId, lift: lift as Lift, value, origin: 'onboarding' });
  }
  let slots = await repos.sessionSlots.list(profileId);
  for (const lift of lifts) {
    slots = await repos.sessionSlots.add(profileId, {
      lift,
      templateId: 'cycle-531-custom',
      programDay: 1,
      startWeek: 1,
    });
  }
  const config = {
    slots: slots.map(({ id, lift, templateId, programDay, startWeek }) => ({ id, lift, templateId, programDay, startWeek })),
    oneRms,
    rounding: { incrementKg: 2.5, mode: 'nearest' as const, liftIncrementsKg: {} },
    params: {},
  };
  const periodization = generatePeriodization(config.slots, listTemplates(), config.oneRms, config.rounding, config.params);
  return repos.periodizations.create({
    profileId,
    startDate,
    config,
    sessions: periodization.weeks.flatMap((week) => week.sessions),
  });
}
