import { fireEvent, screen } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import type { SetRecord } from '@/domain/performance';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';

import { TrainingScreen } from './training-screen';

const set = (index: number): SetRecord => ({
  prescribedIndex: index,
  prescribedWeightKg: 75,
  prescribedReps: 5,
  weightKg: 75,
  reps: 5,
  rir: null,
  rpe: null,
  notes: '',
});

const draft = (sessionKey: string, sessionNumber: number, blockWeek: number, lift: 'bench' | 'squat', sets: SetRecord[]) =>
  ({
    profileId: 1,
    periodizationId: 1,
    sessionKey,
    sessionNumber,
    blockWeek,
    lift,
    templateId: 'cycle-531-custom',
    templateName: '5/3/1 (custom)',
    notes: '',
    sets,
  }) as const;

const seedPlain = async (repos: Repositories, profileId: number) => {
  await seedActivated(repos, profileId);
};

describe('TrainingScreen (en)', () => {
  it('asks to activate a periodization when there is none', async () => {
    await renderInApp(<TrainingScreen onOpenSession={() => {}} />);
    expect(await screen.findByRole('header', { name: 'Training' })).toBeOnTheScreen();
    expect(
      screen.getByText('No activated periodization yet. Activate one in Periodization to start logging.'),
    ).toBeOnTheScreen();
  });

  it('offers the first session of the activated periodization as the next one', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<TrainingScreen onOpenSession={onOpenSession} />, { seed: seedPlain });
    expect(await screen.findByText('Next session')).toBeOnTheScreen();
    expect(screen.getByText('Session 1 · Week 1: Bench Press, 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText('No sessions in progress.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start session 1, week 1' }));
    expect(onOpenSession).toHaveBeenCalledWith('p1-1-w1');
  });

  it('lists sessions in progress with their logged sets and moves the next session on', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<TrainingScreen onOpenSession={onOpenSession} />, {
      seed: async (repos, profileId) => {
        await seedActivated(repos, profileId);
        await repos.performances.saveDraft(draft('1-w1', 1, 1, 'bench', [set(0)]));
        await repos.performances.saveDraft(draft('2-w1', 2, 1, 'squat', [set(0), set(1)]));
      },
    });
    expect(await screen.findByText('In progress')).toBeOnTheScreen();
    expect(screen.getByText('Session 1 · Week 1: Bench Press, 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText('1 set logged')).toBeOnTheScreen();
    expect(screen.getByText('Session 2 · Week 1: Squat, 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText('2 sets logged')).toBeOnTheScreen();
    // the next session skips the ones already started: week 2, session 1
    expect(screen.getByRole('button', { name: 'Start session 1, week 2' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue session 2, week 1' }));
    expect(onOpenSession).toHaveBeenCalledWith('p1-2-w1');
  });

  it('does not list completed sessions as in progress', async () => {
    await renderInApp(<TrainingScreen onOpenSession={() => {}} />, {
      seed: async (repos, profileId) => {
        const periodization = await seedActivated(repos, profileId);
        const saved = await repos.performances.saveDraft(draft('1-w1', 1, 1, 'bench', [set(0)]));
        const [first] = await repos.periodizations.listSessions(profileId, periodization.id);
        await repos.performances.complete(profileId, saved.id, {
          periodizationId: periodization.id,
          startDate: periodization.startDate,
          oneRmKg: 100,
          incrementKg: 2.5,
          roundingMode: 'nearest',
          session: first.session,
        });
      },
    });
    expect(await screen.findByText('No sessions in progress.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start session 2, week 1' })).toBeOnTheScreen();
  });

  it('says so when every session has been started', async () => {
    await renderInApp(<TrainingScreen onOpenSession={() => {}} />, {
      seed: async (repos, profileId) => {
        await seedActivated(repos, profileId, { lifts: ['bench'] });
        for (const week of [1, 2, 3]) {
          await repos.performances.saveDraft(draft(`1-w${week}`, 1, week, 'bench', [set(0)]));
        }
      },
    });
    expect(await screen.findByText('Every session of the active periodization has been started.')).toBeOnTheScreen();
    expect(screen.queryByText('Next session')).toBeNull();
  });
});

describe('TrainingScreen (pt-BR)', () => {
  it('renders in Portuguese', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<TrainingScreen onOpenSession={onOpenSession} />, {
      language: 'pt-BR',
      seed: async (repos, profileId) => {
        await seedActivated(repos, profileId);
        await repos.performances.saveDraft(draft('1-w1', 1, 1, 'bench', [set(0), set(1)]));
      },
    });
    expect(await screen.findByRole('header', { name: 'Treino' })).toBeOnTheScreen();
    expect(screen.getByText('Em andamento')).toBeOnTheScreen();
    expect(screen.getByText('Sessão 1 · Semana 1: Supino, 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText('2 séries registradas')).toBeOnTheScreen();
    expect(screen.getByText('Próxima sessão')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar a sessão 2, semana 1' }));
    expect(onOpenSession).toHaveBeenCalledWith('p1-2-w1');
  });

  it('asks to activate a periodization when there is none', async () => {
    await renderInApp(<TrainingScreen onOpenSession={() => {}} />, { language: 'pt-BR' });
    expect(
      await screen.findByText('Nenhuma periodização ativada ainda. Ative uma em Periodização para começar a registrar.'),
    ).toBeOnTheScreen();
  });
});
