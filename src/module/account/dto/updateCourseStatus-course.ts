import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatusEnum } from './create-account.dto';

const UpdateCourseStatusRequestSchema = z.object({
    courseId: z.string(),
    status: CourseStatusEnum,
});

const UpdateCourseStatusResponseSchema = z.object({});

export namespace UpdatingCourseStatusAccountCommand {
    export const RequestSchema = UpdateCourseStatusRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdateCourseStatusResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdateCourseStatusRequestDto extends createZodDto(UpdatingCourseStatusAccountCommand.RequestSchema) {}
export class UpdateCourseStatusResponseDto extends createZodDto(UpdatingCourseStatusAccountCommand.ResponseSchema) {}
