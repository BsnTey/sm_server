import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { ITelegramUser } from './interfaces/user-telegram.interface';
import { UserTelegram } from '@prisma/client';
import { UserTelegramEntity } from './entities/user-telegram.entity';

@Injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async createOrUpdateUserByTelegram({ telegramName, telegramId }: ITelegramUser): Promise<UserTelegram> {
        const existUser = await this.getUserByTelegramId(telegramId);
        if (!existUser) {
            return await this.createUserByTelegram({ telegramName, telegramId });
        }
        return await this.updateUserByTelegram({ telegramName, telegramId });
    }

    async getUserByTelegramId(telegramId: string): Promise<UserTelegram | null> {
        const existUser = await this.userRepository.getUserByTelegramId(telegramId);
        if (!existUser) {
            return null;
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
}
