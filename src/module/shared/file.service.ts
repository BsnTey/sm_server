import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpService } from '../http/http.service';
import { fromBuffer } from 'pdf2pic';

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);

    private uploadDir = './public/receipts';

    constructor(private httpService: HttpService) {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Сохраняет файл из буфера в указанную директорию.
     * @param fileName Имя файла для сохранения.
     * @param fileBuffer Буфер с данными файла.
     */
    async saveFile(fileName: string, fileBuffer: Buffer): Promise<void> {
        const filePath = path.join(this.uploadDir, fileName);
        await fs.promises.writeFile(filePath, fileBuffer as any);
    }

    /**
     * Конвертирует PDF буфер в JPG буфер с использованием pdf2pic.
     * @param pdfBuffer Буфер PDF файла.
     * @param fileNameBase Основа имени файла без расширения.
     * @returns Буфер JPG изображения.
     */
    async convertPdfToJpg(pdfBuffer: Buffer, fileNameBase: string): Promise<Buffer> {
        const options = {
            density: 100,
            saveFilename: fileNameBase,
            savePath: this.uploadDir,
            format: 'jpg',
            width: 600,
            height: 600,
        };

        const converter = fromBuffer(pdfBuffer, options);

        const pageToConvertAsImage = 1;

        try {
            const result = await converter(pageToConvertAsImage, { responseType: 'buffer' });

            if (result && result.buffer) {
                return result.buffer; // Верни буфер
            } else {
                throw new Error('Результат не содержит буфер');
            }
        } catch (error) {
            this.logger.error('Ошибка при конвертации PDF в JPG:', error);
            throw new Error('Ошибка при конвертации PDF в изображение');
        }
    }

    /**
     * Сохраняет файл из Telegram через ссылку.
     * @param fileName Имя файла для сохранения.
     * @param fileLink Ссылка на файл.
     */
    async saveFileFromTg(fileName: string, fileLink: URL): Promise<void> {
        const filePath = path.join(this.uploadDir, fileName);

        // 1. Используем arraybuffer вместо stream
        const response = await this.httpService.get(fileLink.href, {
            responseType: 'arraybuffer',
        });

        // 2. Проверяем, что пришли данные
        if (!response.data) {
            throw new Error(`Пустой ответ при скачивании файла: ${fileLink.href}`);
        }

        // 3. Пишем буфер напрямую в файл
        // Важно: response.data может быть строкой или объектом буфера, приводим к Buffer
        const buffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);

        await fs.promises.writeFile(filePath, buffer as Uint8Array);
    }

    async downloadFile(fileUrl: string): Promise<Buffer> {
        try {
            const response = await this.httpService.get(fileUrl, {
                responseType: 'arraybuffer',
            });

            return Buffer.from(response.data);
        } catch {
            throw new Error('Не удалось скачать файл');
        }
    }
}
