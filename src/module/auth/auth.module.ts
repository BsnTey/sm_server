// import { Module } from '@nestjs/common';
// import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';
// import { PassportModule } from '@nestjs/passport';
// import { CqrsModule } from '@nestjs/cqrs';
// import { AccessStrategy } from './strategy/access.strategy';
// import { JwtModule } from '@nestjs/jwt';
// import { getJWTConfig } from '@common/jwt/jwt.config';
//
// @Module({
//     imports: [CqrsModule, PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.registerAsync(getJWTConfig())],
//     providers: [AuthService, AccessStrategy],
//     controllers: [AuthController],
//     exports: [PassportModule, AuthService],
// })
// export class AuthModule {}
