import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api');
    app.enableCors();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.listen(3001);
}
bootstrap();
