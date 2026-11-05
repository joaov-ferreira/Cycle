import { fireEvent, render, screen } from '@testing-library/react-native';

import { palettes } from '@/constants/theme';

import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'table', label: 'Table' },
  { value: 'calendar', label: 'Calendar' },
] as const;

describe('SegmentedControl', () => {
  it('renders every option as a button and marks the selected one', async () => {
    await render(
      <SegmentedControl label="View" options={options} value="table" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Table', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Calendar', selected: false })).toBeOnTheScreen();
    expect(screen.getByLabelText('View')).toBeOnTheScreen();
  });

  it('highlights the selected segment with the accent color', async () => {
    await render(
      <SegmentedControl label="View" options={options} value="calendar" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
    expect(screen.getByRole('button', { name: 'Table' })).not.toHaveStyle({
      backgroundColor: palettes.dark.accent,
    });
  });

  it('reports the pressed value, and ignores presses on the current one', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl label="View" options={options} value="table" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Table' }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Calendar' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });

  it('keeps every segment at least 44 pt tall', async () => {
    await render(
      <SegmentedControl label="View" options={options} value="table" onChange={() => {}} />,
    );
    for (const name of ['Table', 'Calendar']) {
      expect(screen.getByRole('button', { name })).toHaveStyle({ minHeight: 44 });
    }
  });
});
