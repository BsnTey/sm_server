import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CheckProductRequestSchema = z.object({
    telegramId: z.string(),
    nodeId: z.array(z.string()),
});

export class PrepareProductCheckRequestDto extends createZodDto(CheckProductRequestSchema) {}
export type PrepareProductCheckRequest = z.infer<typeof CheckProductRequestSchema>;

export const CheckProductBatchRequestSchema = z.object({
    telegramId: z.string(),
    productId: z.string(),
    accountIds: z.array(z.string()).min(1).max(50),
});

export class CheckProductBatchRequestDto extends createZodDto(CheckProductBatchRequestSchema) {}
export type CheckProductBatchRequest = z.infer<typeof CheckProductBatchRequestSchema>;
