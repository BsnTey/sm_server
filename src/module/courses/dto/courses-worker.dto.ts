import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CourseWorkerApiRequestSchema = z.object({
    accountId: z.string().uuid(),
    courseIds: z.array(z.number()).optional(),
});

const CourseWorkerApiResponseSchema = z.object({});

export namespace CourseWorkerApiCommand {
    export const RequestSchema = CourseWorkerApiRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = CourseWorkerApiResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class CourseWorkerApiRequestDto extends createZodDto(CourseWorkerApiCommand.RequestSchema) {}
export class CourseWorkerApiResponseDto extends createZodDto(CourseWorkerApiCommand.ResponseSchema) {}
