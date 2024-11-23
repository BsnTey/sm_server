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

            accountsLoop: for (const accountId of accounts) {
                console.log('In accountsLoop by', accountId);
                const accountWithCourses = await this.accountService.getAccountCoursesWithLessons(accountId);

                for (let i = 0; i < accountWithCourses.length; i++) {
                    const accountCourse = accountWithCourses[i];

                    if (accountCourse.status == CourseStatus.FINISHED) {
                        if (i === accountWithCourses.length - 1) {
                            await this.accountService.updateCourseStatus(accountCourse.accountId, CourseStatus.FINISHED);
                            continue accountsLoop;
                        }
                        continue;
                    }

                    const lessons = accountCourse.course.lessons;

                    for (let j = 0; j < lessons.length; j++) {
                        const lesson = lessons[j];
                        const accountLessonProgress = lesson.AccountLessonProgress.find(
                            progress => progress.accountId === accountCourse.accountId,
                        );

                        if (!accountLessonProgress) throw Error('Не нашел курс');
                        if (accountLessonProgress.status == LessonStatus.VIEWED) {
                            //здесь проверяем, последний ли урок и курс. нужно на проверку после синхронизации
                            if (i < accountWithCourses.length - 1 && j === lessons.length - 1) {
                                const allCoursesFinished = accountWithCourses.every(
                                    course =>
                                        course.status === CourseStatus.FINISHED &&
                                        course.course.lessons.every(lesson =>
                                            lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                                        ),
                                );

                                if (allCoursesFinished) {
                                    await this.accountService.updateCourseStatus(accountLessonProgress.accountId, CourseStatus.FINISHED);
                                    continue accountsLoop;
                                }
                            }
                            continue;
                        }

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
                                console.log('просмотрел', lessonView.mnemocode, lesson.position);
                            } catch (err: any) {
                                await this.accountService.promblemCourses(accountCourse.accountId);
                                console.error('Проблема с курсом isWatched', accountCourse.accountId);
                            }

                            // Если это последняя лекция в курсе
                            if (j === lessons.length - 1) {
                                // Помечаем курс как завершённый
                                const allLessonsFinished = lessons.every(lesson =>
                                    lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                                );

                                if (allLessonsFinished) {
                                    // Помечаем курс как завершённый
                                    await this.courseService.changeStatusCourse(
                                        accountCourse.accountId,
                                        accountCourse.courseId,
                                        CourseStatus.FINISHED,
                                    );
                                }

                                // Если есть следующий курс, разблокируем первую лекцию
                                if (i < accountWithCourses.length - 1) {
                                    const nextCourse = accountWithCourses[i + 1];
                                    // await this.courseService.unBlockCourse(nextCourse.accountCourseId);
                                    const firstLesson = nextCourse.course.lessons[0];
                                    const firstLessonProgress = firstLesson.AccountLessonProgress.find(
                                        progress => progress.accountId === accountCourse.accountId,
                                    );

                                    if (firstLessonProgress) {
                                        const timeUnblock = this.getTimeUnblock(firstLesson.duration);
                                        await this.courseService.updateUnblockLesson(firstLessonProgress.progressId, timeUnblock);
                                        //переход к другому акку
                                    }
                                } else {
                                    //аккаунт FINISHED
                                    await this.accountService.updateCourseStatus(accountLessonProgress.accountId, CourseStatus.FINISHED);
                                }
                                continue accountsLoop;
                            } else {
                                // Если не последняя лекция, разблокируем следующую
                                const nextLesson = lessons[j + 1];
                                const nextLessonProgress = nextLesson.AccountLessonProgress.find(
                                    progress => progress.accountId === accountCourse.accountId,
                                );
                                if (!nextLessonProgress) {
                                    console.warn(`Не удалось найти прогресс для следующего урока ${nextLesson.lessonId}`);
                                    continue accountsLoop;
                                }

                                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                                await this.courseService.updateUnblockLesson(nextLessonProgress.progressId, timeUnblock);
                                continue accountsLoop;
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
            console.error('ОШИБКА В ПРОСМОТРЕ', accountId);
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
