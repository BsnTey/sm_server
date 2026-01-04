import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceInfoRequestDto } from './dto/create-deviceInfo.dto';
import { DeviceInfoRepository } from './deviceInfo.repository';
import { IDeviceInfo } from './interfaces/deviceInfo.interface';

@Injectable()
export class DeviceInfoService {
    constructor(private readonly deviceInfoRepository: DeviceInfoRepository) {}

    async addDeviceInfo(accountId: string, dto: DeviceInfoRequestDto) {
        const deviceInfoExists = await this.deviceInfoRepository.exists(accountId);
        if (deviceInfoExists) {
            throw new BadRequestException(`Информация об устройстве для аккаунта ${accountId} уже существует`);
        }

        const deviceInfo = await this.deviceInfoRepository.create({
            accountId,
            osVersion: dto.osVersion,
            buildVersion: dto.buildVersion,
            brand: dto.brand,
            model: dto.model,
            screenResolution: dto.screenResolution,
            browserVersion: dto.browserVersion,
            IP: dto.IP,
        });

        return deviceInfo.getDeviceParams();
    }

    async updateDeviceInfo(accountId: string, dto: DeviceInfoRequestDto) {
        const deviceInfoExists = await this.deviceInfoRepository.exists(accountId);
        if (deviceInfoExists) {
            throw new BadRequestException(`Информация об устройстве для аккаунта ${accountId} уже существует`);
        }

        const deviceInfo = await this.deviceInfoRepository.update(accountId, {
            osVersion: dto.osVersion,
            buildVersion: dto.buildVersion,
            brand: dto.brand,
            model: dto.model,
            screenResolution: dto.screenResolution,
            browserVersion: dto.browserVersion,
            IP: dto.IP,
        });

        return deviceInfo.getDeviceParams();
    }

    async getDeviceInfo(accountId: string): Promise<IDeviceInfo> {
        const deviceInfo = await this.deviceInfoRepository.findByAccountId(accountId);

        if (!deviceInfo) {
            throw new NotFoundException(`Информация об устройстве для аккаунта ${accountId} не найдена`);
        }

        return deviceInfo.getDeviceParams();
    }
}
