import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CourseWorkService } from './services/courses.service';
import { CoursePurchaseService } from './services/course-purchase.service';
import { BottModule } from '../bott/bott.module';
import { PaymentModule } from '../payment/payment.module';
import { UserModule } from '../user/user.module';
import { CoursesController } from './courses.controller';
import { CourseAnswersRepository } from './repositories/course-answers.repository';
import { CourseOrchestratorService } from './services/course-orchestrator.service';
import { CourseFlowWorker } from './workers/course-flow.worker';

@Module({
    imports: [AccountModule, BottModule, PaymentModule, UserModule],
    controllers: [CoursesController],
    providers: [CoursePurchaseService, CourseWorkService, CourseFlowWorker, CourseOrchestratorService, CourseAnswersRepository],
    exports: [CourseWorkService, CoursePurchaseService],
})
export class CourseModule {}
