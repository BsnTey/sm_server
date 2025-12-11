import { Logger, Provider } from '@nestjs/common';
import { AmqpConnectionManager, connect } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';

export const RABBIT_MQ = 'RABBIT_MQ';

export const RABBIT_MQ_CONNECTION = 'RABBIT_MQ_CONNECTION';

export const brokerProvider: Provider = {
    provide: RABBIT_MQ_CONNECTION,
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RabbitConnection');
        const connectionUrlRabbit = configService.getOrThrow('RABBITMQ_URL');

        try {
            const connection: AmqpConnectionManager = connect([connectionUrlRabbit]);

            connection.on('connect', () => logger.log('✅ RabbitMQ: Соединение установлено'));
            connection.on('disconnect', (err: any) => logger.error('❌ RabbitMQ: Соединение потеряно', err));

            return connection;
        } catch (error) {
            logger.error('❌ Ошибка при инициализации RabbitMQ:', error);
            throw error;
        }
    },
    inject: [ConfigService],
};
