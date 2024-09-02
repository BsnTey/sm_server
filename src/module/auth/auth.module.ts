import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Module({
    // imports: [CqrsModule, PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.registerAsync(getJWTConfig())],
    // providers: [AuthService, AccessStrategy],
    controllers: [AuthController],
    // exports: [PassportModule, AuthService],
})
export class AuthModule {}
