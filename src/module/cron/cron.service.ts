import { Injectable } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { CourseStatus, Lesson, LessonStatus } from '@prisma/client';
import { CourseService } from '../account/course.service';
import { IWatchLesson } from '../account/interfaces/course.interface';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CronService {
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

            accountsLoop: for (const account of accounts) {
                console.log('In accountsLoop by', account.accountId);
                const accountCourses = account.AccountCourse;
                const firstCourse = accountCourses.length == 0 ? null : accountCourses[0];

                if (!firstCourse) {
                    await this.accountService.promblemCourses(account.accountId);
                    continue;
                }

                if (firstCourse.status == CourseStatus.BLOCKED) {
                    await this.courseService.unBlockCourse(accountCourses[0].accountCourseId);
                    const accountId = accountCourses[0].accountId;
                    const progressId = accountCourses[0].course.lessons[0].AccountLessonProgress[0].progressId;

                    const mnemocode = accountCourses[0].course.mnemocode;
                    const firstLesson = accountCourses[0].course.lessons[0];

                    const lessonView = this.mapLesson(firstLesson, mnemocode);
                    try {
                        const isWatched = await this.viewLesson(lessonView, progressId, accountId);
                        if (!isWatched) continue;
                        console.log('просмотрел первое видео');
                    } catch (err: any) {
                        await this.accountService.promblemCourses(account.accountId);
                        console.error('Проблема с курсом first isWatched', account.accountId);
                    }
                    const nextLesson = accountCourses[0].course.lessons[1];
                    const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                    await this.courseService.updateUnblockLesson(nextLesson.AccountLessonProgress[0].progressId, timeUnblock);
                    continue;
                }

                for (let i = 0; i < accountCourses.length; i++) {
                    const accountCourse = accountCourses[i];

                    if (accountCourse.status != CourseStatus.ACTIVE) continue;

                    const lessons = accountCourse.course.lessons;

                    for (let j = 0; j < lessons.length; j++) {
                        const lesson = lessons[j];
                        const accountLessonProgress = lesson.AccountLessonProgress.find(
                            progress => progress.accountId === account.accountId,
                        );

                        if (!accountLessonProgress) throw Error('Не нашел курс');
                        if (accountLessonProgress.status == LessonStatus.VIEWED) continue;

                        // Проверяем, наступило ли время для просмотра лекции
                        if (
                            !accountLessonProgress.nextViewAt ||
                            new Date(accountLessonProgress.nextViewAt).toISOString() <= new Date().toISOString()
                        ) {
                            const accountId = accountLessonProgress.accountId;
                            const progressId = accountLessonProgress.progressId;

                            const mnemocode = accountCourse.course.mnemocode;
                            const lessonView = this.mapLesson(lesson, mnemocode);

                            try {
                                const isWatched = await this.viewLesson(lessonView, progressId, accountId);
                                if (!isWatched) continue accountsLoop;
                            } catch (err: any) {
                                await this.accountService.promblemCourses(account.accountId);
                                console.error('Проблема с курсом isWatched', account.accountId);
                            }

                            // Если это последняя лекция в курсе
                            if (j === lessons.length - 1) {
                                // Помечаем курс как завершённый
                                await this.courseService.finishCourse(accountCourse.accountCourseId);

                                // Если есть следующий курс, разблокируем первую лекцию
                                if (i < accountCourses.length - 1) {
                                    const nextCourse = accountCourses[i + 1];
                                    await this.courseService.unBlockCourse(nextCourse.accountCourseId);
                                    const firstLesson = nextCourse.course.lessons[0];
                                    const firstLessonProgress = firstLesson.AccountLessonProgress.find(
                                        progress => progress.accountId === account.accountId,
                                    );

                                    if (firstLessonProgress) {
                                        const timeUnblock = this.getTimeUnblock(firstLesson.duration);
                                        await this.courseService.updateUnblockLesson(firstLessonProgress.progressId, timeUnblock);
                                        await this.courseService.unBlockCourse(nextCourse.accountCourseId);
                                    }
                                } else {
                                    await this.accountService.finishedCourses(accountLessonProgress.accountId);
                                }
                            } else {
                                // Если не последняя лекция, разблокируем следующую
                                const nextLesson = lessons[j + 1];
                                const nextLessonProgress = nextLesson.AccountLessonProgress.find(
                                    progress => progress.accountId === account.accountId,
                                );
                                if (!nextLessonProgress) continue;

                                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                                await this.courseService.updateUnblockLesson(nextLessonProgress.progressId, timeUnblock);
                                nextLessonProgress.nextViewAt = timeUnblock;
                            }
                        } else {
                            continue accountsLoop;
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error(err);
        } finally {
            this.isRunning = false;
        }
    }

    async viewLesson(lesson: IWatchLesson, progressId: number, accountId: string): Promise<boolean> {
        const isWatching = await this.accountService.watchingLesson(lesson, accountId);
        if (isWatching) {
            await this.courseService.updateViewedLesson(progressId);
        } else {
            console.error('ОШИБКА В ПРОСМОТРЕ, ТАЙМЕР НЕ ПОДОШЕЛ');
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
}
