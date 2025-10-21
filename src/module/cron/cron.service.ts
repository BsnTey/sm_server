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

        // агрегированные счетчики за весь прогон
        let taken = 0; // сколько аккаунтов взято в обработку
        let watched = 0; // сколько аккаунтов реально посмотрели 1 урок
        let errors = 0; // количество ошибок

        try {
            const accounts = await this.accountService.getActiveCourseAccount();
            if (accounts.length === 0) {
                this.logger.log('Крон: аккаунтов взято=0, просмотрено=0, ошибки=нет (0)');
                return;
            }

            taken = accounts.length;

            for (const accountId of accounts) {
                try {
                    // 1) берем активные курсы аккаунта
                    const activeCourses = await this.courseService.getCoursesByAccountAndStatus(accountId, CourseStatus.ACTIVE);

                    // если все курсы уже FINISHED — отмечаем аккаунт как FINISHED и идем дальше
                    if (activeCourses.length > 0 && activeCourses.every(c => c.status === CourseStatus.FINISHED)) {
                        await this.accountService.updateStatusAccountCourse(accountId, CourseStatus.FINISHED);
                        continue;
                    }

                    // 2) ищем первую подходящую лекцию для просмотра (не просмотрена и уже доступна по времени)
                    const nowIso = new Date().toISOString();

                    let chosen: {
                        courseIndex: number;
                        lessonIndex: number;
                        lesson: any;
                        courseId: string;
                        mnemocode: string;
                    } | null = null;

                    for (let i = 0; i < activeCourses.length; i++) {
                        const course = activeCourses[i];

                        const lessons = await this.courseService.getLessonsWithProgressByAccountAndCourse(accountId, course.courseId);

                        // если все уроки курса уже просмотрены — помечаем курс как FINISHED и переходим к следующему курсу
                        const allLessonsFinished = lessons.every(l => l.AccountLessonProgress.some(p => p.status === LessonStatus.VIEWED));
                        if (allLessonsFinished) {
                            await this.courseService.changeStatusCourse(course.accountId, course.courseId, CourseStatus.FINISHED);
                            continue;
                        }

                        // ищем первый доступный к просмотру урок
                        for (let j = 0; j < lessons.length; j++) {
                            const lesson = lessons[j];
                            if (lesson.progress.status === LessonStatus.VIEWED) continue;

                            const nextIso = lesson.progress.nextViewAt ? new Date(lesson.progress.nextViewAt).toISOString() : null;

                            if (!nextIso || nextIso <= nowIso) {
                                let mnemocode = this.courseService.getMnemocode(course.courseId);
                                if (!mnemocode) {
                                    await this.courseService.initializeCache();
                                    mnemocode = this.courseService.getMnemocode(course.courseId);
                                }

                                chosen = {
                                    courseIndex: i,
                                    lessonIndex: j,
                                    lesson,
                                    courseId: course.courseId,
                                    mnemocode: mnemocode!,
                                };
                                break;
                            }
                        }

                        if (chosen) break;
                    }

                    // 3) если не нашли подходящий урок — идем к следующему аккаунту
                    if (!chosen) continue;

                    // 4) пытаемся посмотреть один урок
                    const progressId = chosen.lesson.progress.progressId;
                    const progressAccId = chosen.lesson.progress.accountId;

                    const isWatched = await this.viewLesson(this.mapLesson(chosen.lesson, chosen.mnemocode), progressId, progressAccId);

                    if (isWatched) {
                        chosen.lesson.progress.status = LessonStatus.VIEWED;
                        watched++;

                        // пост-обработка: если это была последняя лекция курса — закрываем курс,
                        // и, если есть следующий курс, разблокируем первую лекцию.
                        const lessonsNow = await this.courseService.getLessonsWithProgressByAccountAndCourse(accountId, chosen.courseId);
                        const allFinishedNow = lessonsNow.every(l => l.AccountLessonProgress.some(p => p.status === LessonStatus.VIEWED));

                        if (allFinishedNow) {
                            await this.courseService.changeStatusCourse(accountId, chosen.courseId, CourseStatus.FINISHED);

                            // если есть следующий курс — разблокируем его первую лекцию
                            if (chosen.courseIndex + 1 < activeCourses.length) {
                                const nextCourse = activeCourses[chosen.courseIndex + 1];
                                const nextLessons = await this.courseService.getLessonsWithProgressByAccountAndCourse(
                                    accountId,
                                    nextCourse.courseId,
                                );
                                const first = nextLessons[0];
                                if (first) {
                                    const timeUnblock = this.getTimeUnblock(first.duration);
                                    await this.courseService.updateUnblockLesson(first.progress.progressId, timeUnblock);
                                }
                            } else {
                                // иначе все курсы аккаунта потенц. закрыты — обновим статус аккаунта
                                await this.accountService.updateStatusAccountCourse(accountId, CourseStatus.FINISHED);
                            }
                        } else {
                            // если курс не закрыт — разблокируем следующую лекцию внутри курса (если есть)
                            const nextIndex = chosen.lessonIndex + 1;
                            if (nextIndex < lessonsNow.length) {
                                const nextLesson = lessonsNow[nextIndex];
                                const timeUnblock = this.getTimeUnblock(nextLesson.duration);
                                await this.courseService.updateUnblockLesson(nextLesson.progress.progressId, timeUnblock);
                            }
                        }
                    } else {
                        // не посмотрели — обработка уже внутри viewLesson (переотложили)
                    }
                } catch (err: any) {
                    errors++;
                    // отметим проблемный аккаунт/курс, если можем
                    try {
                        await this.accountService.promblemCourses(accountId);
                    } catch {}
                    this.logger.error(`Ошибка при обработке аккаунта ${accountId}: ${err?.message ?? err}`);
                }
            }

            // финальный сводный лог
            this.logger.log(`Крон: аккаунтов взято=${taken}, просмотрено=${watched}, ошибки=${errors > 0 ? 'да' : 'нет'} (${errors})`);
        } catch (err: any) {
            // системная ошибка крона
            this.logger.error(`Критическая ошибка крона: ${err?.message ?? err}`);
            // всё равно выведем сводный лог по тому, что успели
            this.logger.log(
                `Крон (с ошибкой): аккаунтов взято=${taken}, просмотрено=${watched}, ошибки=${errors > 0 ? 'да' : 'нет'} (${errors})`,
            );
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
            this.logger.error(`ОШИБКА В ПРОСМОТРЕ ${accountId}: ${String(error)}`);
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
