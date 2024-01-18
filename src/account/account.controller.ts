import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  async createAccount(@Body() accountDto: CreateAccountDto) {
    return this.accountService.createAccount(accountDto);
  }

  @Get(':id')
  async getAccount(@Param('id') id: string) {
    return 'This action returns all cats';
  }

  // @Put(':id')
  // updateAccount(@Param('id') id: string, @Body() updateCatDto: UpdateCatDto) {
  //   return `This action updates a #${id} cat`;
  // }
}
