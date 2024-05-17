import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_CITY } from '../constants/error.constant';

@Injectable()
export class isCityPipe implements PipeTransform<string> {
    transform(city: string, metadata: ArgumentMetadata): string {
        const regex = /[а-яёА-ЯЁ\s-]+$/;
        const citytrim = city.trim();
        const isValidCity = regex.test(citytrim);
        if (isValidCity) return citytrim;
        throw new BadRequestException(ERROR_CITY);
    }
}
