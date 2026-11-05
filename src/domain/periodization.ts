/**
 * Periodization generator (SPEC §4): turns the athlete's session slots, the program templates,
 * the reference 1RMs, the rounding settings and the template parameters into a three-week
 * periodization with exact and rounded loads, volume and warning codes.
 *
 * Pure and synchronous: no React, Expo, I/O, clock or locale. Loads are computed on integer
 * micrograms, so `1RM × percent (+ addKg)` has no binary floating-point error.
 */
import { BLOCK_WEEKS, getBlock } from '@/programs/blocks';
import { resolveParamValues, resolveTemplate, type ParamValues } from '@/programs/params';
import type {
  AccessoryItem,
  LocalizedText,
  MainItem,
  ProgramTemplate,
  SetPrescription,
  Verification,
} from '@/programs/schema';

import type { Lift } from './lifts';
import { effectiveIncrement, roundLoad, type RoundingMode } from './rounding';

/** One session of the week as configured by the athlete (SPEC §0 "Session slot"). */
export type SessionSlotConfig = {
  id: number;
  lift: Lift;
  templateId: string;
  /** 1-based day inside the program week. */
  programDay: number;
  /** 1-based program week the block starts at. */
  startWeek: number;
};

export type RoundingConfig = {
  incrementKg: number;
  mode: RoundingMode;
  liftIncrementsKg: Partial<Record<Lift, number>>;
};

/** Reference 1RMs in kg; a lift without a value has none. */
export type OneRmMap = Partial<Record<Lift, number>>;

/** Athlete-chosen parameter overrides by template id (defaults apply otherwise). */
export type TemplateParams = Record<string, ParamValues>;

/** Why a set has (or has not) a load: `calculated`, no confirmed data, or no 1RM for its lift. */
export type LoadStatus = 'calculated' | 'unverified' | 'missingOneRm';

export type GeneratedSet = {
  /** Number of identical sets (`repeat`). */
  sets: number;
  reps: number;
  /** Fraction of the 1RM, or null when the original gives none. */
  percent: number | null;
  /** Absolute increment added to `1RM × percent`, in kg. */
  addKg: number | null;
  amrap: boolean;
  exactKg: number | null;
  roundedKg: number | null;
  load: LoadStatus;
  note?: LocalizedText;
};

export type GeneratedMainItem = { kind: 'main'; lift: Lift; sets: GeneratedSet[]; note?: LocalizedText };

export type GeneratedItem = GeneratedMainItem | AccessoryItem;

export type Volume = { tonnageKg: number; totalReps: number };

export type VolumeByLift = Partial<Record<Lift, Volume>>;

export type SessionWarning = { code: 'missingOneRm'; lift: Lift } | { code: 'unverifiedData' };

export type GeneratedSession = {
  /** Stable key: `<slotId>-w<blockWeek>`. */
  key: string;
  slotId: number;
  /** 1-based position of the slot. */
  sessionNumber: number;
  blockWeek: number;
  programWeek: number;
  lift: Lift;
  templateId: string;
  templateName: string;
  templateVersion: string;
  verification: Verification;
  programDay: number;
  /** Days per week the program prescribes (to tell single-day programs apart). */
  daysPerWeek: number;
  dayLabel?: LocalizedText;
  phase?: LocalizedText;
  items: GeneratedItem[];
  /** Tonnage (Σ reps × rounded load of the sets with a load) and every prescribed rep. */
  volume: Volume;
  volumeByLift: VolumeByLift;
  warnings: SessionWarning[];
};

export type SlotIssue = 'unknownTemplate' | 'liftNotAllowed' | 'invalidProgramDay' | 'invalidStartWeek';

export type PeriodizationWarning =
  | { code: 'invalidSlot'; slotId: number; sessionNumber: number; reason: SlotIssue }
  | { code: 'partialBlock'; slotId: number; sessionNumber: number; weeks: number }
  | { code: 'missingOneRm'; lift: Lift }
  | { code: 'incompleteFrequency'; templateId: string; lift: Lift; configured: number; prescribed: number };

export type PeriodizationWeek = {
  blockWeek: number;
  sessions: GeneratedSession[];
  volume: Volume;
  volumeByLift: VolumeByLift;
};

export type Periodization = {
  weeks: PeriodizationWeek[];
  volume: Volume;
  volumeByLift: VolumeByLift;
  warnings: PeriodizationWarning[];
};

const MICRO = 1_000_000;
const toMicro = (value: number) => Math.round(value * MICRO);

/** Volume accumulated in integer micrograms, converted to kg only at the end. */
type VolumeAcc = { tonnageUg: number; totalReps: number };

const emptyAcc = (): VolumeAcc => ({ tonnageUg: 0, totalReps: 0 });

function addAcc(target: VolumeAcc, source: VolumeAcc) {
  target.tonnageUg += source.tonnageUg;
  target.totalReps += source.totalReps;
}

const toVolume = (acc: VolumeAcc): Volume => ({ tonnageKg: acc.tonnageUg / MICRO, totalReps: acc.totalReps });

function addByLift(target: Partial<Record<Lift, VolumeAcc>>, source: Partial<Record<Lift, VolumeAcc>>) {
  for (const [lift, acc] of Object.entries(source) as [Lift, VolumeAcc][]) {
    addAcc((target[lift] ??= emptyAcc()), acc);
  }
}

function toVolumeByLift(source: Partial<Record<Lift, VolumeAcc>>): VolumeByLift {
  const result: VolumeByLift = {};
  for (const [lift, acc] of Object.entries(source) as [Lift, VolumeAcc][]) result[lift] = toVolume(acc);
  return result;
}

/** Why a slot cannot be generated, or null when it fits its program. */
export function validateSlot(slot: Omit<SessionSlotConfig, 'id'>, templates: readonly ProgramTemplate[]): SlotIssue | null {
  return slotIssue(slot, templates.find((template) => template.id === slot.templateId));
}

function slotIssue(slot: Omit<SessionSlotConfig, 'id'>, template: ProgramTemplate | undefined): SlotIssue | null {
  if (!template) return 'unknownTemplate';
  if (!template.allowedLifts.includes(slot.lift)) return 'liftNotAllowed';
  if (!Number.isInteger(slot.programDay) || slot.programDay < 1 || slot.programDay > template.daysPerWeek) {
    return 'invalidProgramDay';
  }
  if (!Number.isInteger(slot.startWeek) || slot.startWeek < 1 || slot.startWeek > template.durationWeeks) {
    return 'invalidStartWeek';
  }
  return null;
}

type Context = { oneRms: OneRmMap; rounding: RoundingConfig; values: ParamValues };

function generateSet(set: SetPrescription, lift: Lift, ctx: Context): GeneratedSet {
  const addKg = set.addKg ? (ctx.values[set.addKg.param] ?? null) : null;
  const base = {
    sets: set.repeat ?? 1,
    reps: set.reps,
    percent: set.percent ?? null,
    addKg,
    amrap: set.amrap === true,
    ...(set.note ? { note: set.note } : {}),
  };
  const oneRm = ctx.oneRms[lift];
  if (set.unverified || set.percent === undefined || (set.addKg && addKg === null)) {
    return { ...base, exactKg: null, roundedKg: null, load: 'unverified' };
  }
  if (oneRm === undefined) return { ...base, exactKg: null, roundedKg: null, load: 'missingOneRm' };
  const exactUg = Math.round((toMicro(oneRm) * toMicro(set.percent)) / MICRO) + toMicro(addKg ?? 0);
  const exactKg = exactUg / MICRO;
  const increment = effectiveIncrement(lift, ctx.rounding.incrementKg, ctx.rounding.liftIncrementsKg);
  return { ...base, exactKg, roundedKg: roundLoad(exactKg, increment, ctx.rounding.mode), load: 'calculated' };
}

function generateMain(item: MainItem, slotLift: Lift, ctx: Context): GeneratedMainItem {
  const lift = item.lift === 'selected' ? slotLift : item.lift;
  return {
    kind: 'main',
    lift,
    sets: item.sets.map((set) => generateSet(set, lift, ctx)),
    ...(item.note ? { note: item.note } : {}),
  };
}

/**
 * Generates the three-week periodization (SPEC §4.2). Session numbers follow the slot order.
 * Invalid slots produce an `invalidSlot` warning and no sessions; sets without a confirmed
 * percentage or without a 1RM for their lift produce no load.
 */
export function generatePeriodization(
  slots: readonly SessionSlotConfig[],
  templates: readonly ProgramTemplate[],
  oneRms: OneRmMap,
  rounding: RoundingConfig,
  params: TemplateParams,
): Periodization {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const resolved = new Map<string, { template: ProgramTemplate; values: ParamValues }>();
  const resolve = (template: ProgramTemplate) => {
    let entry = resolved.get(template.id);
    if (!entry) {
      const values = resolveParamValues(template, params[template.id] ?? {});
      entry = { template: resolveTemplate(template, values), values };
      resolved.set(template.id, entry);
    }
    return entry;
  };

  const weeks = Array.from({ length: BLOCK_WEEKS }, (_, i) => ({
    blockWeek: i + 1,
    sessions: [] as GeneratedSession[],
    acc: emptyAcc(),
    byLift: {} as Partial<Record<Lift, VolumeAcc>>,
  }));
  const warnings: PeriodizationWarning[] = [];
  const missingLifts = new Set<Lift>();
  const daysByTemplateLift = new Map<string, { templateId: string; lift: Lift; days: Set<number>; prescribed: number }>();

  slots.forEach((slot, index) => {
    const sessionNumber = index + 1;
    const original = byId.get(slot.templateId);
    const issue = slotIssue(slot, original);
    if (issue || !original) {
      warnings.push({ code: 'invalidSlot', slotId: slot.id, sessionNumber, reason: issue ?? 'unknownTemplate' });
      return;
    }
    const groupKey = `${original.id}|${slot.lift}`;
    const group = daysByTemplateLift.get(groupKey) ?? {
      templateId: original.id,
      lift: slot.lift,
      days: new Set<number>(),
      prescribed: original.daysPerWeek,
    };
    group.days.add(slot.programDay);
    daysByTemplateLift.set(groupKey, group);

    const { template, values } = resolve(original);
    const ctx: Context = { oneRms, rounding, values };
    const block = getBlock(template, slot.startWeek);
    if (block.weeks.length < BLOCK_WEEKS) {
      warnings.push({ code: 'partialBlock', slotId: slot.id, sessionNumber, weeks: block.weeks.length });
    }

    for (const { blockWeek, week } of block.weeks) {
      const day = week.days[slot.programDay - 1];
      const items: GeneratedItem[] = day.items.map((item) =>
        item.kind === 'main' ? generateMain(item, slot.lift, ctx) : item,
      );
      const acc = emptyAcc();
      const byLift: Partial<Record<Lift, VolumeAcc>> = {};
      const sessionWarnings: SessionWarning[] = [];
      let unverified = false;
      for (const item of items) {
        if (item.kind !== 'main') continue;
        const liftAcc = (byLift[item.lift] ??= emptyAcc());
        for (const set of item.sets) {
          const reps = set.sets * set.reps;
          const tonnageUg = set.roundedKg === null ? 0 : reps * toMicro(set.roundedKg);
          addAcc(liftAcc, { tonnageUg, totalReps: reps });
          if (set.load === 'unverified') unverified = true;
          if (set.load === 'missingOneRm' && !sessionWarnings.some((w) => w.code === 'missingOneRm' && w.lift === item.lift)) {
            sessionWarnings.push({ code: 'missingOneRm', lift: item.lift });
            missingLifts.add(item.lift);
          }
        }
      }
      for (const liftAcc of Object.values(byLift)) addAcc(acc, liftAcc);
      if (unverified) sessionWarnings.push({ code: 'unverifiedData' });

      const target = weeks[blockWeek - 1];
      addAcc(target.acc, acc);
      addByLift(target.byLift, byLift);
      target.sessions.push({
        key: `${slot.id}-w${blockWeek}`,
        slotId: slot.id,
        sessionNumber,
        blockWeek,
        programWeek: week.week,
        lift: slot.lift,
        templateId: template.id,
        templateName: template.name,
        templateVersion: template.version,
        verification: template.verification,
        programDay: slot.programDay,
        daysPerWeek: template.daysPerWeek,
        ...(day.label ? { dayLabel: day.label } : {}),
        ...(week.phase ? { phase: week.phase } : {}),
        items,
        volume: toVolume(acc),
        volumeByLift: toVolumeByLift(byLift),
        warnings: sessionWarnings,
      });
    }
  });

  for (const lift of missingLifts) warnings.push({ code: 'missingOneRm', lift });
  for (const group of daysByTemplateLift.values()) {
    if (group.days.size < group.prescribed) {
      warnings.push({
        code: 'incompleteFrequency',
        templateId: group.templateId,
        lift: group.lift,
        configured: group.days.size,
        prescribed: group.prescribed,
      });
    }
  }

  const total = emptyAcc();
  const totalByLift: Partial<Record<Lift, VolumeAcc>> = {};
  for (const week of weeks) {
    addAcc(total, week.acc);
    addByLift(totalByLift, week.byLift);
  }
  return {
    weeks: weeks.map((week) => ({
      blockWeek: week.blockWeek,
      sessions: week.sessions,
      volume: toVolume(week.acc),
      volumeByLift: toVolumeByLift(week.byLift),
    })),
    volume: toVolume(total),
    volumeByLift: toVolumeByLift(totalByLift),
    warnings,
  };
}

export type ActivationIssue = 'noSessions' | 'missingOneRm' | 'invalidSlot';

/**
 * What prevents activating a periodization (SPEC §2: no sessions are generated for a lift
 * without a 1RM). Frequency, partial-block and unverified-data warnings are informational.
 */
export function activationIssues(periodization: Periodization): ActivationIssue[] {
  const issues: ActivationIssue[] = [];
  if (periodization.weeks.every((week) => week.sessions.length === 0)) issues.push('noSessions');
  if (periodization.warnings.some((w) => w.code === 'missingOneRm')) issues.push('missingOneRm');
  if (periodization.warnings.some((w) => w.code === 'invalidSlot')) issues.push('invalidSlot');
  return issues;
}
