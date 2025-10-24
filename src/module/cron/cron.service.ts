import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { CourseStatus, Lesson, LessonStatus } from '@prisma/client';
import { CourseService } from '../account/course.service';
import { IWatchLesson } from '../account/interfaces/course.interface';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);
    private isRunning = false;

    constructor(
        private accountService: AccountService,
        private courseService: CourseService,
    ) {}

    @Cron('*/2 * * * *')
    async processLessons(): Promise<void> {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        try {
            const accounts = await this.accountService.getActiveCourseAccount();
            if (accounts.length === 0) return;

            accountsLoop: for (const accountId of accounts) {
                const accIdForLog = accountId;
                let watchedCount = 0;

                this.logger.log('In accountsLoop by', accountId);
                const accountActiveCourses = await this.courseService.getCoursesByAccountAndStatus(accountId, CourseStatus.ACTIVE);

                // все курсы уже завершены — закрываем аккаунт
                const allCoursesFinished = accountActiveCourses.every(course => course.status === CourseStatus.FINISHED);
                if (allCoursesFinished) {
                    await this.accountService.updateStatusAccountCourse(accountId, CourseStatus.FINISHED);
                    this.logAccountSummary(accIdForLog, watchedCount);
                    continue;
                }

                for (let i = 0; i < accountActiveCourses.length; i++) {
                    const accountCourse = accountActiveCourses[i];
                    const lessonsWithProgress = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                        accountId,
                        accountCourse.courseId,
                    );

                    // все уроки уже просмотрены — закрываем курс
                    const allLessonsFinished = lessonsWithProgress.every(lesson =>
                        lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                    );

                    if (allLessonsFinished) {
                        await this.courseService.changeStatusCourse(accountCourse.accountId, accountCourse.courseId, CourseStatus.FINISHED);
                        continue;
                    }

                    for (let j = 0; j < lessonsWithProgress.length; j++) {
                        const lesson = lessonsWithProgress[j];

                        if (lesson.progress.status === LessonStatus.VIEWED) continue;

                        // Можно ли смотреть урок сейчас
                        if (!lesson.progress.nextViewAt || new Date(lesson.progress.nextViewAt).toISOString() <= new Date().toISOString()) {
                            const accountId = lesson.progress.accountId; // теневая переменная (поэтому выше accIdForLog)
                            const progressId = lesson.progress.progressId;

                            let mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                            if (!mnemocode) {
                                await this.courseService.initializeCache();
                                mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                            }
                            const lessonView = this.mapLesson(lesson, mnemocode!);

                            try {
                                const isWatched = await this.viewLesson(lessonView, progressId, accountId);
                                if (!isWatched) {
                                    this.logAccountSummary(accIdForLog, watchedCount);
                                    continue accountsLoop;
                                }
                                lesson.progress.status = LessonStatus.VIEWED;
                                watchedCount += 1; // Учитываем просмотр (по вашей логике максимум 1 на аккаунт)
                                this.logger.log('просмотрел', lessonView.mnemocode, lesson.position);
                            } catch (err: any) {
                                await this.accountService.promblemCourses(accountCourse.accountId);
                                this.logger.error('Проблема с курсом isWatched', accountCourse.accountId);
                            }

                            // Если это последний урок в курсе
                            if (j === lessonsWithProgress.length - 1) {
                                const allLessonsFinishedNow = lessonsWithProgress.every(lesson =>
                                    lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                                );

                                if (allLessonsFinishedNow) {
                                    await this.courseService.changeStatusCourse(
                                        accountCourse.accountId,
                                        accountCourse.courseId,
                                        CourseStatus.FINISHED,
                                    );
                                }

                                // Разблокировка первого урока следующего курса или завершение аккаунта
                                if (i < accountActiveCourses.length - 1) {
                                    const nextCourse = accountActiveCourses[i + 1];
                                    const lessonsWithProgressNextCourse = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                                        accountId,
                                        nextCourse.courseId,
                                    );
                                    const firstLessonProgress = lessonsWithProgressNextCourse[0];
                                    if (firstLessonProgress) {
                                        const timeUnblock = this.getTimeUnblock(firstLessonProgress.duration);
                                        await this.courseService.updateUnblockLesson(firstLessonProgress.progress.progressId, timeUnblock);
                                    }
                                } else {
                                    await this.accountService.updateStatusAccountCourse(accountId, CourseStatus.FINISHED);
                                }
                                this.logAccountSummary(accIdForLog, watchedCount);
                                continue accountsLoop;
                            } else {
                                // не последний урок — разблокируем следующий
                                const nextLesson = lessonsWithProgress[j + 1];
                                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                                await this.courseService.updateUnblockLesson(nextLesson.progress.progressId, timeUnblock);
                                this.logAccountSummary(accIdForLog, watchedCount);
                                continue accountsLoop;
                            }
                        } else {
                            this.logAccountSummary(accIdForLog, watchedCount);
                            continue accountsLoop;
                        }
                    }
                }

                // На случай если вышли из циклов без continue (редко, но для полноты)
                this.logAccountSummary(accIdForLog, watchedCount);
            }
        } catch (err: any) {
            this.logger.error(err);
        } finally {
            this.isRunning = false;
        }
    }

    async viewLesson(lesson: IWatchLesson, progressId: number, accountId: string): Promise<boolean> {
        const timeout = new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const isWatchingPromise = this.accountService.watchingLesson(lesson, accountId);

        let isWatching: boolean;
        try {
            isWatching = await Promise.race([isWatchingPromise, timeout]);
        } catch (error) {
            this.logger.error('ОШИБКА В ПРОСМОТРЕ', accountId, error);
            isWatching = false;
        }

        if (isWatching) {
            await this.courseService.updateViewLesson(progressId, LessonStatus.VIEWED);
        } else {
            const plusTimeUnblock = this.getTimeUnblock(400);
            await this.courseService.updateUnblockLesson(progressId, plusTimeUnblock);
        }

        return isWatching;
    }

    private getTimeUnblock(duration: number) {
        return new Date(Date.now() + (duration / 2) * 1000);
    }

    private mapLesson(lesson: Lesson, mnemocode: string): IWatchLesson {
        return {
            mnemocode,
            videoId: lesson.videoId,
            lessonId: lesson.lessonId,
            duration: lesson.duration,
        };
    }

    private logAccountSummary(accountId: string, watched: number) {
        this.logger.log(`Итог за аккаунт ${accountId}: просмотрено уроков за цикл — ${watched}`);
    }
}
