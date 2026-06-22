import { describe, expect, it } from 'vitest';

import type { GeoNamesRow } from './parse';
import {
  adminDotId,
  adminLevel,
  adminParentId,
  isAdminRow,
  isLocalityRow,
  localityParentId,
  rowToAdminDivision,
  rowToLocality,
} from './transform';

function row(spec: Partial<GeoNamesRow>): GeoNamesRow {
  return {
    geonameId: '1',
    name: 'X',
    asciiName: 'X',
    alternateNames: '',
    latitude: '',
    longitude: '',
    featureClass: 'P',
    featureCode: 'PPL',
    countryCode: 'AD',
    cc2: '',
    admin1: '',
    admin2: '',
    admin3: '',
    admin4: '',
    population: '0',
    elevation: '',
    dem: '',
    timezone: '',
    modificationDate: '',
    ...spec,
  };
}

describe('admin id derivation', () => {
  it('derives level from the feature code', () => {
    expect(adminLevel('ADM1')).toBe(1);
    expect(adminLevel('ADM3')).toBe(3);
    expect(Number.isNaN(adminLevel('PPL'))).toBe(true);
  });

  it('builds dot-ids for the row level and rejects incomplete codes', () => {
    expect(adminDotId(row({ featureClass: 'A', featureCode: 'ADM1', admin1: '07' }))).toBe('AD.07');
    expect(
      adminDotId(row({ featureClass: 'A', featureCode: 'ADM2', admin1: '07', admin2: '001' })),
    ).toBe('AD.07.001');
    expect(
      adminDotId(row({ featureClass: 'A', featureCode: 'ADM2', admin1: '07' })),
    ).toBeUndefined();
    expect(
      adminDotId(row({ featureClass: 'A', featureCode: 'ADM1', admin1: '00' })),
    ).toBeUndefined();
  });

  it('derives parent ids by dropping the last segment', () => {
    expect(adminParentId('AD.07.001')).toBe('AD.07');
    expect(adminParentId('AD.07')).toBe('AD');
  });
});

describe('row classification', () => {
  it('recognizes admin rows (class A, ADM1..ADM5 only)', () => {
    expect(isAdminRow(row({ featureClass: 'A', featureCode: 'ADM1' }))).toBe(true);
    expect(isAdminRow(row({ featureClass: 'A', featureCode: 'ADM1H' }))).toBe(false);
    expect(isAdminRow(row({ featureClass: 'A', featureCode: 'PCLI' }))).toBe(false);
  });

  it('recognizes localities (class P, population > 0)', () => {
    expect(isLocalityRow(row({ featureClass: 'P', featureCode: 'PPL', population: '5' }))).toBe(
      true,
    );
    expect(isLocalityRow(row({ featureClass: 'P', featureCode: 'PPL', population: '0' }))).toBe(
      false,
    );
  });
});

describe('localityParentId clamping', () => {
  const adminIds = new Set(['AD.07', 'AD.03', 'AD.07.001']);

  it('uses the deepest existing ancestor', () => {
    expect(localityParentId(row({ admin1: '07', admin2: '001' }), adminIds, 'AD')).toBe(
      'AD.07.001',
    );
  });

  it('clamps past a missing admin level', () => {
    expect(localityParentId(row({ admin1: '03', admin2: '999' }), adminIds, 'AD')).toBe('AD.03');
  });

  it('falls back to the country for empty/00 admin1', () => {
    expect(localityParentId(row({ admin1: '00' }), adminIds, 'AD')).toBe('AD');
    expect(localityParentId(row({ admin1: '' }), adminIds, 'AD')).toBe('AD');
  });
});

describe('row → entity', () => {
  it('builds an admin division, omitting population when 0', () => {
    const division = rowToAdminDivision(
      row({
        geonameId: '3040684',
        name: 'Andorra la Vella',
        featureClass: 'A',
        featureCode: 'ADM1',
        admin1: '07',
        latitude: '42.5',
        longitude: '1.52',
      }),
    );
    expect(division).toEqual({
      id: 'AD.07',
      name: 'Andorra la Vella',
      geonameId: '3040684',
      featureClass: 'A',
      featureCode: 'ADM1',
      lat: 42.5,
      lng: 1.52,
      level: 1,
      parentId: 'AD',
    });
  });

  it('builds a locality with population and coordinates', () => {
    const locality = rowToLocality(
      row({
        geonameId: '3041563',
        name: 'Andorra la Vella',
        featureClass: 'P',
        featureCode: 'PPLC',
        population: '20430',
        latitude: '42.5',
        longitude: '1.52',
      }),
      'AD.07',
    );
    expect(locality).toEqual({
      id: '3041563',
      name: 'Andorra la Vella',
      geonameId: '3041563',
      featureClass: 'P',
      featureCode: 'PPLC',
      population: 20430,
      lat: 42.5,
      lng: 1.52,
      parentId: 'AD.07',
    });
  });
});
