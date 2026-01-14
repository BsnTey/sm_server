import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { COURSE_ANSWERS, COURSE_ID_TO_MNEMO } from './data/course-answers.data';
import { CardLevel, CourseAnalyticsResult, CourseItem, CourseStatus } from './courses.types';
import { calculatePointsLogic, generatePointOptions, MULTIPLIERS } from './utils';
import { RedisCacheService } from '../cache/cache.service';
import { courseAnalyticsKey } from '../cache/cache.keys';
import sleep from 'sleep-promise';

@Injectable()
export class CourseWorkService {
    private readonly logger = new Logger(CourseWorkService.name);

    constructor(
        private accountService: AccountService,
        private readonly cacheService: RedisCacheService,
    ) {}

    /**
     * Основной метод: подбирает курсы под сумму и проходит их
     */
    async completeCoursesForAmount(accountId: string, targetAmount: number): Promise<{ earnedPoints: number; passedCount: number }> {
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

                if (!resp.success) throw new Error('Тест не выполнен');

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

    private findCoursesForTarget(allCourses: CourseItem[], target: number, level: CardLevel): CourseItem[] {
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
            throw new Error('Не удалось подобрать курсы под эту сумму');
        }

        // Считаем время: (Duration / 2) / 60 = минуты
        // Если duration нет, берем дефолт 2000 сек
        let totalDurationSec = 0;
        coursesToWork.forEach(c => {
            const dur = (c as any).duration || 2000;
            totalDurationSec += dur / 2;
        });

        return {
            coursesCount: coursesToWork.length,
            targetAmount,
            estimatedTimeMin: Math.ceil(totalDurationSec / 60),
            courses: coursesToWork, // возвращаем, чтобы потом id отправить в очередь
        };
    }

    /**
     * Постановка в очередь (RabbitMQ) для конкретной суммы
     */
    async queueCoursesForAmount(accountId: string, targetAmount: number) {
        // 1. Снова подбираем курсы (гарантируем актуальность)
        const estimation = await this.estimateWorkPayload(accountId, targetAmount);

        this.logger.log(`Запускаем в очередь ${estimation.coursesCount} курсов на сумму ${targetAmount}`);

        // 2. Отправляем в RabbitMQ
        estimation.courses.forEach(course => {
            const payload = {
                accountId,
                courseId: course.id,
                action: 'START_LESSON_FLOW', // Отличается от простого теста
                estimatedDuration: ((course as any).duration || 2000) / 2,
            };

            // this.amqpConnection.publish('course_exchange', 'course.start_flow', payload);
            this.logger.log(`[RabbitMQ] > Queued course ${course.id} (${course.title})`);
        });

        return estimation.coursesCount;
    }

    private findCoursesInternal(candidates: CourseItem[], target: number, level: CardLevel): CourseItem[] {
        const multiplier = MULTIPLIERS[level];

        const items = candidates.map(c => ({
            course: c,
            val: Math.round(c.points * multiplier),
        }));

        items.sort((a, b) => b.val - a.val);

        // ... Вставьте сюда ту же логику solveExact, что была раньше ...
        const solveExact = (index: number, currentTarget: number): CourseItem[] | null => {
            if (currentTarget === 0) return [];
            if (currentTarget < 0 || index >= items.length) return null;
            const { course, val } = items[index];
            if (val <= currentTarget) {
                const res = solveExact(index + 1, currentTarget - val);
                if (res !== null) return [course, ...res];
            }
            return solveExact(index + 1, currentTarget);
        };

        const exactSolution = solveExact(0, target);
        if (exactSolution) return exactSolution;

        // Fallback greedy
        const greedyResult: CourseItem[] = [];
        let currentSum = 0;
        for (const item of items) {
            if (currentSum + item.val <= target) {
                greedyResult.push(item.course);
                currentSum += item.val;
            }
        }
        return greedyResult;
    }
}
