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
                const accountActiveCourses = await this.courseService.getCoursesByAccountAndStatus(accountId, CourseStatus.ACTIVE);

                for (let i = 0; i < accountActiveCourses.length; i++) {
                    const accountCourse = accountActiveCourses[i];
                    const lessonsWithProgress = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                        accountId,
                        accountCourse.courseId,
                    );

                    //здесь проверка, все просмотрено, но нет статуса финиш курса (после синхрона)
                    const allLessonsFinished = lessonsWithProgress.every(lesson =>
                        lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                    );

                    if (allLessonsFinished) {
                        // Помечаем курс как завершённый
                        await this.courseService.changeStatusCourse(accountCourse.accountId, accountCourse.courseId, CourseStatus.FINISHED);
                        continue;
                    }

                    for (let j = 0; j < lessonsWithProgress.length; j++) {
                        const lesson = lessonsWithProgress[j];

                        if (lesson.progress.status === LessonStatus.VIEWED) continue;

                        // if (accountLessonProgress.status == LessonStatus.VIEWED) {
                        //     //здесь проверяем, последний ли урок и курс. нужно на проверку после синхронизации
                        //     if (i < accountWithCourses.length - 1 && j === lessons.length - 1) {
                        //         const allCoursesFinished = accountWithCourses.every(
                        //             course =>
                        //                 course.status === CourseStatus.FINISHED &&
                        //                 course.course.lessons.every(lesson =>
                        //                     lesson.AccountLessonProgress.some(progress => progress.status === LessonStatus.VIEWED),
                        //                 ),
                        //         );
                        //
                        //         if (allCoursesFinished) {
                        //             await this.accountService.updateCourseStatus(accountLessonProgress.accountId, CourseStatus.FINISHED);
                        //             continue accountsLoop;
                        //         }
                        //     }
                        //     continue;
                        // }

                        // Проверяем, наступило ли время для просмотра лекции
                        if (!lesson.progress.nextViewAt || new Date(lesson.progress.nextViewAt).toISOString() <= new Date().toISOString()) {
                            const accountId = lesson.progress.accountId;
                            const progressId = lesson.progress.progressId;

                            let mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                            if (!mnemocode) {
                                await this.courseService.initializeCache();
                                mnemocode = this.courseService.getMnemocode(accountCourse.courseId);
                            }
                            const lessonView = this.mapLesson(lesson, mnemocode!);

                            try {
                                const isWatched = await this.viewLesson(lessonView, progressId, accountId);
                                if (!isWatched) continue accountsLoop;
                                console.log('просмотрел', lessonView.mnemocode, lesson.position);
                            } catch (err: any) {
                                await this.accountService.promblemCourses(accountCourse.accountId);
                                console.error('Проблема с курсом isWatched', accountCourse.accountId);
                            }

                            // Если это последняя лекция в курсе
                            if (j === lessonsWithProgress.length - 1) {
                                // Помечаем курс как завершённый
                                const allLessonsFinished = lessonsWithProgress.every(lesson =>
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
                                        //переход к другому акку
                                    }
                                } else {
                                    //аккаунт FINISHED
                                    await this.accountService.updateCourseStatus(accountId, CourseStatus.FINISHED);
                                }
                                continue accountsLoop;
                            } else {
                                // Если не последняя лекция, разблокируем следующую
                                const nextLesson = lessonsWithProgress[j + 1];

                                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                                await this.courseService.updateUnblockLesson(nextLesson.progress.progressId, timeUnblock);
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
        const timeout = new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

        const isWatchingPromise = this.accountService.watchingLesson(lesson, accountId);

        let isWatching: boolean;
        try {
            isWatching = await Promise.race([isWatchingPromise, timeout]);
        } catch (error) {
            console.error('ОШИБКА В ПРОСМОТРЕ', accountId);
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
}
