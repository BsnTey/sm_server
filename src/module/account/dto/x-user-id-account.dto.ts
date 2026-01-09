import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const XUserIdParamsSchema = z.object({
    xUserId: z.string(),
});

export namespace XUserIdCommand {
    export const RequestSchema = XUserIdParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class XUserIdParamsDto extends createZodDto(XUserIdCommand.RequestSchema) {}
