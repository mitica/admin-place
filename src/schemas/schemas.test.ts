import { describe, expect, it } from 'vitest';

import { AdminDivisionSchema, CountrySchema, LocalitySchema } from './index';

describe('schemas', () => {
  it('accepts valid records', () => {
    expect(CountrySchema.safeParse({ id: 'US', name: 'United States' }).success).toBe(true);
    expect(
      AdminDivisionSchema.safeParse({ id: 'US.CA', name: 'California', level: 1, parentId: 'US' })
        .success,
    ).toBe(true);
    expect(
      LocalitySchema.safeParse({ id: '5368361', name: 'Los Angeles', parentId: 'US.CA' }).success,
    ).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(CountrySchema.safeParse({ id: '', name: 'x' }).success).toBe(false);
    expect(CountrySchema.safeParse({ id: 'US', name: '' }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(CountrySchema.safeParse({ id: 'US', name: 'x', extra: 1 }).success).toBe(false);
  });

  it('rejects out-of-range or non-integer admin levels', () => {
    expect(
      AdminDivisionSchema.safeParse({ id: 'a', name: 'b', level: 0, parentId: 'US' }).success,
    ).toBe(false);
    expect(
      AdminDivisionSchema.safeParse({ id: 'a', name: 'b', level: 6, parentId: 'US' }).success,
    ).toBe(false);
    expect(
      AdminDivisionSchema.safeParse({ id: 'a', name: 'b', level: 1.5, parentId: 'US' }).success,
    ).toBe(false);
  });
});
