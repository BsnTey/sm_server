import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IdRequestSchema = z.object({
    id: z.string(),
});

const IdResponseSchema = z.object({});

export namespace IdCommand {
    export const RequestSchema = IdRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = IdResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class IdRequestDto extends createZodDto(IdCommand.RequestSchema) {}

export class IdResponseDto extends createZodDto(IdCommand.ResponseSchema) {}
