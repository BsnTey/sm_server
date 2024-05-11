import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AccountService } from './account.service';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AddingAccountRequestDto, AddingAccountResponseDto } from './dto/create-account.dto';

@Controller('account')
export class AccountController {
    constructor(private accountService: AccountService) {}

    @HasZenno()
    @Post()
    @HttpCode(200)
    async addAccount(@Body() dto: AddingAccountRequestDto): Promise<AddingAccountResponseDto> {
        const account = await this.accountService.addingAccount(dto);
        return account ? 'success' : 'error';
    }
}
