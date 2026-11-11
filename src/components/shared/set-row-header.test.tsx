import { render, screen } from '@testing-library/react-native';

import { I18nProvider, type AppLocale } from '@/i18n';

import { SetRowHeader } from './set-row-header';

async function renderHeader(locale: AppLocale) {
  await render(
    <I18nProvider locale={locale}>
      <SetRowHeader />
    </I18nProvider>,
  );
}

describe('SetRowHeader', () => {
  it('captions the columns of a set row in English', async () => {
    await renderHeader('en');
    expect(screen.getByText('Set')).toBeOnTheScreen();
    expect(screen.getByText('kg')).toBeOnTheScreen();
    expect(screen.getByText('Reps')).toBeOnTheScreen();
    expect(screen.getByText('RIR')).toBeOnTheScreen();
  });

  it('captions the columns in Portuguese', async () => {
    await renderHeader('pt-BR');
    expect(screen.getByText('Série')).toBeOnTheScreen();
    expect(screen.getByText('kg')).toBeOnTheScreen();
    expect(screen.getByText('Repetições')).toBeOnTheScreen();
    expect(screen.getByText('RIR')).toBeOnTheScreen();
  });

  it('shows no interactive controls', async () => {
    await renderHeader('en');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
