import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdatePushTokenRequestSchema = z.object({
    pushToken: z.string().optional(),
});

const UpdatePushTokenResponseSchema = z.object({
    pushToken: z.string(),
});

export namespace UpdatePushTokenCommand {
    export const RequestSchema = UpdatePushTokenRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatePushTokenResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatePushTokenRequestDto extends createZodDto(UpdatePushTokenCommand.RequestSchema) {}
export class UpdatePushTokenResponseDto extends createZodDto(UpdatePushTokenCommand.ResponseSchema) {}
