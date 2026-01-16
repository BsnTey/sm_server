import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { courseViewing } from '../../../infrastructure/bullmq/bullmq.queues';
import { CourseOrchestratorService } from '../services/course-orchestrator.service';
import { AccountService } from '../../account/account.service';
import { CourseAnswersRepository } from '../repositories/course-answers.repository';
import { INotificationPort } from '@core/ports/notification.port';
import { RedisCacheService } from '../../cache/cache.service';
import { CourseFlowPayload, FlowJobType, WatchLessonPayload, PassTestPayload, BaseFlowPayload } from '../interfaces/course-queue.interface';

@Processor(courseViewing)
@Injectable()
export class CourseFlowWorker extends WorkerHost {
    private readonly logger = new Logger(CourseFlowWorker.name);

    constructor(
        private readonly orchestrator: CourseOrchestratorService,
        private readonly accountService: AccountService,
        private readonly answersRepo: CourseAnswersRepository,
        private readonly notificationService: INotificationPort,
        private readonly cacheService: RedisCacheService,
        @InjectQueue(courseViewing) private readonly viewingQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<CourseFlowPayload>): Promise<void> {
        const payload = job.data;
        const lockKey = `lock:flow:${payload.accountId}`;

        const lock = await this.cacheService.tryLock(lockKey, 30);
        if (!lock && payload.type === FlowJobType.DECIDE_NEXT) {
            this.logger.warn(`🛑 [Job ${job.id}] Лок занят для ${payload.accountId}. Пропускаем.`);
            return;
        }

        try {
            switch (payload.type) {
                case FlowJobType.DECIDE_NEXT:
                    await this.handleDecide(payload);
                    break;

                case FlowJobType.WATCH_LESSON:
                    await this.handleWatch(payload);
                    break;

                case FlowJobType.PASS_TEST:
                    await this.handleTest(payload);
                    break;

                case FlowJobType.FINISH:
                    await this.handleFinish(payload);
                    break;
            }
        } catch (e: any) {
            this.logger.error(`Ошибка в job ${job.id} (${payload.type}) для ${payload.accountId}: ${e.message}`);
            throw e;
        } finally {
            await this.cacheService.releaseLock(lockKey);
        }
    }

    private async handleDecide(payload: CourseFlowPayload) {
        const decision = await this.orchestrator.decideNextStep(payload);
        await this.scheduleNext(decision.nextPayload, decision.delay);
    }

    private async handleWatch(payload: WatchLessonPayload) {
        this.logger.log(`📺 Просмотр (API): ${payload.lessonTitle} для ${payload.accountId}`);

        // ВНИМАНИЕ: Мы уже подождали (delay) перед запуском этой джобы.
        const result = await this.accountService.watchingLessonApi(payload.accountId, {
            mnemocode: payload.mnemocode,
            lessonId: payload.lessonId,
            duration: payload.duration,
        });

        if (!result) throw new Error(`API viewing failed for ${payload.lessonId}`);

        await this.scheduleNext(
            {
                ...payload,
                type: FlowJobType.DECIDE_NEXT,
            },
            1000,
        );
    }

    private async handleTest(payload: PassTestPayload) {
        this.logger.log(`📝 Выполнение теста курса ${payload.currentCourseId} для ${payload.accountId}`);

        const mappedMnemo = this.answersRepo.getMnemocode(payload.currentCourseId, payload.mnemocode);
        const answers = this.answersRepo.getAnswers(mappedMnemo);

        const res = await this.accountService.passTest(payload.accountId, mappedMnemo, answers);
        if (!res?.success) throw new Error('Test API failed');

        this.logger.log(`✅ Тест пройден`);

        await this.scheduleNext(
            {
                ...payload,
                type: FlowJobType.DECIDE_NEXT,
            },
            2000,
        );
    }

    private async handleFinish(payload: BaseFlowPayload) {
        this.logger.log(`🏁 Flow закончен для ${payload.accountId}`);
        if (payload.telegramId) {
            await this.notificationService.notifyUser(payload.telegramId, '✅ Завершено. Проверьте баланс через пару минут.');
        }
    }

    private async scheduleNext(payload: CourseFlowPayload, delay: number) {
        await this.viewingQueue.add(payload.type, payload, {
            delay,
            removeOnComplete: true,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 120000,
            },
            removeOnFail: 50,
        });
    }
}
