import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterChips } from './filter-chips';

const options = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
] as const;

describe('FilterChips', () => {
  it('renders the "all" chip followed by one chip per option', async () => {
    await render(
      <FilterChips options={options} value={null} onChange={() => {}} allLabel="All" />,
    );
    expect(screen.getByRole('button', { name: 'All', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Chest', selected: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back', selected: false })).toBeOnTheScreen();
  });

  it('marks the chip matching the value as selected', async () => {
    await render(
      <FilterChips options={options} value="back" onChange={() => {}} allLabel="All" />,
    );
    expect(screen.getByRole('button', { name: 'Back', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'All', selected: false })).toBeOnTheScreen();
  });

  it('reports the chosen option', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips options={options} value={null} onChange={onChange} allLabel="All" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
    expect(onChange).toHaveBeenLastCalledWith('chest');
  });

  it('clears the filter when "all" is pressed while an option is selected', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips options={options} value="chest" onChange={onChange} allLabel="All" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clears the filter when the selected option is pressed again', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips options={options} value="chest" onChange={onChange} allLabel="All" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Chest', selected: true }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('ignores a press on "all" when nothing is filtered', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips options={options} value={null} onChange={onChange} allLabel="All" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'All', selected: true }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
