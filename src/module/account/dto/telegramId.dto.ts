import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TelegramIdParamsSchema = z.object({
    telegramId: z.string(),
});

export namespace TelegramIdCommand {
    export const RequestSchema = TelegramIdParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class TelegramIdParamsDto extends createZodDto(TelegramIdCommand.RequestSchema) {}
