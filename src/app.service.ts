import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHello() {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: "750126398" },
      select: {
          telegramName: true,
          countBonuses: true,
          isBan: true,
      },
  })
    console.log(user.countBonuses);

  }
}
