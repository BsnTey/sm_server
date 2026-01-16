import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { CourseViewingPayload } from './interfaces/course-queue.interface';
import { CourseData, LessonStatus } from '../account/interfaces/course-data.interface';
import { COURSE_ANSWERS, COURSE_ID_TO_MNEMO } from './data/course-answers.data';
import { CourseStatus } from './interfaces/courses.types';
import { IWatchLesson } from '../account/interfaces/course.interface';
import { RedisCacheService } from '../cache/cache.service';
import { Processor, WorkerHost, InjectQueue, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { courseViewing } from '../../infrastructure/bullmq/bullmq.queues';
import { INotificationPort } from '@core/ports/notification.port';

@Processor(courseViewing, {
    concurrency: 10,
})
@Injectable()
export class CourseViewingWorker extends WorkerHost {
    private readonly logger = new Logger(CourseViewingWorker.name);

    constructor(
        private readonly notificationService: INotificationPort,
        private readonly accountService: AccountService,
        private readonly cacheService: RedisCacheService,
        @InjectQueue(courseViewing) private readonly viewingQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<CourseViewingPayload>): Promise<void> {
        const payload = job.data;
        const { courseIds, accountId, telegramId, skipTests } = payload;
        let { currentCourseId } = payload;

        const lockKey = `lock:viewing:${accountId}`;

        const isLockAcquired = await this.cacheService.tryLock(lockKey, 10);

        if (!isLockAcquired) {
            this.logger.warn(`🛑 [Job ${job.id}] Дубль для ${accountId}. Лок занят. Пропускаем.`);
            return;
        }

        try {
            // 1. ОПРЕДЕЛЕНИЕ ТЕКУЩЕГО КУРСА
            if (!currentCourseId) {
                if (courseIds.length === 0) {
                    await this.finishFlow(accountId, telegramId);
                    return;
                }
                currentCourseId = courseIds[0];
                await this.scheduleNextStep({ ...payload, currentCourseId }, 1000);
            }

            this.logger.log(`👷 Worker [Job ${job.id}]: Обработка курса ${currentCourseId} для ${accountId}`);

            // 2. ПОЛУЧЕНИЕ ДАННЫХ КУРСА
            const courseData: CourseData = await this.accountService.getCoursesById(accountId, currentCourseId);
            const mnemocode = courseData.mnemocode;

            // 3. АКТИВАЦИЯ (если нужно)
            if (courseData.status === LessonStatus.NONE) {
                this.logger.log(`Курс ${currentCourseId} не активен. Активируем...`);
                await this.accountService.activateCourse(accountId, mnemocode);
                await this.scheduleNextStep(payload, 1000);
                return;
            }

            // 4. ПРОСМОТР ВИДЕО
            const unwatchedLessonIndex = courseData.lessons.findIndex(l => l.status !== LessonStatus.VIEWED);

            if (unwatchedLessonIndex !== -1) {
                const unwatchedLesson = courseData.lessons[unwatchedLessonIndex];

                this.logger.log(`📺 Смотрим видео: ${unwatchedLesson.title} (${unwatchedLesson.duration} сек)`);

                const lesson: IWatchLesson = {
                    mnemocode,
                    lessonId: unwatchedLesson.id.toString(),
                    duration: unwatchedLesson.duration,
                };

                const isWatching = await this.accountService.watchingLessonApi(accountId, lesson);

                if (!isWatching) {
                    this.logger.log(`Ошибка апи просмотра урока для ${accountId}, ${lesson.mnemocode}`);
                    throw new Error(`API error watching ${lesson.lessonId}`);
                }

                let delayMs = 0;

                // Есть ли следующий урок?
                if (unwatchedLessonIndex < courseData.lessons.length - 1) {
                    const nextLesson = courseData.lessons[unwatchedLessonIndex + 1];
                    delayMs = Math.ceil(nextLesson.duration * 0.6 * 1000);
                    this.logger.log(`⏳ Следующий урок длительностью ${nextLesson.duration}, старт через ${delayMs / 1000}с`);
                } else {
                    // Последний урок
                    this.logger.log(`✅ Последнее видео курса засчитано. Переход к тестам через 30с.`);
                    delayMs = 30 * 1000;
                }

                delayMs += 30000; // Запас

                await this.scheduleNextStep(payload, delayMs);
                return;
            }

            // 5. ТЕСТЫ
            if (courseData.status !== CourseStatus.FINISHED) {
                if (!skipTests) {
                    this.logger.log(`📝 Видео просмотрены. Проходим тест для ${mnemocode}`);

                    const mappedMnemo = COURSE_ID_TO_MNEMO[currentCourseId] || mnemocode;
                    const answersData = COURSE_ANSWERS[mappedMnemo];

                    if (!answersData) {
                        this.logger.warn(`Нет ответов для курса ${mnemocode}. Пропускаем тест.`);
                        throw new Error(`Ошибка в answersData для id: ${courseData.id}`);
                    }

                    const testRes = await this.accountService.passTest(accountId, mappedMnemo, answersData.answers);

                    if (!testRes || !testRes.success) {
                        throw new Error(`Ошибка выполнения passTest для id: ${courseData.id}`);
                    }

                    this.logger.log(`✅ Тест сдан!`);
                } else {
                    this.logger.log(`⏭ Пропуск теста (skipTests=true).`);
                }

                await this.scheduleNextStep(payload, 5000);
                return;
            }

            // 6. ПЕРЕХОД К СЛЕДУЮЩЕМУ КУРСУ
            this.logger.log(`🏁 Курс ${currentCourseId} полностью завершен.`);
            await this.moveToNextCourse(payload, currentCourseId);
        } catch (error: any) {
            // await this.handleError(error, payload);
            this.logger.error(`❌ Ошибка [Job ${job.id}]: ${error.message}`);

            throw error;
        } finally {
            await this.cacheService.releaseLock(lockKey);
        }
    }

    private async scheduleNextStep(payload: CourseViewingPayload, delayMs: number) {
        await this.viewingQueue.add('process-flow', payload, {
            delay: delayMs,
            jobId: `flow_${payload.accountId}_${Date.now()}`, // Уникальный ID шага
            attempts: 3,
            backoff: { type: 'exponential', delay: 120000 },
            removeOnComplete: true,
            removeOnFail: 50,
        });
    }

    private async moveToNextCourse(payload: CourseViewingPayload, finishedCourseId: number) {
        const remainingCourses = payload.courseIds.filter(id => id !== finishedCourseId);

        if (remainingCourses.length > 0) {
            const nextCourseId = remainingCourses[0];
            let delayMs = 60000;

            try {
                const nextCourseData = await this.accountService.getCoursesById(payload.accountId, nextCourseId);
                if (nextCourseData.lessons && nextCourseData.lessons.length > 0) {
                    const firstLesson = nextCourseData.lessons[0];
                    delayMs = (firstLesson.duration / 2) * 1000;
                    this.logger.log(`⏳ Следующий курс ${nextCourseId}. Ждем ${delayMs / 1000}с (1-й урок).`);
                }
                delayMs += 30000;
            } catch {
                this.logger.warn(`Ошибка инфо след. курс ${nextCourseId}, дефолтная задержка.`);
            }

            // Планируем следующий курс
            await this.scheduleNextStep({ ...payload, courseIds: remainingCourses, currentCourseId: nextCourseId }, delayMs);
        } else {
            await this.finishFlow(payload.accountId, payload.telegramId);
        }
    }

    private async finishFlow(accountId: string, telegramId?: string) {
        this.logger.log(`🎉 Цепочка завершена для ${accountId}`);
        if (!telegramId) return;
        await this.notificationService.notifyUser(telegramId, `✅ Завершено. Проверьте баланс через пару минут.`);
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job<CourseViewingPayload>, error: Error) {
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            this.logger.error(`💀 FAILED FINAL for ${job.data.accountId}. Reason: ${error.message}`);
            await this.notificationService.notifyAdmin(`🚨 Фатальная ошибка BullMQ\nAcc: ${job.data.accountId}\nErr: ${error.message}`);
            if (!job.data.telegramId) return;
            await this.notificationService.notifyUser(job.data.telegramId, `⚠️ Произошла ошибка. Мы уже разбираемся.`);
        }
    }
}
