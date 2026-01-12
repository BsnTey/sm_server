export interface CourseTest {
    success: boolean;
    questionCount: number;
    correctAnswerCount: number;
    bonuses: Bonus[];
}

export interface Bonus {
    level: string;
    text: string;
    value: string;
}