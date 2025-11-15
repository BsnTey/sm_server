import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigAppService {
    getConfigExtension() {
        return {
            version: '3.5.0',
        };
    }
}
