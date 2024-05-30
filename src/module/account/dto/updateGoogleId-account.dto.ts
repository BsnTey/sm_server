import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateGoogleIdRequestSchema = z.object({
    googleId: z.string().optional(),
});

const UpdateGoogleIdResponseSchema = z.object({
    googleId: z.string(),
});

export namespace UpdateGoogleIdCommand {
    export const RequestSchema = UpdateGoogleIdRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdateGoogleIdResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdateGoogleIdRequestDto extends createZodDto(UpdateGoogleIdCommand.RequestSchema) {}
export class UpdateGoogleIdResponseDto extends createZodDto(UpdateGoogleIdCommand.ResponseSchema) {}
