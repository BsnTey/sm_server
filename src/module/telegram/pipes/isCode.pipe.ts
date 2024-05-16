import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_CODE_PHONE } from '../constants/error.constant';

@Injectable()
export class isCodePipe implements PipeTransform<string> {
    transform(code: string, metadata: ArgumentMetadata): string {
        const regex = /^\d{4}$/;
        const codeTrim = code.trim();
        const isValidCode = regex.test(codeTrim);
        if (isValidCode) return codeTrim;

        throw new BadRequestException(ERROR_CODE_PHONE);
    }
}
