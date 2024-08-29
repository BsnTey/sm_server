import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const GetAccessTokenCourseResponseSchema = z.object({
    accessTokenCourse: z.string(),
});

export namespace GetUserGateTokenCommand {
    export const ResponseSchema = GetAccessTokenCourseResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class AccessTokenCourseResponseDto extends createZodDto(GetUserGateTokenCommand.ResponseSchema) {}
