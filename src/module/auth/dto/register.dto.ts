import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const minAge = 7;
const currentYear = new Date().getFullYear();

const UserRegisterRequestSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    birthDay: z
        .string()
        .optional()
        .refine(
            date => {
                if (date) {
                    const formDateBirthDay = new Date(date);
                    const age = currentYear - formDateBirthDay.getFullYear();
                    return age >= 7;
                }
                return true;
            },
            { message: `Пользователь должен быть старше ${minAge} лет` },
        )
        .transform(date => (date ? new Date(date) : null)),
    password: z
        .string()
        .min(8)
        .regex(/^(?=.*\d).+$/),
});

const UserRegisterResponseSchema = z.object({
    accessToken: z.string(),
});

export namespace UserRegisterCommand {
    export const RequestSchema = UserRegisterRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UserRegisterResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class RegisterDto extends createZodDto(UserRegisterCommand.RequestSchema) {}

export class RegisterResponseDto extends createZodDto(UserRegisterCommand.ResponseSchema) {}
