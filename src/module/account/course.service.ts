import { Injectable } from '@nestjs/common';
import { CourseRepository } from './course.repository';
import { CourseWithLessons } from './interfaces/course.interface';
import { AccountRepository } from './account.repository';
import { Cron } from '@nestjs/schedule';
import { CourseStatus, LessonStatus } from '@prisma/client';

@Injectable()
export class CourseService {
    constructor(
        private courseRepository: CourseRepository,
        private accountRepository: AccountRepository,
    ) {}

    // @Cron('*/2 * * * *')
    @Cron('*/10 * * * * *')
    async processLessons(): Promise<void> {
        console.log('---------------------------');
        console.log('попадаем в processLessons', new Date());
        const accounts = await this.accountRepository.getActiveCourseAccount();
        if (accounts.length === 0) return;

        accountsLoop: for (const account of accounts) {
            const accountCourses = account.AccountCourse;

            if (accountCourses[0].status == CourseStatus.BLOCKED) {
                await this.courseRepository.unBlockCourse(accountCourses[0].accountCourseId);
                console.log('Начинается просмотр первой лекции', new Date());
                await this.viewLesson(accountCourses[0].course.lessons[0].AccountLessonProgress[0].progressId);
                const nextLesson = accountCourses[0].course.lessons[1];
                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                console.log('Выставил первый разблок', timeUnblock);
                await this.courseRepository.updateUnblockLesson(nextLesson.AccountLessonProgress[0].progressId, timeUnblock);
                continue;
            }

            for (let i = 0; i < accountCourses.length; i++) {
                const accountCourse = accountCourses[i];

                if (accountCourse.status != CourseStatus.ACTIVE) continue;

                const lessons = accountCourse.course.lessons;

                for (let j = 0; j < lessons.length; j++) {
                    const lesson = lessons[j];
                    const accountLessonProgress = lesson.AccountLessonProgress.find(progress => progress.accountId === account.accountId);

                    if (!accountLessonProgress) throw Error('Не нашел курс');
                    if (accountLessonProgress.status == LessonStatus.VIEWED) continue;

                    // Проверяем, наступило ли время для просмотра лекции
                    if (
                        !accountLessonProgress.nextViewAt ||
                        new Date(accountLessonProgress.nextViewAt).toISOString() <= new Date().toISOString()
                    ) {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        console.log('время разблокировка', new Date(accountLessonProgress.nextViewAt).toISOString());
                        console.log('текущее время', new Date().toISOString());
                        await this.viewLesson(accountLessonProgress.progressId);

                        console.log(`Просмотрено: Курс ${accountCourse.course.mnemocode}, Лекция позиция ${lesson.position}`);

                        // Если это последняя лекция в курсе
                        if (j === lessons.length - 1) {
                            // Помечаем курс как завершённый
                            await this.courseRepository.finishCourse(accountCourse.accountCourseId);

                            console.log(`Курс завершён: ${accountCourse.course.title}`);

                            // Если есть следующий курс, разблокируем первую лекцию
                            if (i < accountCourses.length - 1) {
                                const nextCourse = accountCourses[i + 1];
                                await this.courseRepository.unBlockCourse(nextCourse.accountCourseId);
                                const firstLesson = nextCourse.course.lessons[0];
                                const firstLessonProgress = firstLesson.AccountLessonProgress.find(
                                    progress => progress.accountId === account.accountId,
                                );

                                if (firstLessonProgress) {
                                    const timeUnblock = this.getTimeUnblock(firstLesson.duration);
                                    console.log('Время разблокировки первой лекции след курса', timeUnblock);
                                    await this.courseRepository.updateUnblockLesson(firstLessonProgress.progressId, timeUnblock);
                                    await this.courseRepository.unBlockCourse(nextCourse.accountCourseId);

                                    console.log(`Разблокировано: Курс ${nextCourse.course.title}, Лекция позиция ${firstLesson.position}`);
                                }
                            } else {
                                await this.accountRepository.finishedCourses(accountLessonProgress.accountId);
                                console.log(`Финиш ${accountLessonProgress.accountId}`);
                            }
                        } else {
                            // Если не последняя лекция, разблокируем следующую
                            const nextLesson = lessons[j + 1];
                            const nextLessonProgress = nextLesson.AccountLessonProgress.find(
                                progress => progress.accountId === account.accountId,
                            );
                            if (!nextLessonProgress) continue;

                            const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                            console.log(`Время разблокировки след урока ${timeUnblock}`);
                            await this.courseRepository.updateUnblockLesson(nextLessonProgress.progressId, timeUnblock);
                            nextLessonProgress.nextViewAt = timeUnblock;

                            console.log(`Разблокировано: Лекция позиция ${nextLesson.position}`);
                        }
                    } else {
                        console.log('время не пришло, идем к след аккаунту');
                        continue accountsLoop;
                    }
                }
            }
        }
    }

    async viewLesson(progressId: number) {
        // Тут Отправка запроса на просмотр
        await this.courseRepository.updateViewedLesson(progressId);
    }

    private getTimeUnblock(duration: number) {
        // return new Date(Date.now() + (duration / 2) * 1000);
        return new Date(Date.now() + 30 * 1000);
    }

    async getCoursesWithLessons(): Promise<CourseWithLessons[]> {
        return this.courseRepository.getCoursesWithLessons();
    }

    async createAccountCourse(accountId: string, course: CourseWithLessons): Promise<void> {
        return await this.courseRepository.createAccountCourse(accountId, course);
    }

    async createAccountLessonProgress(accountId: string, course: CourseWithLessons): Promise<void> {
        return await this.courseRepository.createAccountLessonProgress(accountId, course);
    }
}

// const accountCourse = account.AccountCourse.find(course => course.status == CourseStatus.ACTIVE);
//
// if (accountCourse) {
//     const lessons = accountCourse.course.lessons;
//     for (const lesson of lessons) {
//         const accountLessonProgress = lesson.AccountLessonProgress;
//         const readyLes = accountLessonProgress.find(les => les.status == LessonStatus.NONE);
//     }
// } else {
//     const firstAccountCourse = account.AccountCourse[0];
//     const firstBlockedLesson = firstAccountCourse.course.lessons.find(lesson =>
//         lesson.AccountLessonProgress.some(
//             progress => progress.status === LessonStatus.BLOCKED && progress.accountId === account.accountId,
//         ),
//     );
//
//     if (firstBlockedLesson) {
//         const accountLessonProgress = firstBlockedLesson.AccountLessonProgress.find(
//             progress => progress.status === LessonStatus.BLOCKED,
//         );
//
//         if (accountLessonProgress) {
//             // дописать запрос о просмотре
//             const timeUnblock = new Date(Date.now() + 60 * 1000);
//             // const timeUnblock = new Date(Date.now() + (secondBlockedLesson.duration / 2) * 1000);
//             await this.courseRepository.updateViewedLesson(accountLessonProgress.progressId);
//             await this.courseRepository.updateUnblockLesson(accountLessonProgress.progressId, timeUnblock);
//             console.log(
//                 `просмотрел ${firstBlockedLesson.title} у courseId ${firstBlockedLesson.courseId}. у lessonId ${firstBlockedLesson.lessonId}. на position ${firstBlockedLesson.position}`,
//             );
//         } else {
//             console.error('БАГ!! нет заблокированных в accountLessonProgress. account id', account.accountId);
//         }
//     } else {
//         console.error('БАГ!! нет заблокированных в firstBlockedLesson. account id', account.accountId);
//     }
// }
