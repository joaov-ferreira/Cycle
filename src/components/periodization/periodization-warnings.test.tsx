import { screen } from '@testing-library/react-native';

import type { PeriodizationWarning } from '@/domain/periodization';
import { renderInApp } from '@/test-utils/render-app';

import { PeriodizationWarnings } from './periodization-warnings';

const WARNINGS: PeriodizationWarning[] = [
  { code: 'invalidSlot', slotId: 1, sessionNumber: 1, reason: 'unknownTemplate' },
  { code: 'invalidSlot', slotId: 2, sessionNumber: 2, reason: 'invalidStartWeek' },
  { code: 'partialBlock', slotId: 3, sessionNumber: 3, weeks: 1 },
  { code: 'partialBlock', slotId: 4, sessionNumber: 4, weeks: 2 },
  { code: 'missingOneRm', lift: 'squat' },
  { code: 'incompleteFrequency', templateId: 'cycle-531-custom', lift: 'bench', configured: 0, prescribed: 1 },
  { code: 'incompleteFrequency', templateId: 'smolov-jr', lift: 'squat', configured: 1, prescribed: 4 },
];

describe('PeriodizationWarnings', () => {
  it('renders nothing without warnings', async () => {
    await renderInApp(<PeriodizationWarnings warnings={[]} />);
    expect(screen.queryByTestId('periodization-warnings')).toBeNull();
  });

  it('localizes every warning code (en)', async () => {
    await renderInApp(<PeriodizationWarnings warnings={WARNINGS} />);
    expect(await screen.findByRole('header', { name: 'Warnings' })).toBeOnTheScreen();
    for (const text of [
      'Session 1 does not match its program: the program does not exist.',
      'Session 2 does not match its program: the start week does not exist.',
      'Session 3: the program ends after 1 week of this block.',
      'Session 4: the program ends after 2 weeks of this block.',
      'Enter your Squat 1RM in Settings to calculate its loads.',
      '5/3/1 (custom) (Bench Press) prescribes 1 session per week; your configuration uses 0.',
      'smolov-jr (Squat) prescribes 4 sessions per week; your configuration uses 1.',
    ]) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
  });

  it('localizes every warning code (pt-BR)', async () => {
    await renderInApp(<PeriodizationWarnings warnings={WARNINGS} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Avisos' })).toBeOnTheScreen();
    for (const text of [
      'A sessão 1 não corresponde ao programa: o programa não existe.',
      'Sessão 3: o programa termina após 1 semana deste bloco.',
      'Sessão 4: o programa termina após 2 semanas deste bloco.',
      'Informe seu 1RM de Agachamento nas Configurações para calcular as cargas.',
      'smolov-jr (Agachamento) prescreve 4 sessões por semana; sua configuração usa 1.',
    ]) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
  });
});
