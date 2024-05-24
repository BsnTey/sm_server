import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const OrderParamsSchema = z.object({
    accountId: z.string().uuid(),
    orderNumber: z.string().regex(/^\d{7,8}-\d{6}$/, { message: 'Invalid numberOrder format' }),
});

export namespace GetOrderCommand {
    export const RequestSchema = OrderParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class OrderParamsDto extends createZodDto(GetOrderCommand.RequestSchema) {}
