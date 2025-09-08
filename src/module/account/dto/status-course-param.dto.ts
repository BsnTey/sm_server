import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CourseStatus } from '@prisma/client';

export const StatusCourseParamsSchema = z.object({
    status: z.nativeEnum(CourseStatus),
});

export namespace StatusCourseCommand {
    export const RequestSchema = StatusCourseParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class StatusCourseParamsDto extends createZodDto(StatusCourseCommand.RequestSchema) {}
