import { z } from 'zod'
import { ORBIT_PROVIDER_IDS } from './orbit-provider-catalog.js'

export const providerSelectionSchema = z.object({
  allowedProviderIds: z.array(z.enum(ORBIT_PROVIDER_IDS)).min(1),
})
