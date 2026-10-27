import { z } from "zod";
const positive = z.number().finite().positive();
export const DiameterSchema = z.object({
  coin_diameter_px: positive,
  pixels_per_mm: positive,
  quill_width_px: positive,
  quill_diameter_mm: z.number().finite().nonnegative(),
  raw_diameter_mm: z.number().finite().nonnegative().optional(),
  calibrated_diameter_mm: z.number().finite().nonnegative().optional(),
  diameter_grade: z.enum([
    "Alba",
    "C5 Special",
    "C5",
    "C4",
    "M5",
    "M4",
    "H1",
    "H2",
    "Manual review",
  ]),
  valid_rows: z.number().int().min(8),
  diagnostic_overlay: z.string().startsWith("data:image/png;base64,"),
});
export type DiameterResult = z.infer<typeof DiameterSchema>;
