import { Prisma } from '@prisma/client';

export const statusHistoryExtension = Prisma.defineExtension({
    name: 'StatusHistoryExtension',
    query: {
        paymentOrder: {
            async update({ args, query, model }) {
                const newStatus = args.data.status;
                const result = await query(args);
                if (newStatus && typeof newStatus === 'string') {
                    await (model as any).parentClient.paymentOrderStatusHistory.create({
                        data: {
                            paymentOrderId: result.id,
                            status: newStatus,
                        },
                    });
                }
                return result;
            },
        },
    },
});