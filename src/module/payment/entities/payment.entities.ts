import { PaymentOrder as PaymentOrderModel, StatusPayment } from '@prisma/client';

export class PaymentOrderEntity implements PaymentOrderModel {
    id: string; // UUID
    transactionId: number | null;
    amount: number;
    amountCredited: number;
    status: StatusPayment;
    receiptUrl: string | null;
    isPositive: boolean | null;
    completedAt: Date | null;
    userTelegramId: string;
    createdAt: Date;
    updatedAt: Date;

    constructor(paymentOrder: PaymentOrderModel) {
        Object.assign(this, paymentOrder);
        return this;
    }
}
