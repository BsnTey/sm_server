import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IsEmailRequestSchema = z.object({
    email: z.string().email(),
});

const IsEmailResponseSchema = z.object({
    isEmail: z.boolean(),
});

export namespace IsEmailCommand {
    export const RequestSchema = IsEmailRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = IsEmailResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class IsEmailRequestDto extends createZodDto(IsEmailCommand.RequestSchema) {}
export class IsEmailResponseDto extends createZodDto(IsEmailCommand.ResponseSchema) {}
