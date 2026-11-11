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
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir\r\n',
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
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir\r\n' +
        '2026-11-01T10:00:00.000Z,"The ""A"" day",,load,custom-1,"Curl, ""strict""",1,working,12,12,\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,1,warmup,20,10,\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,2,working,42.5,8,2\r\n' +
        '2026-11-03T10:00:00.000Z,"Push, heavy",Upper/Lower,deload,bench-press,Bench Press,4,working,40,8,0\r\n',
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
      '2026-11-01T10:00:00.000Z,"a\nb",,load,x,x,1,working,,,',
    );
  });
});

describe('csvFileName', () => {
  it('formats the local date', () => {
    expect(csvFileName(new Date(2026, 10, 20))).toBe('cycle-logbook-20261120.csv');
    expect(csvFileName(new Date(2026, 0, 5))).toBe('cycle-logbook-20260105.csv');
  });
});
