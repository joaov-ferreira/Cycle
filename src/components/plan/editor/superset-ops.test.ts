import { validatePlanContent, type PlanExercise } from '@/domain/plan';
import { samplePlanContent } from '@/test-utils/seed';

import {
  canLinkNext,
  isLinkedToPrevious,
  linkWithNext,
  normalizeSupersets,
  offersLink,
  unlinkAt,
} from './superset-ops';

const ex = (id: string, group?: string): PlanExercise => ({
  id,
  exerciseId: 'barbell-bench-press',
  sets: 3,
  repMin: 8,
  repMax: 12,
  ...(group === undefined ? {} : { supersetGroup: group }),
});
const groups = (list: PlanExercise[]) => list.map((e) => e.supersetGroup ?? '-').join(',');

describe('linkWithNext', () => {
  it('gives two ungrouped exercises a new label S1', () => {
    expect(groups(linkWithNext([ex('a'), ex('b'), ex('c')], 0))).toBe('S1,S1,-');
  });

  it('picks a label that is not used yet', () => {
    expect(groups(linkWithNext([ex('a', 'S1'), ex('b', 'S1'), ex('c'), ex('d')], 2))).toBe('S1,S1,S2,S2');
  });

  it('joins an ungrouped exercise to the group on its left or right', () => {
    expect(groups(linkWithNext([ex('a', 'A'), ex('b', 'A'), ex('c')], 1))).toBe('A,A,A');
    expect(groups(linkWithNext([ex('a'), ex('b', 'A'), ex('c', 'A')], 0))).toBe('A,A,A');
  });

  it('merges two groups under the first label', () => {
    expect(groups(linkWithNext([ex('a', 'A'), ex('b', 'A'), ex('c', 'B'), ex('d', 'B')], 1))).toBe('A,A,A,A');
  });

  it('refuses to create a group of more than 4', () => {
    const list = [ex('a', 'A'), ex('b', 'A'), ex('c', 'A'), ex('d', 'A'), ex('e')];
    expect(canLinkNext(list, 3)).toBe(false);
    expect(linkWithNext(list, 3)).toEqual(list);
    const merge = [ex('a', 'A'), ex('b', 'A'), ex('c', 'A'), ex('d', 'B'), ex('e', 'B')];
    expect(canLinkNext(merge, 2)).toBe(false);
  });

  it('does nothing for the last exercise or an already linked pair', () => {
    const list = [ex('a', 'A'), ex('b', 'A')];
    expect(offersLink(list, 0)).toBe(false);
    expect(offersLink(list, 1)).toBe(false);
    expect(linkWithNext(list, 0)).toEqual(list);
    expect(offersLink([ex('a'), ex('b')], 0)).toBe(true);
  });
});

describe('unlinkAt', () => {
  it('drops the label of a member left alone', () => {
    expect(groups(unlinkAt([ex('a', 'A'), ex('b', 'A')], 1))).toBe('-,-');
  });

  it('splits a group of 3 at its second member', () => {
    expect(groups(unlinkAt([ex('a', 'A'), ex('b', 'A'), ex('c', 'A')], 1))).toBe('-,S1,S1');
  });

  it('splits a group of 4 into two groups with different labels', () => {
    const result = unlinkAt([ex('a', 'A'), ex('b', 'A'), ex('c', 'A'), ex('d', 'A')], 2);
    expect(groups(result)).toBe('A,A,S1,S1');
  });

  it('ignores an exercise that is not linked to the previous one', () => {
    const list = [ex('a', 'A'), ex('b', 'A'), ex('c')];
    expect(isLinkedToPrevious(list, 2)).toBe(false);
    expect(unlinkAt(list, 2)).toEqual(list);
  });
});

describe('normalizeSupersets', () => {
  it('drops a label that is left on a single exercise', () => {
    expect(groups(normalizeSupersets([ex('a', 'A'), ex('b'), ex('c', 'A')]))).toBe('-,-,-');
  });

  it('keeps a valid workout as it is', () => {
    const list = [ex('a', 'A'), ex('b', 'A'), ex('c'), ex('d', 'B'), ex('e', 'B')];
    expect(normalizeSupersets(list)).toEqual(list);
  });

  it('relabels a second run that reuses a label and splits runs larger than 4', () => {
    expect(groups(normalizeSupersets([ex('a', 'A'), ex('b', 'A'), ex('c'), ex('d', 'A'), ex('e', 'A')]))).toBe(
      'A,A,-,S1,S1',
    );
    const long = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ex(id, 'A'));
    expect(groups(normalizeSupersets(long))).toBe('A,A,A,A,S1,S1');
  });

  it('removes blank labels', () => {
    expect(groups(normalizeSupersets([ex('a', ' '), ex('b')]))).toBe('-,-');
  });

  it('always yields exercises that validate for any reorder of a grouped workout', () => {
    const base = [ex('a', 'A'), ex('b', 'A'), ex('c', 'A'), ex('d'), ex('e', 'B'), ex('f', 'B')];
    const content = samplePlanContent();
    for (let from = 0; from < base.length; from++) {
      for (let to = 0; to < base.length; to++) {
        const list = [...base];
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        const workouts = [{ ...content.workouts[0], exercises: normalizeSupersets(list) }, content.workouts[1]];
        const issues = validatePlanContent({ ...content, workouts }, () => ({}) as never).filter((i) =>
          i.code.startsWith('superset'),
        );
        expect(issues).toEqual([]);
      }
    }
  });
});
