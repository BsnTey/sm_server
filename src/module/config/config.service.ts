import { Injectable } from '@nestjs/common';
import { extensionVersion } from '@common/constants/extension';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigAppService {
    private changeBot = this.configService.getOrThrow<string>('CHANGE_BOT_TELEGRAM');

    constructor(private configService: ConfigService) {}

    getConfigExtension() {
        return {
            version: '3.6.3',
        };
    }

    getConfigExtensionV1() {
        return {
            ...extensionVersion,
            updateUrl: this.getExtensionLink(),
        };
    }

    getExtensionLink(): string {
        return `https://t.me/${this.changeBot}?start=extension`;
    }
}
