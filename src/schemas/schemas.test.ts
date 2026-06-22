import { describe, expect, it } from 'vitest';

import { AdminDivisionSchema, CountrySchema, LocalitySchema } from './index';

const admin = {
  id: 'US.CA',
  name: 'California',
  geonameId: '5332921',
  featureClass: 'A',
  featureCode: 'ADM1',
  level: 1,
  parentId: 'US',
};

const locality = {
  id: '5368361',
  name: 'Los Angeles',
  geonameId: '5368361',
  featureClass: 'P',
  featureCode: 'PPL',
  parentId: 'US.CA',
};

describe('schemas', () => {
  it('accepts valid records', () => {
    expect(CountrySchema.safeParse({ id: 'US', name: 'United States' }).success).toBe(true);
    expect(AdminDivisionSchema.safeParse(admin).success).toBe(true);
    expect(LocalitySchema.safeParse(locality).success).toBe(true);
  });

  it('accepts optional fields (present or absent)', () => {
    expect(
      LocalitySchema.safeParse({
        ...locality,
        population: 3898747,
        lat: 34.05,
        lng: -118.24,
        wikidataId: 'Q65',
        names: { en: 'Los Angeles', es: 'Los Ángeles' },
        wikipediaTitles: { en: 'Los Angeles' },
      }).success,
    ).toBe(true);
    expect(
      CountrySchema.safeParse({
        id: 'AD',
        name: 'Andorra',
        geonameId: '3041565',
        population: 77006,
      }).success,
    ).toBe(true);
  });

  it('requires the GeoNames base fields', () => {
    const { geonameId, ...withoutGeonameId } = admin;
    void geonameId;
    expect(AdminDivisionSchema.safeParse(withoutGeonameId).success).toBe(false);
    expect(AdminDivisionSchema.safeParse({ ...admin, featureClass: 'AB' }).success).toBe(false);
  });

  it('rejects empty strings and unknown keys', () => {
    expect(CountrySchema.safeParse({ id: '', name: 'x' }).success).toBe(false);
    expect(CountrySchema.safeParse({ id: 'US', name: 'x', extra: 1 }).success).toBe(false);
    expect(AdminDivisionSchema.safeParse({ ...admin, extra: 1 }).success).toBe(false);
  });

  it('rejects invalid geonameId / wikidataId / coordinates', () => {
    expect(LocalitySchema.safeParse({ ...locality, geonameId: '0' }).success).toBe(false);
    expect(LocalitySchema.safeParse({ ...locality, geonameId: 'abc' }).success).toBe(false);
    expect(LocalitySchema.safeParse({ ...locality, wikidataId: '65' }).success).toBe(false);
    expect(LocalitySchema.safeParse({ ...locality, lat: 200 }).success).toBe(false);
  });

  it('rejects out-of-range or non-integer admin levels', () => {
    expect(AdminDivisionSchema.safeParse({ ...admin, level: 0 }).success).toBe(false);
    expect(AdminDivisionSchema.safeParse({ ...admin, level: 6 }).success).toBe(false);
    expect(AdminDivisionSchema.safeParse({ ...admin, level: 1.5 }).success).toBe(false);
  });
});
