import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPayment } from '@prisma/client';

export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
});
export type Pagination = z.infer<typeof PaginationSchema>;
export class PaginationDto extends createZodDto(PaginationSchema) {}

export const FilterStatusPaymentSchema = z.object({
    status: z.nativeEnum(StatusPayment).optional(),
});
export type FilterStatusPayment = z.infer<typeof FilterStatusPaymentSchema>;
export class FilterStatusPaymentDto extends createZodDto(FilterStatusPaymentSchema) {}

export const GetPaymentOrdersQuerySchema = PaginationSchema.merge(FilterStatusPaymentSchema);
export class GetPaymentOrdersQueryDto extends createZodDto(GetPaymentOrdersQuerySchema) {}
