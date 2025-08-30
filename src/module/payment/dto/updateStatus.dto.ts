import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPayment } from '@prisma/client';

const StatusRequestSchema = z.object({
    status: z.nativeEnum(StatusPayment),
});

export namespace StatusCommand {
    export const RequestSchema = StatusRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class StatusRequestDto extends createZodDto(StatusCommand.RequestSchema) {}
