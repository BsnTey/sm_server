import { Injectable } from '@nestjs/common';
import { CourseWithLessons } from './interfaces/course.interface';
import { CourseRepository } from './course.repository';

@Injectable()
export class CourseService {
    constructor(private courseRepository: CourseRepository) {}

    async getCoursesWithLessons(): Promise<CourseWithLessons[]> {
        return this.courseRepository.getCoursesWithLessons();
    }

    async createAccountCourse(accountId: string, course: CourseWithLessons): Promise<void> {
        return await this.courseRepository.createAccountCourse(accountId, course);
    }

    async createAccountLessonProgress(accountId: string, course: CourseWithLessons): Promise<void> {
        return await this.courseRepository.createAccountLessonProgress(accountId, course);
    }

    async updateViewedLesson(progressId: number): Promise<void> {
        await this.courseRepository.updateViewedLesson(progressId);
    }

    async updateUnblockLesson(progressId: number, timeUnblock: Date): Promise<void> {
        await this.courseRepository.updateUnblockLesson(progressId, timeUnblock);
    }

    async unBlockCourse(accountCourseId: number): Promise<void> {
        await this.courseRepository.unBlockCourse(accountCourseId);
    }

    async finishCourse(accountCourseId: number): Promise<void> {
        await this.courseRepository.finishCourse(accountCourseId);
    }
}
