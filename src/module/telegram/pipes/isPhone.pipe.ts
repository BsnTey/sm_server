import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_FIRST_NAME, ERROR_NUMBER_PHONE } from '../constants/error.constant';
import { isPhone } from '../utils/isPhone.utils';
import { isName } from '../utils/isString.utils';
import { PhoneName } from '../interfaces/person.interface';

@Injectable()
export class isPhonePipe implements PipeTransform<string> {
    transform(phone: string, metadata: ArgumentMetadata): string {
        const validPhone = isPhone(phone);
        if (validPhone) return validPhone;

        throw new BadRequestException(ERROR_NUMBER_PHONE);
    }
}

@Injectable()
export class isPhoneNamePipe implements PipeTransform<string> {
    transform(phoneName: string, metadata: ArgumentMetadata): PhoneName {
        const [phone, name] = phoneName.split(' ');
        const validPhone = isPhone(phone);
        if (name) {
            const isValidName = isName(name);
            if (!isValidName) throw new BadRequestException(ERROR_FIRST_NAME);
        }

        if (!validPhone) throw new BadRequestException(ERROR_NUMBER_PHONE);

        return {
            phone,
            name,
        };
    }
}
