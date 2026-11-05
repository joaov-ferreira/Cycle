import { cycle531Custom } from './data/cycle-531-custom';
import { findTemplate, listTemplates, templatesForLift } from './registry';
import { validateTemplate } from './validate';

describe('registry', () => {
  it('registers the custom 5/3/1 (the only template of Stage 4)', () => {
    expect(listTemplates().map((t) => t.id)).toEqual(['cycle-531-custom']);
  });

  it('has unique ids', () => {
    const ids = listTemplates().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds a template by id, or undefined', () => {
    expect(findTemplate('cycle-531-custom')).toBe(cycle531Custom);
    expect(findTemplate('nope')).toBeUndefined();
  });

  it.each(['bench', 'squat', 'deadlift'] as const)('offers 5/3/1 for %s', (lift) => {
    expect(templatesForLift(lift).map((t) => t.id)).toEqual(['cycle-531-custom']);
  });

  it('returns a fresh array each call, so callers cannot reorder the registry', () => {
    listTemplates().pop();
    expect(listTemplates()).toHaveLength(1);
  });
});

/** SPEC §3.1 rule 7: every registered template is validated against the schema. */
describe.each(listTemplates().map((t) => [t.id, t] as const))('registered template %s', (_id, template) => {
  it('passes schema validation', () => {
    expect(validateTemplate(template)).toEqual([]);
  });

  it('cites its source, version and verification status', () => {
    expect(template.source.author.trim()).not.toBe('');
    expect(template.source.reference.trim()).not.toBe('');
    expect(template.source.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(template.version.trim()).not.toBe('');
    expect(['verified', 'partial', 'unverified']).toContain(template.verification);
  });
});
