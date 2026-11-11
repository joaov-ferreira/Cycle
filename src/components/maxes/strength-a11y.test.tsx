/**
 * Accessibility audit of the strength screens (1RMs, detail, calculator, Settings → Strength,
 * onboarding): every pressable has a role and an accessible name and is at least 44 pt tall when
 * it declares a height, and every text input is labeled.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ReactElement } from 'react';

import { layout } from '@/constants/theme';
import { renderInApp } from '@/test-utils/render-app';
import { SQUAT, createTestStore, seedReferenceMax } from '@/test-utils/seed';

import { OnboardingScreen } from '../onboarding/onboarding-screen';
import { SettingsScreen } from '../settings/settings-screen';
import { CalculatorScreen } from './calculator-screen';
import { MaxDetailScreen } from './max-detail-screen';
import { MaxesScreen } from './maxes-screen';

type Flat = Record<string, unknown>;
type Host = ReturnType<typeof screen.getByTestId>;

const textOf = (node: Host | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('');

const describeNode = (node: Host) =>
  `${String(node.props.accessibilityLabel ?? textOf(node)).slice(0, 40)} [${String(node.props.testID ?? node.type)}]`;

const hostNodes = (predicate: (node: Host) => boolean): Host[] => screen.root!.queryAll(predicate);
const isPressable = (node: Host) => typeof node.props.onClick === 'function';

function declaredHeight(node: Host): number | null {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Flat;
  const slop = (node.props.hitSlop ?? {}) as { top?: number; bottom?: number };
  const own = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
  return own === 0 ? null : own + (slop.top ?? 0) + (slop.bottom ?? 0);
}

function audit(): string[] {
  const problems: string[] = [];
  for (const node of hostNodes(isPressable)) {
    const name = node.props.accessibilityLabel ?? node.props['aria-label'] ?? textOf(node);
    if (String(name).trim() === '') problems.push(`no accessible name: ${describeNode(node)}`);
    if (!(node.props.accessibilityRole ?? node.props.role)) problems.push(`no role: ${describeNode(node)}`);
    const declared = declaredHeight(node);
    if (declared !== null && declared < layout.minTouchTarget) {
      problems.push(`touch target ${declared} pt: ${describeNode(node)}`);
    }
  }
  for (const node of hostNodes((n) => n.type === 'TextInput')) {
    const name = node.props.accessibilityLabel ?? node.props['aria-label'];
    if (!name || String(name).trim() === '') problems.push(`unlabeled text input: ${describeNode(node)}`);
  }
  return problems;
}

async function show(ui: ReactElement, language: 'en' | 'pt-BR' = 'en', onboarded = true) {
  const { store, repos } = await createTestStore();
  await seedReferenceMax(store, SQUAT, 140);
  await renderInApp(ui, { store, repos, language, onboarded });
}

const tap = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  await act(async () => {
    fireEvent.press(button);
  });
};

describe.each(['en', 'pt-BR'] as const)('strength screens accessibility (%s)', (language) => {
  it('1RMs list', async () => {
    await show(<MaxesScreen onOpenExercise={jest.fn()} onOpenCalculator={jest.fn()} onBack={jest.fn()} />, language);
    await screen.findByTestId('screen-maxes');
    expect(audit()).toEqual([]);
  });

  it('1RM detail with the estimate form open', async () => {
    await show(<MaxDetailScreen exerciseId={SQUAT} onBack={jest.fn()} />, language);
    await tap(language === 'en' ? 'Estimate from a set' : 'Estimar a partir de uma série');
    expect(audit()).toEqual([]);
  });

  it('calculator with a set entered', async () => {
    await show(<CalculatorScreen onBack={jest.fn()} />, language);
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('calc-weight'), '80');
      fireEvent.changeText(screen.getByTestId('calc-reps'), '5');
    });
    await screen.findByTestId('calc-table');
    expect(audit()).toEqual([]);
  });

  it('Settings with the Strength section', async () => {
    await show(<SettingsScreen onOpenMaxes={jest.fn()} onBack={jest.fn()} />, language);
    await screen.findByTestId('strength-section');
    expect(audit()).toEqual([]);
  });

  it('onboarding: focus, experience and lifts steps', async () => {
    await show(<OnboardingScreen onFinish={jest.fn()} />, language, false);
    await screen.findByTestId('screen-onboarding');
    expect(audit()).toEqual([]);
    await tap(language === 'en' ? 'Strength' : 'Força');
    await tap(language === 'en' ? 'Continue' : 'Continuar');
    expect(audit()).toEqual([]);
    await tap(language === 'en' ? 'Continue' : 'Continuar');
    await screen.findByTestId('lift-row-barbell-back-squat');
    expect(audit()).toEqual([]);
  });
});
