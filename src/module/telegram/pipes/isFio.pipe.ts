import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_EMAIL, ERROR_FIO, ERROR_FIRST_NAME, ERROR_LAST_NAME, ERROR_NUMBER_PHONE } from '../constants/error.constant';
import { isPhone } from '../utils/isPhone.utils';
import { IRecipient } from '../../account/interfaces/account.interface';
import * as emailValidator from 'email-validator';

@Injectable()
export class isFioPipe implements PipeTransform<string> {
    transform(dataFio: string, metadata: ArgumentMetadata): IRecipient {
        let firstName, lastName, email, number;
        try {
            [firstName, lastName, email, number] = dataFio.split(' ');
        } catch (err) {
            throw new BadRequestException(ERROR_FIO);
        }

        if (!firstName.match(/[а-яёА-ЯЁ]+/g)) throw new BadRequestException(ERROR_FIRST_NAME);

        if (!lastName.match(/[а-яёА-ЯЁ]+/g)) throw new BadRequestException(ERROR_LAST_NAME);

        if (!emailValidator.validate(email)) {
            throw new BadRequestException(ERROR_EMAIL);
        }

        const validPhone = isPhone(number);
        if (!validPhone) throw new BadRequestException(ERROR_NUMBER_PHONE);

        return {
            firstName,
            lastName,
            email,
            number: validPhone,
        };
    }
}
