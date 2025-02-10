import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { ITelegramUser } from './interfaces/user-telegram.interface';
import { UserTelegram } from '@prisma/client';
import { UserTelegramEntity } from './entities/user-telegram.entity';
import { CitySMEntity } from '../account/entities/citySM.entity';

@Injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async createOrUpdateUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram | void> {
        const existUser = await this.getUserByTelegramId(telegramId);
        if (!existUser) {
            return await this.createUserByTelegram({ telegramName, telegramId });
        }
        if (existUser.telegramName != telegramName) {
            return await this.updateUserByTelegram({ telegramName, telegramId });
        }
    }

    async getUserByTelegramId(telegramId: string): Promise<UserTelegram | null> {
        const existUser = await this.userRepository.getUserByTelegramId(telegramId);
        if (!existUser) {
            return null;
        }
        if (existUser.isBan) {
            throw new Error('Доступ запрещен');
        }
        return new UserTelegramEntity(existUser);
    }

    async createUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram> {
        const user = new UserTelegramEntity({ telegramName, telegramId });
        return this.userRepository.createUserByTelegram(user);
    }

    async updateUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram> {
        const user = new UserTelegramEntity({ telegramName, telegramId });
        return this.userRepository.updateUserByTelegram(user);
    }

    async getUserCities(telegramId: string): Promise<CitySMEntity[]> {
        const cities: any[] = await this.userRepository.getUserCities(telegramId);
        return cities.map(city => {
            return new CitySMEntity(city.city);
        });
    }

    async addUserCity(telegramId: string, cityId: string) {
        return await this.userRepository.addUserCity(telegramId, cityId);
    }

    async deleteUserCity(telegramId: string, cityId: string) {
        return await this.userRepository.deleteUserCity(telegramId, cityId);
    }
}
