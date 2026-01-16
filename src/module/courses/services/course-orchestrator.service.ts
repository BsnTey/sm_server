import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../../account/account.service';
import { CourseStatus } from '../interfaces/courses.types';
import { CourseFlowPayload, FlowJobType } from '../interfaces/course-queue.interface';
import { VIEWING_CONFIG } from '../constants';
import { LessonStatus } from '../../account/interfaces/course-data.interface';

@Injectable()
export class CourseOrchestratorService {
    private readonly logger = new Logger(CourseOrchestratorService.name);

    constructor(private readonly accountService: AccountService) {}

    /**
     * Анализирует текущее состояние и возвращает следующий шаг
     */
    async decideNextStep(payload: CourseFlowPayload): Promise<{ nextPayload: CourseFlowPayload; delay: number }> {
        const { courseIds, accountId } = payload;

        // 1. Если список пуст — финиш
        if (courseIds.length === 0) {
            return {
                nextPayload: { ...payload, type: FlowJobType.FINISH },
                delay: 0,
            };
        }

        const currentCourseId = courseIds[0];
        const courseData = await this.accountService.getCoursesById(accountId, currentCourseId);

        // 2. Если курс не активен — активируем и перезапускаем проверку через 1с
        if (courseData.status === LessonStatus.NONE) {
            this.logger.log(`Orchestrator: Активация курса ${currentCourseId} для ${accountId}`);
            await this.accountService.activateCourse(accountId, courseData.mnemocode);
            return { nextPayload: payload, delay: 1000 };
        }

        // 3. Ищем непросмотренные уроки
        const unwatchedLesson = courseData.lessons.find(l => l.status !== LessonStatus.VIEWED);

        if (unwatchedLesson) {
            // НАШЛИ УРОК -> Создаем задачу на просмотр
            // Рассчитываем задержку (имитация просмотра 50% времени), для мелких курсов минималка 2мин, иначе ошибка
            const waitTime = Math.max(Math.ceil(unwatchedLesson.duration * VIEWING_CONFIG.SPEED_FACTOR * 1000), 120000);

            this.logger.log(`Orchestrator: Найден урок "${unwatchedLesson.title}" для ${accountId}. Ждем ${waitTime / 1000}с перед просмотром.`);

            return {
                nextPayload: {
                    ...payload,
                    type: FlowJobType.WATCH_LESSON,
                    currentCourseId,
                    lessonId: unwatchedLesson.id.toString(),
                    mnemocode: courseData.mnemocode,
                    duration: unwatchedLesson.duration,
                    lessonTitle: unwatchedLesson.title,
                },
                delay: waitTime,
            };
        }

        // 4. Уроки кончились. Нужно ли проходить тест?
        if (!payload.skipTests && courseData.status !== CourseStatus.FINISHED) {
            this.logger.log(`Orchestrator: Уроки пройдены, назначаем тест для ${currentCourseId} для ${accountId}`);
            return {
                nextPayload: {
                    ...payload,
                    type: FlowJobType.PASS_TEST,
                    currentCourseId,
                    mnemocode: courseData.mnemocode,
                },
                delay: 1000,
            };
        }

        // 5. Курс полностью завершен (или тесты скипнуты).
        // Удаляем текущий курс из списка и рекурсивно вызываем decideNext для следующего
        this.logger.log(`Orchestrator: Курс ${currentCourseId} завершен для ${accountId}. Переход к следующему.`);
        const nextIds = courseIds.slice(1);

        return {
            nextPayload: {
                ...payload,
                type: FlowJobType.DECIDE_NEXT,
                courseIds: nextIds,
            },
            delay: 1000,
        };
    }
}
