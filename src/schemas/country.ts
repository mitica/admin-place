import { z } from 'zod';

/** A country (admin0). `id` is its ISO 3166-1 alpha-2 code, e.g. "US". */
export const CountrySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type Country = z.infer<typeof CountrySchema>;
