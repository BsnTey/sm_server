import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdatingTokenAccountRequestSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.string(),
});

const UpdatingTokenAccountResponseSchema = z.object({});

export namespace UpdatingTokenAccountCommand {
    export const RequestSchema = UpdatingTokenAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingTokenAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingAccountRequestDto extends createZodDto(UpdatingTokenAccountCommand.RequestSchema) {}
export class UpdatingAccountResponseDto extends createZodDto(UpdatingTokenAccountCommand.ResponseSchema) {}
