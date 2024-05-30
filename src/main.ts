import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import './common/helpers/hbs.helper';
import { engine } from 'express-handlebars';
import { handlebarsHelpers } from '@common/helpers/hbs.helper';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    app.enableCors();
    app.useStaticAssets(join(__dirname, '..', 'public'));
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.engine(
        'hbs',
        engine({
            extname: 'hbs',
            helpers: handlebarsHelpers,
            defaultLayout: false,
        }),
    );
    const configService = app.get(ConfigService);

    const PORT = configService.getOrThrow('PORT', 3001);
    const HOST = configService.getOrThrow<string>('HOST', 'localhost');

    app.setViewEngine('hbs');
    await app.listen(PORT, HOST);
}
bootstrap();
