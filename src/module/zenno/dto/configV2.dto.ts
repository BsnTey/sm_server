import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CourseSchema = z.object({
    id: z.number(),
    name: z.string(),
    count: z.number(),
    active: z.boolean(),
});

const ItemSchema = z.object({
    activeId: z.string(),
    courses: z.array(CourseSchema),
});

const ZennoConfigSchema = z.object({
    config: ItemSchema,
});

export namespace ZennoConfigCommand {
    export const RequestSchema = ZennoConfigSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = ZennoConfigSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class ZennoConfigDtoV2 extends createZodDto(ZennoConfigCommand.RequestSchema) {}
