import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AccountTelegramParamsSchema = z.object({
    accountId: z.string().uuid(),
    telegramId: z.string(),
});

export namespace AccountTelegramCommand {
    export const RequestSchema = AccountTelegramParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class AccountTelegramParamsDto extends createZodDto(AccountTelegramCommand.RequestSchema) {}
