import { csvFileName, logbookCsv } from './logbook-csv';
import type { Workout } from './workout';

function workout(over: Partial<Workout>): Workout {
  return {
    id: 1,
    profileId: 1,
    planId: null,
    planWorkoutId: null,
    name: 'Free workout',
    status: 'completed',
    phase: 'load',
    cycleNumber: null,
    cycleWeek: null,
    startedAt: '2026-11-01T09:00:00.000Z',
    completedAt: '2026-11-01T10:00:00.000Z',
    notes: '',
    exercises: [],
    ...over,
  };
}

const lookup = {
  exerciseName: (id: string) => (id === 'bench-press' ? 'Bench Press' : id === 'custom-1' ? 'Curl, "strict"' : id),
  planName: (id: number) => (id === 7 ? 'Upper/Lower' : null),
};

describe('logbookCsv', () => {
  it('emits only the header (with CRLF) for no workouts', () => {
    expect(logbookCsv([], lookup)).toBe(
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent\r\n',
    );
  });

  it('writes exact rows, oldest first, skipping undone sets and in-progress workouts', () => {
    const later = workout({
      id: 2,
      planId: 7,
      name: 'Push, heavy',
      phase: 'deload',
      completedAt: '2026-11-03T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench-press',
          planExerciseId: null,
          target: null,
          note: '',
          sets: [
            { kind: 'warmup', weightKg: 20, reps: 10, rir: null, done: true },
            { kind: 'working', weightKg: 42.5, reps: 8, rir: 2, done: true },
            { kind: 'working', weightKg: 42.5, reps: null, rir: null, done: false },
            { kind: 'working', weightKg: 40, reps: 8, rir: 0, done: true },
          ],
        },
      ],
    });
    const earlier = workout({
      id: 1,
      planId: 99,
      name: 'The "A" day',
      exercises: [
        {
          exerciseId: 'custom-1',
          planExerciseId: null,
          target: null,
          note: '',
          sets: [{ kind: 'working', weightKg: 12.0, reps: 12, rir: null, done: true }],
        },
      ],
    });
    const running = workout({
      id: 3,
      status: 'in_progress',
      completedAt: null,
      exercises: [
        {
          exerciseId: 'bench-press',
          planExerciseId: null,
          target: null,
          note: '',
          sets: [{ kind: 'working', weightKg: 50, reps: 5, rir: 1, done: true }],
        },
      ],
    });

    expect(logbookCsv([later, running, earlier], lookup)).toBe(
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent\r\n' +
        '2026-11-01T10:00:00.000Z,"The ""A"" day",,load,custom-1,"Curl, ""strict""",1,working,12,12,,,,\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,1,warmup,20,10,,,,\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,2,working,42.5,8,2,,,\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,4,working,40,8,0,,,\r\n',
    );
  });

  it('quotes fields containing line breaks and leaves empty weight/reps empty', () => {
    const w = workout({
      name: 'a\nb',
      exercises: [
        {
          exerciseId: 'x',
          planExerciseId: null,
          target: null,
          note: '',
          sets: [{ kind: 'working', weightKg: null, reps: null, rir: null, done: true }],
        },
      ],
    });
    expect(logbookCsv([w], lookup).split('\r\n')[1]).toBe(
      '2026-11-01T10:00:00.000Z,"a\nb",,load,x,x,1,working,,,,,,',
    );
  });
});

describe('logbookCsv prescriptions and half-point RIR (SPEC-v4 §11.2)', () => {
  const prescribed = (sets: { reps: number; percent: number | null; kg: number | null }[]) => ({
    basisExerciseId: 'bench-press',
    basisKg: 100,
    sets: sets.map((s) => ({
      reps: s.reps,
      amrap: false,
      unverified: false,
      percent: s.percent,
      addKg: 0,
      exactKg: s.kg,
      kg: s.kg,
    })),
    source: { kind: 'scheme' as const, schemeWeek: 1 },
    phase: 'load' as const,
    warnings: [],
  });

  const row = (csv: string, index: number) => csv.split('\r\n')[index];

  it('appends the three columns at the end of the header, existing columns unchanged', () => {
    expect(logbookCsv([], lookup).trimEnd()).toBe(
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent',
    );
  });

  it('maps each working set to the prescribed set of the same order among working sets', () => {
    const w = workout({
      exercises: [
        {
          exerciseId: 'bench-press',
          planExerciseId: 'p1:0',
          target: null,
          note: '',
          prescription: prescribed([
            { reps: 5, percent: 75, kg: 75 },
            { reps: 3, percent: 87.5, kg: 87.5 },
            { reps: 8, percent: null, kg: null },
          ]),
          sets: [
            { kind: 'warmup', weightKg: 40, reps: 5, rir: null, done: true },
            { kind: 'working', weightKg: 75, reps: 5, rir: 2, done: true },
            { kind: 'working', weightKg: 87.5, reps: 4, rir: 0.5, done: true },
            { kind: 'drop', weightKg: 70, reps: 6, rir: null, done: true },
            { kind: 'working', weightKg: 60, reps: 9, rir: 1.5, done: true },
            { kind: 'working', weightKg: 60, reps: 9, rir: null, done: true },
          ],
        },
      ],
    });
    const csv = logbookCsv([w], lookup);
    const tail = (i: number) => row(csv, i).split(',').slice(6);
    expect(tail(1)).toEqual(['1', 'warmup', '40', '5', '', '', '', '']);
    expect(tail(2)).toEqual(['2', 'working', '75', '5', '2', '75', '5', '75']);
    expect(tail(3)).toEqual(['3', 'working', '87.5', '4', '0.5', '87.5', '3', '87.5']);
    expect(tail(4)).toEqual(['4', 'drop', '70', '6', '', '', '', '']);
    // The third working set has a prescribed set without a load or percent: reps only.
    expect(tail(5)).toEqual(['5', 'working', '60', '9', '1.5', '', '8', '']);
    // A fourth working set has no prescribed counterpart.
    expect(tail(6)).toEqual(['6', 'working', '60', '9', '', '', '', '']);
  });

  it('counts an undone working set when pairing, so later sets keep their prescribed set', () => {
    const w = workout({
      exercises: [
        {
          exerciseId: 'bench-press',
          planExerciseId: null,
          target: null,
          note: '',
          prescription: prescribed([
            { reps: 5, percent: 70, kg: 70 },
            { reps: 5, percent: 80, kg: 80 },
          ]),
          sets: [
            { kind: 'working', weightKg: 70, reps: null, rir: null, done: false },
            { kind: 'working', weightKg: 80, reps: 5, rir: null, done: true },
          ],
        },
      ],
    });
    expect(row(logbookCsv([w], lookup), 1)).toBe(
      '2026-11-01T10:00:00.000Z,Free workout,,load,bench-press,Bench Press,2,working,80,5,,80,5,80',
    );
  });

  it('prints fractional prescribed values plainly and leaves other exercises of the workout empty', () => {
    const w = workout({
      exercises: [
        {
          exerciseId: 'bench-press',
          planExerciseId: null,
          target: null,
          note: '',
          prescription: prescribed([{ reps: 1, percent: 102.5, kg: 107.5 }]),
          sets: [{ kind: 'working', weightKg: 107.5, reps: 1, rir: 1.5, done: true }],
        },
        {
          exerciseId: 'custom-1',
          planExerciseId: null,
          target: null,
          note: '',
          prescription: null,
          sets: [{ kind: 'working', weightKg: 12, reps: 12, rir: 2.5, done: true }],
        },
      ],
    });
    const csv = logbookCsv([w], lookup);
    expect(row(csv, 1).endsWith(',1,working,107.5,1,1.5,107.5,1,102.5')).toBe(true);
    expect(row(csv, 2).endsWith(',1,working,12,12,2.5,,,')).toBe(true);
  });
});

describe('csvFileName', () => {
  it('formats the local date', () => {
    expect(csvFileName(new Date(2026, 10, 20))).toBe('cycle-logbook-20261120.csv');
    expect(csvFileName(new Date(2026, 0, 5))).toBe('cycle-logbook-20260105.csv');
  });
});
