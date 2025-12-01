import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DeleteAccountRequestSchema = z.object({
    telegramId: z.string().min(1, 'telegramId обязателен'),
    accountId: z.string().min(1, 'номер аккаунта обязателен'),
});

const DeleteAccountResponseSchema = z.object({});

export namespace DeleteAccountCommand {
    export const RequestSchema = DeleteAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = DeleteAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class DeleteAccountRequestDto extends createZodDto(DeleteAccountCommand.RequestSchema) {}
export class DeleteAccountResponseDto extends createZodDto(DeleteAccountCommand.ResponseSchema) {}
