import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetProxiesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
});
export class GetProxiesQueryDto extends createZodDto(GetProxiesQuerySchema) {}
