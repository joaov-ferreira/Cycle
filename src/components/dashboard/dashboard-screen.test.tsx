import { fireEvent, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';
import { loggedSet, seedCompleted } from '@/test-utils/seed-history';

import { DashboardScreen } from './dashboard-screen';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function setWidth(width: number) {
  (useWindowDimensions as jest.Mock).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

// A Tuesday of block week 1 (the block starts on Monday 2026-11-09).
const NOW = new Date('2026-11-10T12:00:00');

const noop = () => {};

/** A block starting 2026-11-09 with bench (session 1) completed on the 9th; squat is next. */
async function seedBlock(repos: Repositories, profileId: number) {
  let clock = '2026-11-09T12:00:00.000Z';
  const periodization = await seedActivated(repos, profileId, { oneRms: { bench: 100, squat: 140 } });
  await seedCompleted(repos, profileId, periodization, '1-w1', [loggedSet(0, 80, 5, 2)], {
    at: clock,
    setNow: (iso) => (clock = iso),
  });
}

const seedOneRmsOnly = async (repos: Repositories, profileId: number) => {
  await repos.referenceOneRms.record({ profileId, lift: 'bench', value: 100, origin: 'onboarding' });
};

beforeEach(() => setWidth(375));

describe('DashboardScreen (en)', () => {
  it('shows the current week, the next session, the latest e1RM and shortcuts', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={onOpenSession} onNavigate={noop} />, {
      repos: createMemoryRepositories({ clock: () => new Date('2026-11-09T12:00:00.000Z') }),
      seed: seedBlock,
    });
    expect(await screen.findByRole('header', { name: 'Dashboard' })).toBeOnTheScreen();
    expect(screen.getByText('Week 1 of 3')).toBeOnTheScreen();
    expect(screen.getByText('Start date: Nov 9, 2026')).toBeOnTheScreen();
    // bench was completed, so the next pending session is squat (session 2, week 1)
    expect(screen.getByText('Session 2 · Week 1: Squat, 5/3/1 (custom)')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start session 2, week 1' }));
    expect(onOpenSession).toHaveBeenCalledWith('p1-2-w1');
    // latest e1RM: bench has one, squat and deadlift do not
    expect(screen.getByTestId('dashboard-e1rm-bench')).toHaveTextContent(/Bench Press/);
    expect(screen.getByTestId('dashboard-e1rm-bench')).toHaveTextContent(/Recorded Nov 9, 2026/);
    expect(screen.getByTestId('dashboard-e1rm-squat')).toHaveTextContent(/Reference 1RM: 140\.0 kg/);
    expect(screen.getByTestId('dashboard-e1rm-squat')).toHaveTextContent(/—/);
    expect(screen.getByTestId('dashboard-e1rm-deadlift')).toHaveTextContent(/Not set/);
  });

  it('navigates through the shortcuts', async () => {
    const onNavigate = jest.fn();
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={onNavigate} />, { seed: seedBlock });
    await screen.findByRole('header', { name: 'Dashboard' });
    for (const [label, target] of [
      ['Training', 'training'],
      ['Periodization', 'periodization'],
      ['Progress', 'progress'],
      ['History', 'history'],
    ] as const) {
      await fireEvent.press(screen.getByRole('button', { name: `Open ${label}` }));
      expect(onNavigate).toHaveBeenLastCalledWith(target);
    }
  });

  it('points to Training when sessions are in progress', async () => {
    const onNavigate = jest.fn();
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={onNavigate} />, {
      seed: async (repos, profileId) => {
        await seedActivated(repos, profileId);
        await repos.performances.saveDraft({
          profileId,
          periodizationId: 1,
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
    expect(await screen.findByText('1 session in progress')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue in Training' }));
    expect(onNavigate).toHaveBeenCalledWith('training');
  });

  it('says when the block has not started yet and when it is finished', async () => {
    await renderInApp(<DashboardScreen now={new Date('2026-11-08T09:00:00')} onOpenSession={noop} onNavigate={noop} />, {
      seed: (repos, profileId) => seedActivated(repos, profileId),
    });
    expect(await screen.findByText('Starts in 1 day')).toBeOnTheScreen();
  });

  it('shows a finished block after its third week', async () => {
    await renderInApp(<DashboardScreen now={new Date('2026-12-30T09:00:00')} onOpenSession={noop} onNavigate={noop} />, {
      seed: (repos, profileId) => seedActivated(repos, profileId),
    });
    expect(await screen.findByText('Block finished')).toBeOnTheScreen();
  });

  it('explains how to start when there is no activated periodization', async () => {
    const onNavigate = jest.fn();
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={onNavigate} />, {
      seed: seedOneRmsOnly,
    });
    expect(await screen.findByText(/No activated periodization yet/)).toBeOnTheScreen();
    expect(screen.getByText(/No e1RM yet/)).toBeOnTheScreen();
    expect(screen.queryByText('Next session')).toBeNull();
    expect(screen.getByTestId('dashboard-e1rm-bench')).toHaveTextContent(/Reference 1RM: 100\.0 kg/);
    await fireEvent.press(screen.getByRole('button', { name: 'Plan your block' }));
    expect(onNavigate).toHaveBeenCalledWith('periodization');
  });

  it('says so when every session has been started', async () => {
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, {
      seed: async (repos, profileId) => {
        await seedActivated(repos, profileId, { lifts: ['bench'] });
        for (const week of [1, 2, 3]) {
          await repos.performances.saveDraft({
            profileId,
            periodizationId: 1,
            sessionKey: `1-w${week}`,
            sessionNumber: 1,
            blockWeek: week,
            lift: 'bench',
            templateId: 'cycle-531-custom',
            templateName: '5/3/1 (custom)',
            notes: '',
            sets: [loggedSet(0, 75, 5, null)],
          });
        }
      },
    });
    expect(await screen.findByText('Every session of the active periodization has been started.')).toBeOnTheScreen();
  });
});

describe('DashboardScreen (pt-BR)', () => {
  it('renders in Portuguese with locale-formatted numbers and dates', async () => {
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, {
      language: 'pt-BR',
      repos: createMemoryRepositories({ clock: () => new Date('2026-11-09T12:00:00.000Z') }),
      seed: seedBlock,
    });
    expect(await screen.findByRole('header', { name: 'Painel' })).toBeOnTheScreen();
    expect(screen.getByText('Semana 1 de 3')).toBeOnTheScreen();
    expect(screen.getByText('Data de início: 9 de nov. de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Sessão 2 · Semana 1: Agachamento, 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByTestId('dashboard-e1rm-squat')).toHaveTextContent(/1RM de referência: 140,0 kg/);
    expect(screen.getByTestId('dashboard-e1rm-bench')).toHaveTextContent(/Registrado em 9 de nov. de 2026/);
    expect(screen.getByRole('button', { name: 'Abrir Treino' })).toBeOnTheScreen();
  });

  it('renders the empty state in Portuguese', async () => {
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, {
      language: 'pt-BR',
    });
    expect(await screen.findByText(/Nenhuma periodização ativada ainda/)).toBeOnTheScreen();
    expect(screen.getByText(/Nenhum e1RM ainda/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir Periodização' })).toBeOnTheScreen();
  });
});

describe('DashboardScreen accessibility', () => {
  it('gives every button an accessible name and a 44 pt touch target', async () => {
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, { seed: seedBlock });
    await screen.findByRole('header', { name: 'Dashboard' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      expect(button).toHaveStyle({ minHeight: 44 });
      expect(button.props.accessibilityLabel).toBeTruthy();
    }
  });

  it('exposes each lift summary as one labelled element', async () => {
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, {
      repos: createMemoryRepositories({ clock: () => new Date('2026-11-09T12:00:00.000Z') }),
      seed: seedBlock,
    });
    await screen.findByRole('header', { name: 'Dashboard' });
    const label: string = screen.getByTestId('dashboard-e1rm-squat').props.accessibilityLabel;
    expect(label.replace(/\u00a0/g, ' ')).toBe('Squat: —. Reference 1RM: 140.0 kg');
  });
});

describe('DashboardScreen layout', () => {
  const layoutOf = async (width: number) => {
    setWidth(width);
    await renderInApp(<DashboardScreen now={NOW} onOpenSession={noop} onNavigate={noop} />, { seed: seedBlock });
    await screen.findByRole('header', { name: 'Dashboard' });
    return screen.getByTestId('dashboard-grid');
  };

  it('stacks the sections on a phone (375)', async () => {
    expect(await layoutOf(375)).toHaveStyle({ flexDirection: 'column' });
  });

  it('puts the sections side by side on a wide screen (1280)', async () => {
    expect(await layoutOf(1280)).toHaveStyle({ flexDirection: 'row' });
  });
});
