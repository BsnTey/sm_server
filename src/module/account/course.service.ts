import { Injectable } from '@nestjs/common';
import { CourseWithLessons } from './interfaces/course.interface';
import { CourseRepository } from './course.repository';
import { CourseStatus, Lesson, LessonStatus } from '@prisma/client';
import { CourseData } from './interfaces/course-data.interface';

@Injectable()
export class CourseService {
    constructor(private courseRepository: CourseRepository) {}

    async getCoursesWithLessons(): Promise<CourseWithLessons[]> {
        return this.courseRepository.getCoursesWithLessons();
    }

    async getAllLesson(): Promise<Lesson[]> {
        return this.courseRepository.getAllLesson();
    }

    async createAccountCourse(accountId: string, course: CourseWithLessons): Promise<void> {
        return await this.courseRepository.createAccountCourse(accountId, course);
    }

    async createAccountLessonProgress(accountId: string, lessons: Lesson[]): Promise<void> {
        return await this.courseRepository.createAccountLessonProgress(accountId, lessons);
    }

    async updateViewedLesson(progressId: number): Promise<void> {
        await this.courseRepository.updateViewedLesson(progressId);
    }

    async updateUnblockLesson(progressId: number, timeUnblock: Date): Promise<void> {
        await this.courseRepository.updateUnblockLesson(progressId, timeUnblock);
    }

    async changeStatusCourse(accountId: string, courseId: string, status: CourseStatus): Promise<void> {
        await this.courseRepository.changeStatusCourse(accountId, courseId, status);
    }

    async changeStatusLesson(accountId: string, lessonId: string, status: LessonStatus): Promise<void> {
        await this.courseRepository.changeStatusLesson(accountId, lessonId, status);
    }

    async synchronizationCourse(accountId: string, data: CourseData): Promise<string> {
        const lessons = data.lessons;
        const courseId = data.id;

        const statusCourse: CourseStatus = this.mapCourseStatus(data.status);
        await this.changeStatusCourse(accountId, String(courseId), statusCourse);

        for (const lesson of lessons) {
            const statusLesson: LessonStatus = this.mapLessonStatus(lesson.status);
            const lessonId = lesson.id;
            await this.changeStatusLesson(accountId, String(lessonId), statusLesson);
        }
        return 'ok';
    }

    private mapCourseStatus(status: string): CourseStatus {
        const statusMap: Record<string, CourseStatus> = {
            finished: CourseStatus.FINISHED,
            blocked: CourseStatus.BLOCKED,
            none: CourseStatus.ACTIVE,
            active: CourseStatus.ACTIVE,
        };

        return statusMap[status.toLowerCase()] || CourseStatus.NONE;
    }

    private mapLessonStatus(status: string): LessonStatus {
        const statusMap: Record<string, LessonStatus> = {
            viewed: LessonStatus.VIEWED,
            blocked: LessonStatus.BLOCKED,
            none: LessonStatus.NONE,
        };

        return statusMap[status.toLowerCase()] || LessonStatus.NONE;
    }
}
