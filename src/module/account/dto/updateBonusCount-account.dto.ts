import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdatingBonusCountAccountRequestSchema = z.object({
    bonusCount: z.preprocess(val => parseInt(val as string, 10), z.number()),
});

const UpdatingBonusCountAccountResponseSchema = z.object({});

export namespace UpdatingBonusCountAccountCommand {
    export const RequestSchema = UpdatingBonusCountAccountRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = UpdatingBonusCountAccountResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class UpdatingBonusCountRequestDto extends createZodDto(UpdatingBonusCountAccountCommand.RequestSchema) {}
export class UpdatingBonusCountResponseDto extends createZodDto(UpdatingBonusCountAccountCommand.ResponseSchema) {}
