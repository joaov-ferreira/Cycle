import { fireEvent, render, screen } from '@testing-library/react-native';

import { palettes } from '@/constants/theme';

import { ThemeProvider } from '../theme-provider';
import { Button } from './Button';
import { Card } from './Card';
import { Screen } from './Screen';
import { Text } from './Text';

describe('Text', () => {
  it('renders body text in the primary text color by default', async () => {
    await render(<Text>Hello</Text>);
    expect(screen.getByText('Hello')).toHaveStyle({ color: palettes.dark.text, fontSize: 16 });
  });

  it('supports variants, secondary tone and tabular numbers', async () => {
    await render(
      <Text variant="caption" tone="secondary" tabular>
        96.25
      </Text>,
    );
    expect(screen.getByText('96.25')).toHaveStyle({
      color: palettes.dark.textSecondary,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    });
  });

  it('marks title and heading variants as headers for screen readers', async () => {
    await render(
      <>
        <Text variant="title">Big</Text>
        <Text variant="heading">Section</Text>
      </>,
    );
    expect(screen.getByRole('header', { name: 'Big' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Section' })).toBeOnTheScreen();
  });

  it('follows the light scheme', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Text tone="danger">Oops</Text>
      </ThemeProvider>,
    );
    expect(screen.getByText('Oops')).toHaveStyle({ color: palettes.light.danger });
  });
});

describe('Button', () => {
  it('is an accessible button that fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Generate" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Generate' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can have an accessible name that differs from its short visible label', async () => {
    await render(<Button label="↑" accessibilityLabel="Move session 2 up" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Move session 2 up' })).toBeOnTheScreen();
    expect(screen.getByText('↑')).toBeOnTheScreen();
  });

  it('has a touch target of at least 44 pt', async () => {
    await render(<Button label="Go" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({ minHeight: 44 });
  });

  it('uses the accent color for the primary variant only', async () => {
    await render(
      <>
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveStyle({
      backgroundColor: palettes.dark.surfaceRaised,
    });
  });

  it('does not fire when disabled and exposes the disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('accepts an accessibility hint', async () => {
    await render(<Button label="Go" hint="Opens the session" onPress={() => {}} />);
    expect(screen.getByHintText('Opens the session')).toBeOnTheScreen();
  });
});

describe('Card', () => {
  it('renders its children on a bordered surface', async () => {
    await render(
      <Card testID="card">
        <Text>Inside</Text>
      </Card>,
    );
    expect(screen.getByText('Inside')).toBeOnTheScreen();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: palettes.dark.surface,
      borderColor: palettes.dark.border,
    });
  });
});

describe('Screen', () => {
  it('fills the screen with the theme background and shows the title as a header', async () => {
    await render(
      <Screen title="Dashboard" testID="screen">
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: '#000000', flex: 1 });
    expect(screen.getByRole('header', { name: 'Dashboard' })).toBeOnTheScreen();
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });

  it('renders without a title', async () => {
    await render(
      <Screen>
        <Text>Only body</Text>
      </Screen>,
    );
    expect(screen.queryByRole('header')).toBeNull();
  });
});
