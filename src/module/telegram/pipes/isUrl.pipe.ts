import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_URL_LINK } from '../constants/error.constant';

@Injectable()
export class isUrlPipe implements PipeTransform<string> {
    transform(link: string, metadata: ArgumentMetadata): string {
        try {
            new URL(link.trim());
            const regex = /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/gi;
            const match = regex.exec(link.trim());
            if (match) {
                return match[1];
            }
        } catch (err) {
            console.log();
        }
        throw new BadRequestException(ERROR_URL_LINK);
    }
}
