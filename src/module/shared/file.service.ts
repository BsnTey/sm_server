import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpService } from '../http/http.service';

@Injectable()
export class FileService {
    private uploadDir = './public/receipts';

    constructor(private httpService: HttpService) {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async saveFileFromTg(fileName: string, fileLink: URL): Promise<any> {
        // const filePath = path.join(__dirname, '..', 'receipts', fileName);
        const filePath = path.join(this.uploadDir, fileName);

        const response = await this.httpService.get(fileLink.href, { responseType: 'stream' });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
}
