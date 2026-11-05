import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from './TextField';

describe('TextField', () => {
  it('exposes the label as the accessible name and reports edits', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Profile name" value="Ana" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Profile name');
    expect(input).toHaveDisplayValue('Ana');
    expect(screen.getByText('Profile name')).toBeOnTheScreen();
    await fireEvent.changeText(input, 'Bruno');
    expect(onChangeText).toHaveBeenCalledWith('Bruno');
  });

  it('shows an error message when given one', async () => {
    await render(<TextField label="Name" value="" onChangeText={jest.fn()} error="Required" />);
    expect(screen.getByText('Required')).toBeOnTheScreen();
  });
});
