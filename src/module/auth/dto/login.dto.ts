import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UserLoginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const UserLoginResponseSchema = z.object({
    accessToken: z.string(),
});

export namespace UserLoginCommand {
    export const RequestSchema = UserLoginRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UserLoginResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class LoginDto extends createZodDto(UserLoginCommand.RequestSchema) {}

export class LoginResponseDto extends createZodDto(UserLoginCommand.ResponseSchema) {}
