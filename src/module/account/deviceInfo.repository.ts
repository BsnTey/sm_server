import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { DeviceInfoEntity } from './entities/deviceInfo.entity';
import { ICreateDeviceInfo, IUpdateDeviceInfo } from './interfaces/deviceInfo.interface';

@Injectable()
export class DeviceInfoRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: ICreateDeviceInfo): Promise<DeviceInfoEntity> {
        const deviceInfo = await this.prisma.deviceInfo.create({ data });
        return new DeviceInfoEntity(deviceInfo);
    }

    async update(accountId: string, data: IUpdateDeviceInfo): Promise<DeviceInfoEntity> {
        const deviceInfo = await this.prisma.deviceInfo.update({
            where: { accountId },
            data,
        });

        return new DeviceInfoEntity(deviceInfo);
    }

    async findByAccountId(accountId: string): Promise<DeviceInfoEntity | null> {
        const deviceInfo = await this.prisma.deviceInfo.findUnique({
            where: { accountId },
        });

        if (!deviceInfo) {
            return null;
        }

        return new DeviceInfoEntity(deviceInfo);
    }

    async exists(accountId: string): Promise<boolean> {
        const count = await this.prisma.deviceInfo.count({
            where: { accountId },
        });

        return count > 0;
    }

    async delete(accountId: string): Promise<DeviceInfoEntity> {
        const deviceInfo = await this.prisma.deviceInfo.delete({
            where: { accountId },
        });

        return new DeviceInfoEntity(deviceInfo);
    }
}
