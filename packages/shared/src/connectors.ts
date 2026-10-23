import { z } from "zod";

export const customConnectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  hasToken: z.boolean(),
  createdAt: z.string(),
});
export type CustomConnector = z.infer<typeof customConnectorSchema>;
