import { fireEvent, render, screen } from '@testing-library/react-native';

import { palettes } from '@/constants/theme';

import { Chip } from './chip';

describe('Chip', () => {
  it('is a button that exposes its selected state and reports presses', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Chest" selected onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chest', selected: true }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('highlights only the selected chip with the accent color and keeps a 44 pt target', async () => {
    await render(
      <>
        <Chip label="Back" selected onPress={() => {}} />
        <Chip label="Legs" selected={false} onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
    expect(screen.getByRole('button', { name: 'Legs' })).not.toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
    expect(screen.getByRole('button', { name: 'Legs' })).toHaveStyle({ minHeight: 44 });
  });
});
