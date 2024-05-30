import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddingAccountRequestSchema = z.object({
    accountId: z.string().uuid(),
    email: z.string().email(),
    passImap: z.string(),
    passEmail: z.string(),
    cookie: z.preprocess(val => (typeof val === 'string' ? decodeURIComponent(val.replace(/\+/g, ' ')) : val), z.string()),
    accessToken: z.string(),
    refreshToken: z.string(),
    xUserId: z.string(),
    deviceId: z.string().uuid(),
    installationId: z.string().uuid(),
    expiresIn: z.string(),
    bonusCount: z.string(),
    isOnlyAccessOrder: z.string(),
});

const AddingAccountResponseSchema = z.object({});

export namespace AddingAccountCommand {
    export const RequestSchema = AddingAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = AddingAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class AddingAccountRequestDto extends createZodDto(AddingAccountCommand.RequestSchema) {}
export class AddingAccountResponseDto extends createZodDto(AddingAccountCommand.ResponseSchema) {}
