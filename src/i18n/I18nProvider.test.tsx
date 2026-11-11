import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { I18nProvider, useI18n, useT } from './I18nProvider';

function Probe() {
  const t = useT();
  const { locale, formatKg, formatNumber, formatDate, formatPercent, formatTime } = useI18n();
  return (
    <>
      <Text>{locale}</Text>
      <Text>{t('tabs.plan')}</Text>
      <Text>{t('validation.tooManyDecimals', { count: 2 })}</Text>
      <Text>{formatKg(96.25)}</Text>
      <Text>{formatNumber(1234.5)}</Text>
      <Text>{formatPercent(0.875)}</Text>
      <Text>{formatDate(new Date(2026, 10, 5))}</Text>
      <Text>{formatTime(new Date(2026, 10, 5, 6, 42))}</Text>
    </>
  );
}

describe('I18nProvider', () => {
  it('renders English messages and formats', async () => {
    await render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('en')).toBeOnTheScreen();
    expect(screen.getByText('Plan')).toBeOnTheScreen();
    expect(screen.getByText('Use at most 2 decimal places')).toBeOnTheScreen();
    expect(screen.getByText('96.25 kg')).toBeOnTheScreen();
    expect(screen.getByText('1,234.5')).toBeOnTheScreen();
    expect(screen.getByText('87.5%')).toBeOnTheScreen();
    expect(screen.getByText('Nov 5, 2026')).toBeOnTheScreen();
    expect(screen.getByText(/^6:42\sAM$/)).toBeOnTheScreen();
  });

  it('renders Brazilian Portuguese messages and formats', async () => {
    await render(
      <I18nProvider locale="pt-BR">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('pt-BR')).toBeOnTheScreen();
    expect(screen.getByText('Periodização')).toBeOnTheScreen();
    expect(screen.getByText('Use no máximo 2 casas decimais')).toBeOnTheScreen();
    expect(screen.getByText('96,25 kg')).toBeOnTheScreen();
    expect(screen.getByText('1.234,5')).toBeOnTheScreen();
    expect(screen.getByText('87,5%')).toBeOnTheScreen();
    expect(screen.getByText('5 de nov. de 2026')).toBeOnTheScreen();
    expect(screen.getByText('06:42')).toBeOnTheScreen();
  });

  it('switches language instantly when the locale prop changes', async () => {
    const view = await render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('Plan')).toBeOnTheScreen();
    await view.rerender(
      <I18nProvider locale="pt-BR">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('Periodização')).toBeOnTheScreen();
  });

  it('defaults to English outside a provider', async () => {
    await render(<Probe />);
    expect(screen.getByText('Plan')).toBeOnTheScreen();
  });
});
