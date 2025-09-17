import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import './common/helpers/hbs.helper';
import { engine } from 'express-handlebars';
import { handlebarsHelpers } from '@common/helpers/hbs.helper';
import { ConfigService } from '@nestjs/config';
import { DEVELOPMENT_STRATEGY, PinoService, PRODUCTION_STRATEGY } from './module/logger';
import { APP_NAME, APP_VERSION } from './app.constants';

async function bootstrap() {
    const pinoStrategy = process.env.NODE_ENV === 'production' ? PRODUCTION_STRATEGY : DEVELOPMENT_STRATEGY;
    const logger = new PinoService(pinoStrategy);

    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
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
    app.enableShutdownHooks();
    await app.listen(PORT, HOST);

    const context = 'Bootstrap';
    logger.log(`Listening on ${JSON.stringify(app.getHttpServer().address())}`, context);
    logger.log(`Application "${APP_NAME}" version ${APP_VERSION} has started`, context);
}
bootstrap();
