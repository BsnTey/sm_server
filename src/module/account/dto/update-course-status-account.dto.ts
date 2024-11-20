import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatusEnum } from './create-account.dto';

const UpdatingCourseStatusAccountRequestSchema = z.object({
    statusCourse: CourseStatusEnum,
});

const UpdatingCourseStatusAccountResponseSchema = z.object({});

export namespace UpdatingCourseStatusAccountCommand {
    export const RequestSchema = UpdatingCourseStatusAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingCourseStatusAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingCourseStatusAccountRequestDto extends createZodDto(UpdatingCourseStatusAccountCommand.RequestSchema) {}
export class UpdatingCourseStatusAccountResponseDto extends createZodDto(UpdatingCourseStatusAccountCommand.ResponseSchema) {}
