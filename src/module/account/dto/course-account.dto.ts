import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatusEnum } from './create-account.dto';

const CourseIdAccountRequestSchema = z.object({
    courseId: CourseStatusEnum,
});

const CourseIdAccountResponseSchema = z.object({});

export namespace CourseIdAccountCommand {
    export const RequestSchema = CourseIdAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = CourseIdAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class CourseIdAccountRequestDto extends createZodDto(CourseIdAccountCommand.RequestSchema) {}
export class CourseIdAccountResponseDto extends createZodDto(CourseIdAccountCommand.ResponseSchema) {}
