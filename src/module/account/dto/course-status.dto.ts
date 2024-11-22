import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AccountIdParamsSchema = z.object({
    accountId: z.string().uuid(),
});

export namespace AccountIdCommand {
    export const RequestSchema = AccountIdParamsSchema;
    export type Request = z.infer<typeof RequestSchema>;
}

export class AccountIdParamsDto extends createZodDto(AccountIdCommand.RequestSchema) {}
