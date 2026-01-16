import { Injectable, Logger } from '@nestjs/common';
import { COURSE_ANSWERS, COURSE_ID_TO_MNEMO } from '../data/course-answers.data';

@Injectable()
export class CourseAnswersRepository {
    private readonly logger = new Logger(CourseAnswersRepository.name);

    getMnemocode(courseId: number, originalMnemo: string): string {
        return COURSE_ID_TO_MNEMO[courseId] || originalMnemo;
    }

    getAnswers(mnemocode: string) {
        const courseAnswer = COURSE_ANSWERS[mnemocode]?.answers;
        if (!courseAnswer) {
            this.logger.warn(`Нет ответов для курса ${mnemocode}`);
            throw new Error(`Ошибка в answersData для mnemocode: ${mnemocode}`);
        }
        return courseAnswer;
    }
}
