import { CardLevel, CourseItem, CourseStatus, PointsCalculationResult } from './courses.types';

export const MULTIPLIERS: Record<CardLevel, number> = {
    [CardLevel.STANDART]: 1,
    [CardLevel.STANDARD]: 1,
    [CardLevel.SILVER]: 1.5,
    [CardLevel.GOLD]: 2,
};

/**
 * Чистая функция подсчета баллов
 */
export const calculatePointsLogic = (courses: CourseItem[], cardLevel: CardLevel = CardLevel.STANDART): PointsCalculationResult => {
    const multiplier = MULTIPLIERS[cardLevel];
    const result: PointsCalculationResult = {
        totalEarned: 0,
        totalFuture: 0,
        earnedCourses: [],
        futureCourses: [],
    };

    for (const course of courses) {
        if (course.status === CourseStatus.FINISHED) continue;

        const adjustedPoints = Math.round(course.points * multiplier);
        const isLessonsCompleted = course.stats.countLessons > 0 && course.stats.countLessons === course.stats.countLessonsLearned;

        if (course.status === CourseStatus.ACTIVE && isLessonsCompleted) {
            result.totalEarned += adjustedPoints;
            result.earnedCourses.push(adjustedPoints);
        } else if ((course.status === CourseStatus.ACTIVE && !isLessonsCompleted) || course.status === CourseStatus.NONE) {
            // Это группа для "Поставить в работу"
            result.totalFuture += adjustedPoints;
            result.futureCourses.push(adjustedPoints);
        }
    }

    return result;
};

/**
 * Генератор возможных сумм для кнопок (Subset Sum problem - simplified)
 * Генерирует уникальные суммы, которые можно собрать из доступных курсов.
 */
export const generatePointOptions = (availablePoints: number[]): number[] => {
    // Используем Set для уникальности
    const sums = new Set<number>();
    sums.add(0);

    // Динамическое программирование для поиска всех возможных сумм
    for (const point of availablePoints) {
        const newSums = new Set<number>();
        for (const sum of sums) {
            newSums.add(sum + point);
        }
        // Объединяем наборы
        newSums.forEach(s => sums.add(s));
    }

    // Удаляем 0, сортируем и берем, например, первые 10-15 вариантов или фильтруем "мелкие" шаги
    // Для UX лучше оставить логичные шаги.
    return Array.from(sums)
        .filter(s => s > 0)
        .sort((a, b) => a - b);
};

export const RANGE_STEP = 1000;

/**
 * Группирует плоский список сумм по диапазонам (0-1000, 1000-2000 и т.д.)
 */
export const getAvailableRanges = (options: number[]): number[] => {
    const ranges = new Set<number>();

    options.forEach(opt => {
        // Вычисляем верхнюю границу для числа.
        // Для 300 -> 1000. Для 1500 -> 2000. Для 2000 -> 2000.
        // Math.ceil(opt / 1000) * 1000.
        // Если число ровно 1000, оно попадет в "до 1000". Если 1001 - в "до 2000".
        let rangeCeiling = Math.ceil(opt / RANGE_STEP) * RANGE_STEP;
        if (rangeCeiling === 0) rangeCeiling = RANGE_STEP; // защита от 0
        ranges.add(rangeCeiling);
    });

    // Сортируем диапазоны: 1000, 2000, 3000...
    return Array.from(ranges).sort((a, b) => a - b);
};

/**
 * Возвращает опции, попадающие в конкретный диапазон
 * Например, rangeLimit = 3000 (значит ищем от 2001 до 3000)
 */
export const getOptionsInSpecificRange = (options: number[], rangeLimit: number): number[] => {
    const minLimit = rangeLimit - RANGE_STEP;
    return options.filter(opt => opt > minLimit && opt <= rangeLimit);
};
