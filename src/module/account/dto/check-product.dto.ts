import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CheckProductRequestSchema = z.object({
    telegramId: z.string(),
    productId: z.string(),
    nodeId: z.array(z.string()),
});

const CheckProductResponseSchema = z.object({});

export namespace CheckProductCommand {
    export const RequestSchema = CheckProductRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = CheckProductResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class CheckProductRequestDto extends createZodDto(CheckProductCommand.RequestSchema) {}
export class CheckProductResponseDto extends createZodDto(CheckProductCommand.ResponseSchema) {}
