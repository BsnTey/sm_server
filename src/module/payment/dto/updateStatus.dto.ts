import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPayment } from '@prisma/client';

const StatusRequestSchema = z.object({
    status: z.enum([
        StatusPayment.Created,
        StatusPayment.Transfered,
        StatusPayment.Completed,
        StatusPayment.Cancelled,
        StatusPayment.Proceedings,
    ]),
});

export namespace StatusCommand {
    export const RequestSchema = StatusRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class StatusRequestDto extends createZodDto(StatusCommand.RequestSchema) {}
