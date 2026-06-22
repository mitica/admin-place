// In-code GeoNames fixtures for Andorra (AD). Fields are joined with real tabs
// at runtime so the test data can't be corrupted by whitespace normalization.

interface RowSpec {
  geonameId: string;
  name: string;
  featureClass: string;
  featureCode: string;
  lat?: string;
  lng?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  population?: string;
}

function row(spec: RowSpec): string {
  const cols = new Array<string>(19).fill('');
  cols[0] = spec.geonameId;
  cols[1] = spec.name;
  cols[2] = spec.name;
  cols[4] = spec.lat ?? '';
  cols[5] = spec.lng ?? '';
  cols[6] = spec.featureClass;
  cols[7] = spec.featureCode;
  cols[8] = 'AD';
  cols[10] = spec.admin1 ?? '';
  cols[11] = spec.admin2 ?? '';
  cols[12] = spec.admin3 ?? '';
  cols[13] = spec.admin4 ?? '';
  cols[14] = spec.population ?? '';
  return cols.join('\t');
}

/**
 * A small but representative AD dump exercising: a country row (excluded),
 * two ADM1 + one ADM2, a historical ADM1H (excluded), a pop>0 place under
 * ADM1, a place under ADM2, a pop=0 place (excluded), a place with a bogus
 * admin2 (clamps to ADM1), a place with admin1="00" (country-direct), and a
 * malformed short line (skipped).
 */
export const AD_DUMP_LINES: string[] = [
  row({
    geonameId: '3041565',
    name: 'Principality of Andorra',
    featureClass: 'A',
    featureCode: 'PCLI',
    population: '77006',
  }),
  row({
    geonameId: '3040684',
    name: 'Andorra la Vella',
    lat: '42.5',
    lng: '1.52',
    featureClass: 'A',
    featureCode: 'ADM1',
    admin1: '07',
  }),
  row({
    geonameId: '3041203',
    name: 'Encamp',
    lat: '42.53',
    lng: '1.58',
    featureClass: 'A',
    featureCode: 'ADM1',
    admin1: '03',
  }),
  row({
    geonameId: '9990001',
    name: 'Andorra Sub-District',
    featureClass: 'A',
    featureCode: 'ADM2',
    admin1: '07',
    admin2: '001',
  }),
  row({
    geonameId: '8880001',
    name: 'Old Andorra Region',
    featureClass: 'A',
    featureCode: 'ADM1H',
    admin1: '09',
  }),
  row({
    geonameId: '3041563',
    name: 'Andorra la Vella',
    lat: '42.50779',
    lng: '1.52109',
    featureClass: 'P',
    featureCode: 'PPLC',
    admin1: '07',
    population: '20430',
  }),
  row({
    geonameId: '7770001',
    name: 'Sub Town',
    lat: '42.51',
    lng: '1.53',
    featureClass: 'P',
    featureCode: 'PPL',
    admin1: '07',
    admin2: '001',
    population: '800',
  }),
  row({
    geonameId: '6660001',
    name: 'Empty Hamlet',
    lat: '42.6',
    lng: '1.6',
    featureClass: 'P',
    featureCode: 'PPL',
    admin1: '03',
    population: '0',
  }),
  row({
    geonameId: '5550001',
    name: 'Bogus Place',
    lat: '42.55',
    lng: '1.55',
    featureClass: 'P',
    featureCode: 'PPL',
    admin1: '03',
    admin2: '999',
    population: '1200',
  }),
  row({
    geonameId: '4440001',
    name: 'No Region Town',
    lat: '42.7',
    lng: '1.7',
    featureClass: 'P',
    featureCode: 'PPL',
    admin1: '00',
    population: '1500',
  }),
  'malformed\trow\twith\tfew\tcolumns',
];

/** A countryInfo.txt fixture with comment lines and a single AD row. */
export function adCountryInfoText(): string {
  const ad = new Array<string>(19).fill('');
  ad[0] = 'AD';
  ad[4] = 'Andorra';
  ad[7] = '77006';
  ad[16] = '3041565';
  return ['# GeoNames countryInfo fixture', '#ISO\tISO3\t...', ad.join('\t')].join('\n');
}
