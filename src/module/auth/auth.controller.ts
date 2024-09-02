import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
    private ZENNO_HASH = this.configService.getOrThrow('ZENNO_HASH');

    // constructor(private readonly authService: AuthService) {}
    constructor(private configService: ConfigService) {}

    //
    // @Post('register')
    // async register(@Body() regDto: RegisterDto): Promise<RegisterResponseDto> {
    //     return await this.authService.register(regDto);
    // }
    //
    @HttpCode(200)
    @Post('login')
    async login(@Body() authDto: LoginDto): Promise<LoginResponseDto> {
        const status = this.ZENNO_HASH == authDto.key;
        if (status) return { key: this.ZENNO_HASH };
        throw new UnauthorizedException('Не правильный ключ');
    }
}
