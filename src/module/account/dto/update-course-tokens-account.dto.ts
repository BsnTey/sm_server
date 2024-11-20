import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatusEnum } from './create-account.dto';

const UpdatingCourseTokenAccountRequestSchema = z.object({
    accessTokenCourse: z.string(),
    refreshTokenCourse: z.string(),
    statusCourse: CourseStatusEnum,
    userGateToken: z.string(),
});

const UpdatingCourseTokenAccountResponseSchema = z.object({});

export namespace UpdatingCourseTokenAccountCommand {
    export const RequestSchema = UpdatingCourseTokenAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingCourseTokenAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingCourseTokensAccountRequestDto extends createZodDto(UpdatingCourseTokenAccountCommand.RequestSchema) {}
export class UpdatingCourseTokensAccountResponseDto extends createZodDto(UpdatingCourseTokenAccountCommand.ResponseSchema) {}
