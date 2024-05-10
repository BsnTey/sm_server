import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { HasRoles, RoleEnum } from '@common/decorators/roles.decorator';
import { UserContext } from '../auth/types/user.context.interface';
import { User } from '@common/decorators/user.decorator';

@Controller('user')
export class UserController {
    constructor(private readonly usersService: UserService) {}

    @HasRoles([RoleEnum.USER, RoleEnum.ADMIN])
    @Get('profile')
    async getMyProfile(@User() user: UserContext): Promise<any> {
        return {};
    }
}
