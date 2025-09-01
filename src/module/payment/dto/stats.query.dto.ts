import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPayment } from '@prisma/client';

export const PaymentStatsQuerySchema = z.object({
    dayFrom: z.coerce.date().optional(),
    dayTo: z.coerce.date().optional(),

    monthFrom: z.coerce.date().optional(),
    monthTo: z.coerce.date().optional(),

    status: z.nativeEnum(StatusPayment).optional(),
});

export class PaymentStatsQueryDto extends createZodDto(PaymentStatsQuerySchema) {}
