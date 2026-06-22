import type { AdminDivision, Country, Locality } from '../schemas';

/**
 * The seam between raw upstream data and the generator. Implement this for each
 * real provider (e.g. a GeoNames source) and pass it to `generate`.
 */
export interface Source {
  /** Every country to generate. */
  countries(): Promise<Country[]>;
  /** Every admin division (all levels) belonging to a country. */
  adminDivisions(countryCode: string): Promise<AdminDivision[]>;
  /** Every populated place belonging to a country. */
  localities(countryCode: string): Promise<Locality[]>;
}
