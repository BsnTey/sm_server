import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ProductCheckingRequestSchema = z.object({
    telegramId: z.string(),
    productId: z.string().min(1, 'productId обязателен'),
});

const ProductCheckingResponseSchema = z.object({});

export namespace ProductCheckingCommand {
    export const RequestSchema = ProductCheckingRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = ProductCheckingResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class ProductCheckingRequestDto extends createZodDto(ProductCheckingCommand.RequestSchema) {}
export class ProductCheckingResponseDto extends createZodDto(ProductCheckingCommand.ResponseSchema) {}
