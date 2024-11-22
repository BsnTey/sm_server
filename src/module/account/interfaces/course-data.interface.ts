export interface CourseData {
    id: number;
    mnemocode: string;
    title: string;
    image: string;
    tag: string;
    duration: number;
    points: number;
    stats: Stats;
    status: string;
    cover: string;
    lessons: Lesson[];
    test: Test;
    selection?: any;
    content: string;
}

export interface Test {
    id: number;
    questions: Question[];
    timeToRespond: number;
    status: string;
    timer?: any;
}

export interface Question {
    id: number;
    title: string;
    image?: any;
    answers: Answer[];
}

export interface Answer {
    id: number;
    text: string;
}

export interface Lesson {
    id: number;
    title: string;
    description: string;
    image: string;
    duration: number;
    videoId: string;
    status: string;
    timer?: any;
}

export interface Stats {
    countLessons: number;
    countLessonsLearned?: any;
}
