import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPayment } from '@prisma/client';

export const PaymentStatsQuerySchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    status: z.nativeEnum(StatusPayment).optional(), // если не задан — считаем Transfered+Completed
});
export class PaymentStatsQueryDto extends createZodDto(PaymentStatsQuerySchema) {}
