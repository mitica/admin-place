import type { AdminDivision, Country, Locality } from '../schemas';
import type { Source } from './source';

const COUNTRIES: Country[] = [
  { id: 'US', name: 'United States', geonameId: '6252001', population: 327167434 },
  { id: 'AD', name: 'Andorra', geonameId: '3041565', population: 77006 },
];

const ADMIN_DIVISIONS: Record<string, AdminDivision[]> = {
  // Two levels: states (ADM1) and counties (ADM2).
  US: [
    {
      id: 'US.CA',
      name: 'California',
      geonameId: '5332921',
      featureClass: 'A',
      featureCode: 'ADM1',
      level: 1,
      parentId: 'US',
    },
    {
      id: 'US.TX',
      name: 'Texas',
      geonameId: '4736286',
      featureClass: 'A',
      featureCode: 'ADM1',
      level: 1,
      parentId: 'US',
    },
    {
      id: 'US.CA.037',
      name: 'Los Angeles County',
      geonameId: '5368381',
      featureClass: 'A',
      featureCode: 'ADM2',
      level: 2,
      parentId: 'US.CA',
    },
    {
      id: 'US.TX.201',
      name: 'Harris County',
      geonameId: '4699440',
      featureClass: 'A',
      featureCode: 'ADM2',
      level: 2,
      parentId: 'US.TX',
    },
  ],
  // One level: parishes (ADM1).
  AD: [
    {
      id: 'AD.07',
      name: 'Andorra la Vella',
      geonameId: '3040684',
      featureClass: 'A',
      featureCode: 'ADM1',
      level: 1,
      parentId: 'AD',
    },
    {
      id: 'AD.03',
      name: 'Encamp',
      geonameId: '3041203',
      featureClass: 'A',
      featureCode: 'ADM1',
      level: 1,
      parentId: 'AD',
    },
  ],
};

const LOCALITIES: Record<string, Locality[]> = {
  US: [
    {
      id: '5368361',
      name: 'Los Angeles',
      geonameId: '5368361',
      featureClass: 'P',
      featureCode: 'PPL',
      population: 3898747,
      lat: 34.05223,
      lng: -118.24368,
      parentId: 'US.CA.037',
    },
    {
      id: '4699066',
      name: 'Houston',
      geonameId: '4699066',
      featureClass: 'P',
      featureCode: 'PPL',
      population: 2304580,
      lat: 29.76328,
      lng: -95.36327,
      parentId: 'US.TX.201',
    },
  ],
  AD: [
    {
      id: '3041563',
      name: 'Andorra la Vella',
      geonameId: '3041563',
      featureClass: 'P',
      featureCode: 'PPLC',
      population: 20430,
      lat: 42.50779,
      lng: 1.52109,
      parentId: 'AD.07',
    },
    {
      id: '3040051',
      name: 'Encamp',
      geonameId: '3040051',
      featureClass: 'P',
      featureCode: 'PPLA',
      population: 11223,
      lat: 42.53606,
      lng: 1.58014,
      parentId: 'AD.03',
    },
  ],
};

/**
 * A tiny in-memory `Source` so the pipeline runs end-to-end with no external
 * data. US exercises two admin levels (states + counties); AD exercises a
 * single level (parishes). Replace with a real source (e.g. GeoNames) later.
 */
export class SampleSource implements Source {
  async countries(): Promise<Country[]> {
    return COUNTRIES;
  }

  async adminDivisions(countryCode: string): Promise<AdminDivision[]> {
    return ADMIN_DIVISIONS[countryCode] ?? [];
  }

  async localities(countryCode: string): Promise<Locality[]> {
    return LOCALITIES[countryCode] ?? [];
  }
}
