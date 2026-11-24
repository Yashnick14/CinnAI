import { z } from "zod";
export const MAX_LOGO_BYTES = 10 * 1024 * 1024;
export const MAX_LOGO_BASE64_LENGTH = 4 * Math.ceil(MAX_LOGO_BYTES / 3);
/** Compute decoded bytes so base64 padding cannot bypass the upload limit. */
export function logoByteLength(base64: string) {
  return (
    (base64.length * 3) / 4 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0)
  );
}
export const ReportSettingsSchema = z.object({
  company_name: z.string().max(120),
  address: z.string().max(400),
  phone: z.string().max(50),
  email: z.string().max(150),
  website: z.string().max(200).default(""),
  registration_number: z.string().max(80).default(""),
  include_non_export_quality: z.boolean().default(false),
  show_logo: z.boolean().default(true),
  show_company_name: z.boolean().default(true),
  show_address: z.boolean().default(true),
  show_phone: z.boolean().default(true),
  show_email: z.boolean().default(true),
  logo_data_url: z
    .string()
    .max(MAX_LOGO_BASE64_LENGTH + 23)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .refine(
      (value) => logoByteLength(value.split(",")[1] ?? "") <= MAX_LOGO_BYTES,
      "Choose a logo of 10 MB or smaller.",
    )
    .nullable(),
});
export type ReportSettings = z.infer<typeof ReportSettingsSchema>;
export const emptyReportSettings: ReportSettings = {
  company_name: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  registration_number: "",
  include_non_export_quality: false,
  show_logo: true,
  show_company_name: true,
  show_address: true,
  show_phone: true,
  show_email: true,
  logo_data_url: null,
};
