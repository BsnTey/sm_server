import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const EasyItemSchema = z.object({
    todo: z.string(),
    name: z.string(),
    active: z.boolean(),
});

const CourseSchema = z.object({
    id: z.number(),
    name: z.string(),
    count: z.number(),
    active: z.boolean(),
});

const HeavyItemSchema = EasyItemSchema.extend({
    courses: z.array(CourseSchema),
});

const DifficultyLevelItemSchema = z.object({
    easy: z.array(EasyItemSchema),
    heavy: z.array(HeavyItemSchema),
});

const ZennoConfigSchema = z.object({
    mobile: DifficultyLevelItemSchema,
});

export namespace ZennoConfigCommand {
    export const RequestSchema = ZennoConfigSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = ZennoConfigSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class ZennoConfigDto extends createZodDto(ZennoConfigCommand.RequestSchema) {}
