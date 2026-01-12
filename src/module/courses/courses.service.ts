import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { COURSE_ANSWERS, COURSE_ID_TO_MNEMO } from './data/course-answers.data';
import { CardLevel, CourseAnalyticsResult, CourseItem, CourseStatus } from './courses.types';
import { calculatePointsLogic, generatePointOptions, MULTIPLIERS } from './utils';
import { wait } from 'amqp-connection-manager/dist/types/helpers';
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

                // Считаем баллы за этот конкретный курс с учетом множителя
                // Math.round используем, так как в findCoursesForTarget тоже использовался round
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
        const multiplier = MULTIPLIERS[level];

        // 1. Фильтруем кандидатов (Только ACTIVE и пройденные уроки)
        const candidates = allCourses.filter(c => c.status === CourseStatus.ACTIVE && c.stats.countLessons === c.stats.countLessonsLearned);

        // Подготавливаем маппинг с реальными значениями баллов
        const items = candidates.map(c => ({
            course: c,
            val: Math.round(c.points * multiplier),
        }));

        // Сортируем по убыванию (оптимизация для быстрого поиска)
        items.sort((a, b) => b.val - a.val);

        // --- Внутренняя рекурсивная функция поиска ---
        const solveExact = (index: number, currentTarget: number): CourseItem[] | null => {
            // Базовый случай: сумма собрана
            if (currentTarget === 0) return [];

            // Базовый случай: перебор окончен или ушли в минус
            if (currentTarget < 0 || index >= items.length) return null;

            const { course, val } = items[index];

            // ВАРИАНТ А: Берем текущий курс
            if (val <= currentTarget) {
                const res = solveExact(index + 1, currentTarget - val);
                if (res !== null) {
                    return [course, ...res]; // Нашли решение! Возвращаем цепочку
                }
            }

            // ВАРИАНТ Б: Пропускаем текущий курс (если с ним не получилось собрать сумму)
            return solveExact(index + 1, currentTarget);
        };

        // 2. Попытка найти ТОЧНОЕ совпадение
        const exactSolution = solveExact(0, target);

        if (exactSolution) {
            return exactSolution;
        }

        // 3. Fallback (Запасной вариант):
        // Если точное совпадение не найдено (например, юзер ввел кастомную сумму, которую нельзя собрать),
        // используем старый "Жадный" алгоритм, чтобы набрать МАКСИМУМ, но не больше target.

        this.logger.warn(`Не удалось найти точную комбинацию для ${target}. Используем приближенный подбор.`);

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

    async getCourseAnalytics(accountId: string) {
        // Формируем уникальный ключ
        const cacheKey = courseAnalyticsKey(accountId);

        const cachedData = await this.cacheService.get<CourseAnalyticsResult>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const data = await this.accountService.getCourses(accountId);
        const cardInfo = await this.accountService.shortInfo(accountId);

        const cardLevel = cardInfo.bonusLevel.toUpperCase() as CardLevel;

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
     * Отправка курсов в работу (RabbitMQ)
     */
    async startWorkFlow(accountId: string) {
        const { courseList } = await this.getCourseAnalytics(accountId);

        const coursesToStart = courseList.filter(
            (c: { status: string; stats: { countLessons: number; countLessonsLearned: number } }) =>
                c.status === 'NONE' || (c.status === 'ACTIVE' && c.stats.countLessons > c.stats.countLessonsLearned),
        );

        this.logger.log(`Запускаем процесс обучения для ${coursesToStart.length} курсов. Account: ${accountId}`);

        // Имитация отправки в RabbitMQ
        coursesToStart.forEach((course: { id: any }) => {
            const payload = {
                accountId,
                courseId: course.id,
                duration: 100, // или брать из course.duration
                action: 'START_LESSON',
            };

            // this.amqpConnection.publish('course_exchange', 'course.start', payload);
            this.logger.debug(`[RabbitMQ Mock] Published to course.start: ${JSON.stringify(payload)}`);
        });

        return coursesToStart.length;
    }
}
