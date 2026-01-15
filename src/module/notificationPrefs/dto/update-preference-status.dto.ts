import { createZodDto } from 'nestjs-zod';
import { nativeEnum, z } from 'zod';
import { OrderStatus } from '@prisma/client';

const UpdatingPreferenceStatusRequestSchema = z.object({
    status: z.array(nativeEnum(OrderStatus)),
});

const UpdatingPreferenceStatusResponseSchema = z.object({});

export namespace UpdatingPreferenceStatusCommand {
    export const RequestSchema = UpdatingPreferenceStatusRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingPreferenceStatusResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingPreferenceStatusRequestDto extends createZodDto(UpdatingPreferenceStatusCommand.RequestSchema) {}
export class UpdatingPreferenceStatusResponseDto extends createZodDto(UpdatingPreferenceStatusCommand.ResponseSchema) {}
