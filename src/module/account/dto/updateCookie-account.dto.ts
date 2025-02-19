import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdatingCookieAccountRequestSchema = z.object({
    cookie: z.preprocess(val => (typeof val === 'string' ? decodeURIComponent(val.replace(/\+/g, ' ')) : val), z.string()),
});

const UpdatingCookieAccountResponseSchema = z.object({});

export namespace UpdatingCookieAccountCommand {
    export const RequestSchema = UpdatingCookieAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingCookieAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingCookieRequestDto extends createZodDto(UpdatingCookieAccountCommand.RequestSchema) {}
export class UpdatingCookieResponseDto extends createZodDto(UpdatingCookieAccountCommand.ResponseSchema) {}
