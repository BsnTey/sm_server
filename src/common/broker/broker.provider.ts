import { Logger, Provider } from '@nestjs/common';
import { AmqpConnectionManager, connect } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { ConfirmChannel } from 'amqplib';
import { DELAYED_EXCHANGE, DELAYED_EXCHANGE_ARGS, DELAYED_EXCHANGE_TYPE } from '@common/broker/rabbitmq.constants';

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

export const rabbitChannelProvider: Provider = {
    provide: RABBIT_MQ,
    useFactory: (connection: AmqpConnectionManager) => {
        return connection.createChannel({
            setup: async (ch: ConfirmChannel) => {
                await ch.assertExchange(DELAYED_EXCHANGE, DELAYED_EXCHANGE_TYPE, {
                    durable: true,
                    arguments: DELAYED_EXCHANGE_ARGS,
                });
            },
        });
    },
    inject: [RABBIT_MQ_CONNECTION],
};
