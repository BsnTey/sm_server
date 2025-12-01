import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TGPersonalDiscountSchema = z.object({
    telegramId: z.string(),
});

export class TgPersonalDiscountDto extends createZodDto(TGPersonalDiscountSchema) {}
