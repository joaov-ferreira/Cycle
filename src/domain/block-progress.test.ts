import { blockProgress } from './block-progress';

// Dates are local calendar dates: the block starts on a Monday, 2026-11-09.
const at = (iso: string) => new Date(`${iso}T15:30:00`);

describe('blockProgress', () => {
  it('is upcoming before the start date, with the days remaining', () => {
    expect(blockProgress('2026-11-09', at('2026-11-08'))).toEqual({ status: 'upcoming', daysUntilStart: 1 });
    expect(blockProgress('2026-11-09', at('2026-10-30'))).toEqual({ status: 'upcoming', daysUntilStart: 10 });
  });

  it('is week 1 from the start date through its seventh day', () => {
    expect(blockProgress('2026-11-09', at('2026-11-09'))).toEqual({ status: 'active', week: 1 });
    expect(blockProgress('2026-11-09', at('2026-11-15'))).toEqual({ status: 'active', week: 1 });
  });

  it('moves to week 2 and week 3 every seven days', () => {
    expect(blockProgress('2026-11-09', at('2026-11-16'))).toEqual({ status: 'active', week: 2 });
    expect(blockProgress('2026-11-09', at('2026-11-22'))).toEqual({ status: 'active', week: 2 });
    expect(blockProgress('2026-11-09', at('2026-11-23'))).toEqual({ status: 'active', week: 3 });
    expect(blockProgress('2026-11-09', at('2026-11-29'))).toEqual({ status: 'active', week: 3 });
  });

  it('is finished after the third week', () => {
    expect(blockProgress('2026-11-09', at('2026-11-30'))).toEqual({ status: 'finished' });
    expect(blockProgress('2026-11-09', at('2027-03-01'))).toEqual({ status: 'finished' });
  });

  it('ignores the time of day and daylight-saving shifts', () => {
    expect(blockProgress('2026-03-09', new Date('2026-03-15T23:59:59'))).toEqual({ status: 'active', week: 1 });
    expect(blockProgress('2026-03-09', new Date('2026-03-16T00:00:00'))).toEqual({ status: 'active', week: 2 });
  });
});
