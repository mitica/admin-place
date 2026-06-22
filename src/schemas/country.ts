import { z } from 'zod';

/**
 * A country (admin0). `id` is its ISO 3166-1 alpha-2 code, e.g. "US".
 * `geonameId` and `population` come from GeoNames' `countryInfo.txt` and are
 * optional so simpler sources can supply just `{ id, name }`.
 */
export const CountrySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  geonameId: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .optional(),
  population: z.number().int().nonnegative().optional(),
});

export type Country = z.infer<typeof CountrySchema>;
