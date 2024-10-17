import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { BottService } from '../bott/bott.service';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from '../bott/entities/headers-bot-t.entity';

@Module({
    controllers: [PaymentController],
    providers: [PaymentService, PaymentRepository, BottService, HttpService, BotTHeadersService],
})
export class PaymentModule {}
