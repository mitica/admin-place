import type { AdminDivision, Country, Locality } from '../schemas';
import type { Source } from './source';

const COUNTRIES: Country[] = [
  { id: 'US', name: 'United States' },
  { id: 'AD', name: 'Andorra' },
];

const ADMIN_DIVISIONS: Record<string, AdminDivision[]> = {
  // Two levels: states (ADM1) and counties (ADM2).
  US: [
    { id: 'US.CA', name: 'California', level: 1, parentId: 'US' },
    { id: 'US.TX', name: 'Texas', level: 1, parentId: 'US' },
    { id: 'US.CA.037', name: 'Los Angeles County', level: 2, parentId: 'US.CA' },
    { id: 'US.TX.201', name: 'Harris County', level: 2, parentId: 'US.TX' },
  ],
  // One level: parishes (ADM1).
  AD: [
    { id: 'AD.07', name: 'Andorra la Vella', level: 1, parentId: 'AD' },
    { id: 'AD.03', name: 'Encamp', level: 1, parentId: 'AD' },
  ],
};

const LOCALITIES: Record<string, Locality[]> = {
  US: [
    { id: '5368361', name: 'Los Angeles', parentId: 'US.CA.037' },
    { id: '4699066', name: 'Houston', parentId: 'US.TX.201' },
  ],
  AD: [
    { id: '3041563', name: 'Andorra la Vella', parentId: 'AD.07' },
    { id: '3040051', name: 'Encamp', parentId: 'AD.03' },
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
