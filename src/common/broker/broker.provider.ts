import { Logger, Provider } from '@nestjs/common';
import { ChannelWrapper, connect } from 'amqp-connection-manager';
import { RABBIT_MQ_QUEUES_LIST } from './rabbitmq.queues';
import { ConfigService } from '@nestjs/config';
import { DELAYED_EXCHANGE, DELAYED_EXCHANGE_ARGS, DELAYED_EXCHANGE_TYPE } from '@common/broker/rabbitmq.constants';
import { ConfirmChannel } from 'amqplib';

export const RABBIT_MQ = 'RABBIT_MQ';

export const brokerProvider: Provider = {
    provide: RABBIT_MQ,
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RabbitProvider');
        const connectionUrlRabbit = configService.getOrThrow('RABBITMQ_URL');

        try {
            const channel: ChannelWrapper = connect([connectionUrlRabbit]).createChannel();

            channel.on('connect', () => logger.log('✅ RabbitMQ подключен'));
            channel.on('disconnect', (err: any) => logger.error('❌ RabbitMQ отключен', err));

            await channel.addSetup(async (raw: ConfirmChannel) => {
                raw.prefetch(1);

                await raw.assertExchange(DELAYED_EXCHANGE, DELAYED_EXCHANGE_TYPE, {
                    durable: true,
                    arguments: DELAYED_EXCHANGE_ARGS,
                });

                for (const queue of RABBIT_MQ_QUEUES_LIST) {
                    await raw.assertQueue(queue, { durable: true });
                    await raw.bindQueue(queue, DELAYED_EXCHANGE, queue);
                }
            });

            await channel.waitForConnect();
            return channel;
        } catch (error) {
            logger.error('❌ Ошибка при инициализации RabbitMQ:', error);
            throw error;
        }
    },
    inject: [ConfigService],
};
