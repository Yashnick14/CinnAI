import { z } from "zod";
export const ReportSettingsSchema = z.object({
  company_name: z.string().max(120),
  address: z.string().max(400),
  phone: z.string().max(50),
  email: z.string().max(150),
  website: z.string().max(200),
  registration_number: z.string().max(80),
  logo_data_url: z
    .string()
    .max(2800000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
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
  logo_data_url: null,
};
