import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient().$extends({
    name: 'StatusHistoryExtension',
    query: {
        paymentOrder: {
            async update({ args, query }) {
                // Проверяем, изменяется ли статус
                const newStatus = args.data.status;

                // Выполняем обновление PaymentOrder
                const result = await query(args);

                if (newStatus) {
                    // Записываем историю изменения статуса
                    await prisma.paymentOrderStatusHistory.create({
                        data: {
                            paymentOrderId: result.id,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            //@ts-ignore
                            status: newStatus,
                        },
                    });
                }

                return result;
            },
        },
    },
});
