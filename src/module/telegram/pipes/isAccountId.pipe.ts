import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import validate from 'uuid-validate';
import { ERROR_ACCOUNT_ID } from '../constants/error.constant';

@Injectable()
export class isAccountIdPipe implements PipeTransform<string> {
    transform(uuid: string, metadata: ArgumentMetadata): string {
        if (!validate(uuid)) {
            throw new BadRequestException(ERROR_ACCOUNT_ID);
        }
        return uuid.trim();
    }
}
