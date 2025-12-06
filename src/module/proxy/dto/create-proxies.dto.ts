import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateProxyItemSchema = z.object({
    proxy: z.string(),
    expiresAt: z.coerce.date(),
});

const CreateProxiesSchema = z.object({
    proxies: z.array(CreateProxyItemSchema),
});

export class CreateProxiesDto extends createZodDto(CreateProxiesSchema) { }
