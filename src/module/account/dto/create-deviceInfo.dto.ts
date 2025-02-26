import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DeviceInfoRequestSchema = z.object({
    osVersion: z.string().min(1, 'Версия Android обязательна'),
    buildVersion: z.string().min(1, 'Версия сборки обязательна'),
    brand: z.string().min(1, 'Производитель устройства обязателен'),
    model: z.string().min(1, 'Модель устройства обязательна'),
    screenResolution: z.string().min(1, 'Разрешение экрана обязательно'),
    browserVersion: z.string().min(1, 'Версия браузера обязательна'),
    IP: z.string().min(1, 'IP обязателен'),
});

const DeviceInfoResponseSchema = z.object({});

export namespace DeviceInfoCommand {
    export const RequestSchema = DeviceInfoRequestSchema;
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = DeviceInfoResponseSchema;
    export type Response = z.infer<typeof ResponseSchema>;
}

export class DeviceInfoRequestDto extends createZodDto(DeviceInfoCommand.RequestSchema) {}
export class DeviceInfoResponseDto extends createZodDto(DeviceInfoCommand.ResponseSchema) {}
