import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CommissionType, TypeCalculate } from '@prisma/client';

const CreateTemplateRequestSchema = z.object({
    name: z.string(),
    template: z.string(),
    commissionType: z.nativeEnum(CommissionType).optional(),
    calculateType: z.nativeEnum(TypeCalculate).optional(),
    commissionRate: z.number(),
    roundTo: z.number(),
    userTelegramId: z.string(),
});

const CreateTemplateResponseSchema = z.object({});

export namespace CreateTemplateCommand {
    export const RequestSchema = CreateTemplateRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = CreateTemplateResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class CreateTemplateRequestDto extends createZodDto(CreateTemplateCommand.RequestSchema) {}

export class CreateTemplateResponseDto extends createZodDto(CreateTemplateCommand.ResponseSchema) {}
