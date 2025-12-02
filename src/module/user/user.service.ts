import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { ITelegramUser } from './interfaces/user-telegram.interface';
import { OrderStatus, UserTelegram } from '@prisma/client';
import { UserTelegramEntity } from './entities/user-telegram.entity';
import { CitySMEntity } from '../account/entities/citySM.entity';
import { RedisCacheService } from '../cache/cache.service';
import { getPrefsUserByTelegramIdKey, getUserByTelegramIdKey } from '../cache/cache.keys';

@Injectable()
export class UserService {
    private TTL_USER = 3_600;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly cacheService: RedisCacheService,
    ) {}

    async createOrUpdateUserByTelegram({ telegramName, telegramId }: ITelegramUser) {
        const existUser = await this.getUserByTelegramId(telegramId);
        if (!existUser) {
            return this.createUserByTelegram({ telegramName, telegramId });
        }
        if (existUser.telegramName != telegramName) {
            return this.updateUserByTelegram({ telegramName, telegramId });
        }
        return existUser;
    }

    async getUserByTelegramId(telegramId: string): Promise<UserTelegram | null> {
        const key = getUserByTelegramIdKey(telegramId);
        const cachedUser = await this.cacheService.get<UserTelegram>(key);
        if (cachedUser) {
            return new UserTelegramEntity(cachedUser);
        }

        const existUser = await this.userRepository.getUserByTelegramId(telegramId);
        if (!existUser) {
            return null;
        }
        if (existUser.isBan) {
            throw new Error('Доступ запрещен');
        }

        await this.cacheService.set(key, existUser, this.TTL_USER);
        return new UserTelegramEntity(existUser);
    }

    async createUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram> {
        const user = new UserTelegramEntity({ telegramName, telegramId });
        return this.userRepository.createUserByTelegram(user);
    }

    async updateUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram> {
        const user = new UserTelegramEntity({ telegramName, telegramId });
        await this.cacheService.del(getUserByTelegramIdKey(telegramId));
        await this.userRepository.updateUserByTelegram(user);
        const updatedUser = await this.getUserByTelegramId(telegramId);
        if (!updatedUser) {
            throw new Error('Ошибка при обновлении пользователя');
        }
        return updatedUser;
    }

    async getUserCities(telegramId: string): Promise<CitySMEntity[]> {
        const cities = await this.userRepository.getUserCities(telegramId);
        return cities.map(city => {
            return new CitySMEntity(city.city);
        });
    }

    async addUserCity(telegramId: string, cityId: string) {
        return await this.userRepository.addUserCity(telegramId, cityId);
    }

    async deleteUserCity(telegramId: string, cityId: string) {
        await this.cacheService.del(getUserByTelegramIdKey(telegramId));
        return await this.userRepository.deleteUserCity(telegramId, cityId);
    }

    async setNotificationPrefs(tgId: string, statuses: OrderStatus[]) {
        await this.userRepository.setNotificationPrefs(tgId, statuses);
    }

    async getNotificationPrefs(tgId: string) {
        return this.userRepository.getNotificationPrefs(tgId);
    }
}
