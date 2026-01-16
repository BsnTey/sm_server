import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../../account/account.service';
import { COURSE_ANSWERS, COURSE_ID_TO_MNEMO } from '../data/course-answers.data';
import { CardLevel, CourseAnalyticsResult, CourseStatus } from '../interfaces/courses.types';
import { calculatePointsLogic, generatePointOptions, MULTIPLIERS } from '../utils';
import { RedisCacheService } from '../../cache/cache.service';
import { courseAnalyticsKey } from '../../cache/cache.keys';
import sleep from 'sleep-promise';
import { CourseFlowPayload, FlowJobType } from '../interfaces/course-queue.interface';
import { Course } from '../../account/interfaces/course-list.interface';
import { courseViewing } from '../../../infrastructure/bullmq/bullmq.queues';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VIEWING_CONFIG } from '../constants';

@Injectable()
export class CourseWorkService {
    private readonly logger = new Logger(CourseWorkService.name);

    constructor(
        private readonly accountService: AccountService,
        private readonly cacheService: RedisCacheService,
        @InjectQueue(courseViewing) private readonly viewingQueue: Queue,
    ) {}

    /**
     * Основной метод: подбирает курсы под сумму и проходит их
     */
    async completeCoursesForAmount(
        accountId: string,
        targetAmount: number,
    ): Promise<{
        earnedPoints: number;
        passedCount: number;
    }> {
        // 1. Получаем данные и уровень карты
        const { courseList, cardLevel } = await this.getCourseAnalytics(accountId);

        // Определяем множитель для точного подсчета
        const multiplier = MULTIPLIERS[cardLevel];

        // 2. Подбираем курсы
        const coursesToPass = this.findCoursesForTarget(courseList, targetAmount, cardLevel);

        this.logger.log(`Найдено ${coursesToPass.length} курсов для цели ${targetAmount}. Старт прохождения...`);

        let passedCount = 0;
        let earnedPoints = 0;

        // 3. Проходим курсы
        for (const course of coursesToPass) {
            try {
                const mnemocode = COURSE_ID_TO_MNEMO[course.id];
                if (!mnemocode) {
                    this.logger.warn(`Skip ID ${course.id}: нет мнемокода`);
                    continue;
                }

                const answers = COURSE_ANSWERS[mnemocode];
                if (!answers) {
                    this.logger.warn(`Skip ID ${course.id}: нет ответов`);
                    continue;
                }

                // Вызываем прохождение
                this.logger.log(`Проходим тест: ${mnemocode} для ${accountId}`);
                const resp = await this.accountService.passTest(accountId, mnemocode, answers.answers);
                await sleep(500);

                if (!resp.success) throw new Error('Test API failed');

                // Если успешно (не вылетела ошибка):
                passedCount++;

                const pointsForCourse = Math.round(course.points * multiplier);
                earnedPoints += pointsForCourse;
            } catch (e: any) {
                this.logger.error(`Ошибка прохождения курса ${course.id}: ${e.message}`);
                // Не прерываем весь процесс, чтобы пройти то, что можно пройти
            }
        }

        return { earnedPoints, passedCount };
    }

    private findCoursesForTarget(allCourses: Course[], target: number, level: CardLevel): Course[] {
        // Фильтр для "Earned" (уже пройденных)
        const candidates = allCourses.filter(c => c.status === CourseStatus.ACTIVE && c.stats.countLessons === c.stats.countLessonsLearned);
        return this.findCoursesInternal(candidates, target, level);
    }

    async getCourseAnalytics(accountId: string) {
        // Формируем уникальный ключ
        const cacheKey = courseAnalyticsKey(accountId);

        const cachedData = await this.cacheService.get<CourseAnalyticsResult>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const data = await this.accountService.getCourses(accountId);
        let cardInfo;
        let cardLevel;
        try {
            cardInfo = await this.accountService.shortInfo(accountId);
            cardLevel = cardInfo.bonusLevel.toUpperCase() as CardLevel;
        } catch {
            this.logger.warn(`Ошибка получения инфо по карте, запрос web версии для: ${accountId}`);

            cardInfo = await this.accountService.getWebBonuses(accountId);
            cardLevel = cardInfo.currentLevel.toUpperCase() as CardLevel;
        }

        const result: CourseAnalyticsResult = {
            courseList: data.list,
            cardLevel,
            ...calculatePointsLogic(data.list, cardLevel),
        };

        await this.cacheService.set(cacheKey, result, 10);

        return result;
    }

    async getCreditOptions(accountId: string): Promise<number[]> {
        const { earnedCourses } = await this.getCourseAnalytics(accountId);
        // Генерируем комбинации
        return generatePointOptions(earnedCourses);
    }

    /**
     * Получение вариантов кнопок для "Постановки в работу"
     */
    async getFutureCreditOptions(accountId: string): Promise<number[]> {
        const { futureCourses } = await this.getCourseAnalytics(accountId);
        return generatePointOptions(futureCourses);
    }

    /**
     * Оценка задачи перед оплатой
     * Возвращает: кол-во курсов, баллы, примерное время выполнения в минутах
     */
    async estimateWorkPayload(accountId: string, targetAmount: number) {
        const { courseList, cardLevel } = await this.getCourseAnalytics(accountId);

        // Ищем курсы, которые нужно пройти (статус NONE или ACTIVE недоделанные)
        const candidates = courseList.filter(
            c =>
                c.status === CourseStatus.NONE ||
                (c.status === CourseStatus.ACTIVE && c.stats.countLessons !== c.stats.countLessonsLearned),
        );

        // Используем существующий алгоритм подбора (переиспользуем логику)
        const coursesToWork = this.findCoursesInternal(candidates, targetAmount, cardLevel);

        if (coursesToWork.length === 0) {
            throw new Error('Ошибка алгоритма подбора');
        }

        let totalDurationSec = 0;
        coursesToWork.forEach(c => {
            const dur = c.duration;
            totalDurationSec += dur * VIEWING_CONFIG.SPEED_FACTOR;
        });

        return {
            coursesCount: coursesToWork.length,
            targetAmount,
            estimatedTimeMin: Math.ceil(totalDurationSec / 60),
            courses: coursesToWork,
        };
    }

    /**
     * Точка входа 2: Конкретный список (без тестов, без уведомлений)
     */
    async queueSpecificCourses(accountId: string, needWatchCourseIds?: number[]) {
        if (!needWatchCourseIds || needWatchCourseIds.length == 0) {
            needWatchCourseIds = Object.keys(COURSE_ID_TO_MNEMO).map(Number);
        }
        // 1. Получаем актуальные данные по курсам, чтобы отсеять полностью завершенные
        const allCourses = await this.accountService.getCourses(accountId);

        const coursesToProcess = allCourses.list
            .filter(c => {
                // Оставляем, если ID в списке И (курс не завершен ИЛИ есть непросмотренные уроки)
                const isRequested = needWatchCourseIds.includes(c.id);
                const isNotFinished = c.status !== CourseStatus.FINISHED;
                // Дополнительная проверка: если статус ACTIVE, но все уроки просмотрены -> для этого метода это "завершен"
                const hasUnwatched = c.stats.countLessons !== c.stats.countLessonsLearned;

                return isRequested && (isNotFinished || hasUnwatched);
            })
            .map(c => c.id);

        this.logger.log(`Запуск Flow (список). Запрошено: ${needWatchCourseIds.length}, Актуально: ${coursesToProcess.length}`);

        if (coursesToProcess.length > 0) {
            await this.startFlow({
                accountId,
                courseIds: coursesToProcess,
                skipTests: true,
                type: FlowJobType.DECIDE_NEXT,
            });
        }

        return coursesToProcess.length;
    }

    /**
     * Точка входа 1: Подбор по сумме (с тестами и уведомлением)
     */
    async queueCoursesForAmount(accountId: string, targetAmount: number, telegramId: string) {
        const estimation = await this.estimateWorkPayload(accountId, targetAmount);

        this.logger.log(`Запускаем флоу просмотра для ${estimation.coursesCount} курсов. Acc: ${accountId}`);
        const validCourseIds = estimation.courses.map(c => c.id);

        this.logger.log(`Запуск Flow (сумма). Курсов: ${validCourseIds.length}`);

        await this.startFlow({
            accountId,
            telegramId,
            courseIds: validCourseIds,
            skipTests: false,
            type: FlowJobType.DECIDE_NEXT,
        });

        return validCourseIds.length;
    }

    private async startFlow(payload: CourseFlowPayload) {
        // Создаем родительскую задачу
        await this.viewingQueue.add(payload.type, payload, {
            jobId: `flow_${payload.accountId}_${Date.now()}`,
            attempts: 3,
            removeOnComplete: true,
        });
    }

    private findCoursesInternal(candidates: Course[], target: number, level: CardLevel): Course[] {
        const multiplier = MULTIPLIERS[level];

        const items = candidates.map(c => ({
            course: c,
            val: Math.round(c.points * multiplier),
        }));

        items.sort((a, b) => b.val - a.val);

        const exactSolution = this.solveExact(0, target, items);
        if (exactSolution) return exactSolution;

        // Fallback greedy
        const greedyResult: Course[] = [];
        let currentSum = 0;
        for (const item of items) {
            if (currentSum + item.val <= target) {
                greedyResult.push(item.course);
                currentSum += item.val;
            }
        }
        return greedyResult;
    }

    private solveExact(
        index: number,
        currentTarget: number,
        items: {
            course: Course;
            val: number;
        }[],
    ): Course[] | null {
        if (currentTarget === 0) return [];
        if (currentTarget < 0 || index >= items.length) return null;
        const { course, val } = items[index];
        if (val <= currentTarget) {
            const res = this.solveExact(index + 1, currentTarget - val, items);
            if (res !== null) return [course, ...res];
        }
        return this.solveExact(index + 1, currentTarget, items);
    }
}
