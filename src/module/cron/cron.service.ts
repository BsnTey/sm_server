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
        if (this.isRunning) return;
        this.isRunning = true;

        // ✅ общий счётчик просмотренных уроков за весь цикл
        let totalWatchedInCycle = 0;

        try {
            const accounts = await this.accountService.getActiveCourseAccount();
            if (accounts.length === 0) {
                return;
            }

            accountsLoop: for (const accountId of accounts) {
                this.logger.log('In accountsLoop by', accountId);
                const accountActiveCourses = await this.courseService.getCoursesByAccountAndStatus(accountId, CourseStatus.ACTIVE);

                const allCoursesFinished = accountActiveCourses.every(course => course.status === CourseStatus.FINISHED);
                if (allCoursesFinished) {
                    await this.accountService.updateStatusAccountCourse(accountId, CourseStatus.FINISHED);
                    continue;
                }

                for (let i = 0; i < accountActiveCourses.length; i++) {
                    const accountCourse = accountActiveCourses[i];
                    const lessonsWithProgress = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                        accountId,
                        accountCourse.courseId,
                    );

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

                        const canViewNow =
                            !lesson.progress.nextViewAt || new Date(lesson.progress.nextViewAt).toISOString() <= new Date().toISOString();

                        if (!canViewNow) continue accountsLoop;

                        const accIdFromProgress = lesson.progress.accountId;
                        const progressId = lesson.progress.progressId;

                        let mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                        if (!mnemocode) {
                            await this.courseService.initializeCache();
                            mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                        }
                        const lessonView = this.mapLesson(lesson, mnemocode!);

                        try {
                            const isWatched = await this.viewLesson(lessonView, progressId, accIdFromProgress);
                            if (!isWatched) {
                                // не считаем, переходим к следующему аккаунту
                                continue accountsLoop;
                            }

                            // ✅ тут урок реально просмотрен — учитываем в общем счётчике
                            totalWatchedInCycle += 1;

                            lesson.progress.status = LessonStatus.VIEWED;
                            this.logger.log('просмотрел', lessonView.mnemocode, lesson.position);
                        } catch (err: any) {
                            await this.accountService.promblemCourses(accountCourse.accountId);
                            this.logger.error('Проблема с курсом isWatched', accountCourse.accountId);
                        }

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

                            if (i < accountActiveCourses.length - 1) {
                                const nextCourse = accountActiveCourses[i + 1];
                                const lessonsWithProgressNextCourse = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                                    accIdFromProgress,
                                    nextCourse.courseId,
                                );
                                const firstLessonProgress = lessonsWithProgressNextCourse[0];
                                if (firstLessonProgress) {
                                    const timeUnblock = this.getTimeUnblock(firstLessonProgress.duration);
                                    await this.courseService.updateUnblockLesson(firstLessonProgress.progress.progressId, timeUnblock);
                                }
                            } else {
                                await this.accountService.updateStatusAccountCourse(accIdFromProgress, CourseStatus.FINISHED);
                            }
                            continue accountsLoop;
                        } else {
                            const nextLesson = lessonsWithProgress[j + 1];
                            const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                            await this.courseService.updateUnblockLesson(nextLesson.progress.progressId, timeUnblock);
                            continue accountsLoop;
                        }
                    }
                }
            }

            // ✅ единый финальный лог за весь цикл крона
            this.logger.log(`Итог за цикл: просмотрено ${totalWatchedInCycle} уроков`);
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
