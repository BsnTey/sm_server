import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_NUMBER_PHONE } from '../constants/error.constant';
import { isPhone } from '../utils/isPhone.utils';

@Injectable()
export class isPhonePipe implements PipeTransform<string> {
    transform(phone: string, metadata: ArgumentMetadata): string {
        const validPhone = isPhone(phone);
        if (validPhone) return validPhone;

        throw new BadRequestException(ERROR_NUMBER_PHONE);
    }
}
