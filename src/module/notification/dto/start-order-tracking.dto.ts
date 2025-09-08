import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StartOrderTrackingSchema = z.object({
    telegramId: z.string().min(1),
    accountId: z.string().uuid(),
    orderNumber: z.string().min(1),
});

export class StartOrderTrackingRequestDto extends createZodDto(StartOrderTrackingSchema) {}
export class StartOrderTrackingResponseDto {
    accepted: boolean = true;
}
