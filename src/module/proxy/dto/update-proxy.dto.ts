import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProxySchema = z.object({
    proxy: z.string().trim().min(1).optional(),
    // ожидаем ISO-дату или timestamp -> превратим в Date
    expiresAt: z.coerce.date().optional(),
    // опционально: разблокировка/блокировка
    blockedAt: z.coerce.date().nullable().optional(),
});
export class UpdateProxyDto extends createZodDto(UpdateProxySchema) {}
