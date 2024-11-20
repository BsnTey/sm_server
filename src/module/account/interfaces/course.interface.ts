import { Lesson, OriginalCourse } from '@prisma/client';

export interface CourseWithLessons extends OriginalCourse {
    lessons: Lesson[];
}
