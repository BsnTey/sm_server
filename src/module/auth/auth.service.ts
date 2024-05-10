import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    // constructor(
    //     private readonly commandBus: CommandBus,
    //     private readonly queryBus: QueryBus,
    //     private jwtService: JwtService,
    // ) {}
    //
    // private createJwtPayload(user: IUserJwtPayload): IJWTPayload {
    //     return {
    //         sub: user.uuid,
    //         role: user.role,
    //     };
    // }
    //
    // private createJwtToken(payload: object): string {
    //     return this.jwtService.sign(payload);
    // }
    //
    // async register(regDto: RegisterDto): Promise<RegisterResponseDto> {
    //     const { email, password, name, birthDay } = regDto;
    //
    //     const existUser = await this.queryBus.execute<GetUserByEmailQuery, UserEntity>(new GetUserByEmailQuery(email));
    //     if (existUser) {
    //         throw new BadRequestException(ALREADY_REGISTERED_ERROR);
    //     }
    //     const passwordHash = await AuthenticationProvider.generateHash(password);
    //
    //     const createdUser = await this.commandBus.execute<CreateUserCommand, User>(
    //         new CreateUserCommand(email, name, passwordHash, birthDay),
    //     );
    //     const payload = this.createJwtPayload(createdUser);
    //
    //     const accessToken = this.createJwtToken(payload);
    //     return { accessToken };
    // }
    //
    // async login(logDto: LoginDto): Promise<LoginResponseDto> {
    //     const { email, password } = logDto;
    //
    //     const existUser = await this.queryBus.execute<GetUserByEmailQuery, UserEntity>(new GetUserByEmailQuery(email));
    //     if (!existUser) {
    //         throw new BadRequestException(USER_NOT_FOUND_ERROR);
    //     }
    //     const passwordHashUser = existUser.passwordHash;
    //
    //     const isPasswordValid = await AuthenticationProvider.validateHash(password, passwordHashUser);
    //     if (!isPasswordValid) {
    //         throw new BadRequestException(WRONG_PASSWORD_ERROR);
    //     }
    //     const payload = this.createJwtPayload(existUser);
    //
    //     const accessToken = this.createJwtToken(payload);
    //     return { accessToken };
    // }
}
