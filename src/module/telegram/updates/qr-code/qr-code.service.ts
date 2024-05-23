import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class QrCodeService {
    private cropCenter = async (imageBuffer: Buffer, cropWidth: number, cropHeight: number): Promise<Buffer> => {
        const { width, height } = await sharp(imageBuffer).metadata();

        if (!width || !height) {
            throw new Error('Could not retrieve image metadata');
        }

        const validCropWidth = Math.min(cropWidth, width);
        const validCropHeight = Math.min(cropHeight, height);

        const left = (width - validCropWidth) / 2;
        const top = (height - validCropHeight) / 2;

        return sharp(imageBuffer)
            .extract({ left: Math.round(left), top: Math.round(top), width: validCropWidth, height: validCropHeight })
            .toBuffer();
    };

    public generateQrCode = async (qrCode: string): Promise<Buffer> => {
        const filePath = join(process.cwd(), 'src/module/telegram/updates/qr-code/back_img.png');
        const back_img = fs.readFileSync(filePath);

        const qr_img = await QRCode.toBuffer(qrCode, { scale: 12 });
        const cropped_qr_img = await this.cropCenter(qr_img, 500, 500);

        return await sharp(back_img)
            .composite([{ input: cropped_qr_img, top: 680, left: 290 }])
            .toBuffer();
    };
}
