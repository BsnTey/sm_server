import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_NUMBER_PHONE } from '../constants/error.constant';

@Injectable()
export class isPhonePipe implements PipeTransform<string> {
    transform(phone: string, metadata: ArgumentMetadata): string {
        const regex1 = new RegExp('^7\\d{10}$');
        const regex2 = new RegExp('^8\\d{10}$');
        const regex3 = new RegExp('^\\+7\\d{10}$');
        const regex4 = new RegExp('^9\\d{9}$');

        if (regex1.test(phone) || regex2.test(phone)) {
            return phone.trim().substring(1);
        } else if (regex3.test(phone)) {
            return phone.trim().substring(2);
        } else if (regex4.test(phone)) {
            return phone.trim();
        }

        throw new BadRequestException(ERROR_NUMBER_PHONE);
    }
}
