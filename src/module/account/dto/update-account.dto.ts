import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateAccountRequestSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    xUserId: z.string(),
    deviceId: z.string().uuid(),
    installationId: z.string().uuid(),
    expiresIn: z.string(),
});

const UpdateAccountResponseSchema = z.object({});

export namespace UpdateAccountCommand {
    export const RequestSchema = UpdateAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdateAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdateAccountRequestDto extends createZodDto(UpdateAccountCommand.RequestSchema) {}
export class UpdateAccountResponseDto extends createZodDto(UpdateAccountCommand.ResponseSchema) {}
