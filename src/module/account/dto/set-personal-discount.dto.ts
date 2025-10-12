import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SetPersonalDiscountAccountRequestSchema = z.object({
    telegramId: z.string(),
    personalDiscounts: z.array(z.string()).min(1).max(10),
});

export namespace SetPersonalDiscountAccountCommand {
    export const RequestSchema = SetPersonalDiscountAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class SetPersonalDiscountAccountRequestDto extends createZodDto(SetPersonalDiscountAccountCommand.RequestSchema) {}
