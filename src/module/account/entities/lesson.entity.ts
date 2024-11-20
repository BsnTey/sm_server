import { Lesson, LessonStatus, OriginalCourse } from '@prisma/client';

export class LessonEntity implements Lesson {
    lessonId: string;
    title: string;
    duration: number;
    position: number;
    status: LessonStatus;
    videoId: string;
    courseId: string;
    mnemocode: string;

    constructor(lesson: Lesson & { course: OriginalCourse }) {
        Object.assign(this, lesson);
        this.mnemocode = lesson.course.mnemocode;
    }
}
