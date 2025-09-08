import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AccountIdParamsSchema = z.object({
    accountId: z.string().uuid(),
});
export class AccountIdParamsDto extends createZodDto(AccountIdParamsSchema) {}

export const GetAccountCredentialsResponseSchema = z.object({
    accountId: z.string().uuid(),
    email: z.string().email(),
    passEmail: z.string(),
    passImap: z.string(),
    cookie: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    xUserId: z.string(),
    deviceId: z.string().uuid(),
    installationId: z.string().uuid(),
    expiresInAccess: z.date(),
    expiresInRefresh: z.date(),
});
export class GetAccountCredentialsResponseDto extends createZodDto(GetAccountCredentialsResponseSchema) {}

const decodeCookie = z.preprocess(val => (typeof val === 'string' ? decodeURIComponent(val.replace(/\+/g, ' ')) : val), z.string());

export const UpdateAccountCredentialsRequestSchema = z
    .object({
        email: z.string().email().optional(),
        passEmail: z.string().optional(),
        passImap: z.string().optional(),
        cookie: decodeCookie.optional(),

        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
        xUserId: z.string().optional(),

        deviceId: z.string().uuid().optional(),
        installationId: z.string().uuid().optional(),

        expiresInAccess: z.coerce.date().optional(),
        expiresInRefresh: z.coerce.date().optional(),
    })
    .strict()
    .refine(data => Object.values(data).some(v => v !== undefined), { message: 'Передайте хотя бы одно поле для обновления' });

export class UpdateAccountCredentialsRequestDto extends createZodDto(UpdateAccountCredentialsRequestSchema) {}

export const UpdateAccountCredentialsResponseSchema = z.object({
    status: z.enum(['success', 'error']),
});
export class UpdateAccountCredentialsResponseDto extends createZodDto(UpdateAccountCredentialsResponseSchema) {}
