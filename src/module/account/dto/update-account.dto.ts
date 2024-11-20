import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatusEnum } from './create-account.dto';

const UpdateAccountRequestSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    xUserId: z.string(),
    deviceId: z.string().uuid(),
    installationId: z.string().uuid(),
    expiresIn: z.string(),
    accessTokenCourse: z.string(),
    refreshTokenCourse: z.string(),
    statusCourse: CourseStatusEnum,
    userGateToken: z.string(),
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
