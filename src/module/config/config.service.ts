import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigAppService {
    getConfigExtension() {
        return {
            version: '3.6.2',
        };
    }

    getConfigExtensionV1() {
        return {
            latestVersion: '3.6.3',
            minSupportedVersion: '3.6.0',
        };
    }
}
