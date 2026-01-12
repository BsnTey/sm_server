export interface AnswerItem {
    questionId: number;
    answerId: number;
}

export interface CourseAnswerData {
    answers: AnswerItem[];
}

/**
 * Маппинг ID курса (из БД) в Mnemocode (строковый ключ)
 */
export const COURSE_ID_TO_MNEMO: Record<number, string> = {
    501: 'roller_start', // Как встать на ролики с нуля
    741: 'health_nordic_walking', // Секреты скандинавской ходьбы
    761: 'skiing_base', // Горные лыжи с нуля
    781: 'fitness_preparing', // Подготовка тела к тренировкам
    881: 'hiking', // Школа хайкинга
    901: 'freestyleski', // Школа фристайла
    341: 'football_keeping_passing',
    461: 'tourism_safety_comfort',
    601: 'snowboard_tricks',
    381: 'running_base',
    361: 'tourism_planning',
    421: 'skateboard_tricks',
    521: 'football_dribbling_kicking',
    481: 'health_kinesio',
    441: 'health_mfr',
    663: 'snowboard_base_technique',
    701: 'hockey_firststep',
    721: 'strength_training_base',
};

/**
 * Ответы на тесты
 */
export const COURSE_ANSWERS: Record<string, CourseAnswerData> = {
    football_keeping_passing: {
        answers: [
            { questionId: 1383, answerId: 3613 },
            { questionId: 1384, answerId: 3627 },
            { questionId: 1385, answerId: 3630 },
            { questionId: 1386, answerId: 3635 },
            { questionId: 1387, answerId: 3640 },
        ],
    },
    tourism_safety_comfort: {
        answers: [
            { questionId: 2181, answerId: 5062 },
            { questionId: 2182, answerId: 5067 },
            { questionId: 2183, answerId: 5068 },
            { questionId: 2184, answerId: 5071 },
        ],
    },
    snowboard_tricks: {
        answers: [
            { questionId: 5425, answerId: 9354 },
            { questionId: 5426, answerId: 9356 },
            { questionId: 5427, answerId: 9359 },
            { questionId: 5428, answerId: 9364 },
            { questionId: 5429, answerId: 9367 },
            { questionId: 5430, answerId: 9373 },
        ],
    },
    running_base: {
        answers: [
            { questionId: 1561, answerId: 3962 },
            { questionId: 1562, answerId: 4161 },
            { questionId: 1563, answerId: 3974 },
            { questionId: 1564, answerId: 3978 },
            { questionId: 1565, answerId: 3984 },
        ],
    },
    tourism_planning: {
        answers: [
            { questionId: 1521, answerId: 3877 },
            { questionId: 1522, answerId: 3881 },
            { questionId: 1523, answerId: 3882 },
            { questionId: 1524, answerId: 4091 },
            { questionId: 1525, answerId: 3888 },
            { questionId: 1526, answerId: 3893 },
            { questionId: 1527, answerId: 3895 },
            { questionId: 1528, answerId: 3901 },
            { questionId: 1529, answerId: 3903 },
            { questionId: 1530, answerId: 3909 },
            { questionId: 1531, answerId: 3914 },
        ],
    },
    skateboard_tricks: {
        answers: [
            { questionId: 1954, answerId: 4699 },
            { questionId: 1955, answerId: 4701 },
            { questionId: 1956, answerId: 4705 },
            { questionId: 1957, answerId: 4707 },
        ],
    },
    roller_start: {
        answers: [
            { questionId: 2690, answerId: 5741 },
            { questionId: 2691, answerId: 5745 },
            { questionId: 2692, answerId: 5749 },
            { questionId: 2693, answerId: 5750 },
            { questionId: 2694, answerId: 5754 },
        ],
    },
    football_dribbling_kicking: {
        answers: [
            { questionId: 2741, answerId: 5802 },
            { questionId: 2742, answerId: 5804 },
            { questionId: 2743, answerId: 5807 },
            { questionId: 2744, answerId: 5816 },
            { questionId: 2745, answerId: 5821 },
        ],
    },
    health_kinesio: {
        answers: [
            { questionId: 2681, answerId: 5702 },
            { questionId: 2682, answerId: 5707 },
            { questionId: 2683, answerId: 5708 },
            { questionId: 2684, answerId: 5712 },
            { questionId: 2685, answerId: 5716 },
            { questionId: 2686, answerId: 5719 },
            { questionId: 2687, answerId: 5721 },
            { questionId: 2688, answerId: 5725 },
            { questionId: 2689, answerId: 5730 },
        ],
    },
    health_mfr: {
        answers: [
            { questionId: 2085, answerId: 4913 },
            { questionId: 2086, answerId: 4917 },
            { questionId: 2087, answerId: 4920 },
            { questionId: 2088, answerId: 4924 },
            { questionId: 2089, answerId: 4930 },
            { questionId: 2090, answerId: 4933 },
            { questionId: 2091, answerId: 4937 },
            { questionId: 2092, answerId: 4941 },
        ],
    },
    snowboard_base_technique: {
        answers: [
            { questionId: 5987, answerId: 10240 },
            { questionId: 5988, answerId: 10242 },
            { questionId: 5989, answerId: 10246 },
            { questionId: 5990, answerId: 10250 },
            { questionId: 5991, answerId: 10254 },
            { questionId: 5992, answerId: 10255 },
            { questionId: 5993, answerId: 10259 },
            { questionId: 5994, answerId: 10261 },
        ],
    },
    hockey_firststep: {
        answers: [
            { questionId: 6190, answerId: 10615 },
            { questionId: 6191, answerId: 10616 },
            { questionId: 6192, answerId: 10620 },
            { questionId: 6193, answerId: 10624 },
            { questionId: 6194, answerId: 10625 },
            { questionId: 6195, answerId: 10631 },
            { questionId: 6196, answerId: 10633 },
            { questionId: 6197, answerId: 10638 },
        ],
    },
    health_nordic_walking: {
        answers: [
            { questionId: 6941, answerId: 12084 },
            { questionId: 6942, answerId: 12089 },
            { questionId: 6943, answerId: 12093 },
            { questionId: 6944, answerId: 12094 },
            { questionId: 6945, answerId: 12099 },
            { questionId: 6946, answerId: 12100 },
            { questionId: 6947, answerId: 12104 },
            { questionId: 6948, answerId: 12107 },
            { questionId: 6949, answerId: 12109 },
            { questionId: 6950, answerId: 12115 },
            { questionId: 6951, answerId: 12118 },
        ],
    },
    strength_training_base: {
        answers: [
            { questionId: 6201, answerId: 10656 },
            { questionId: 6202, answerId: 10657 },
            { questionId: 6203, answerId: 10661 },
            { questionId: 6204, answerId: 10667 },
            { questionId: 6205, answerId: 10670 },
            { questionId: 6206, answerId: 10673 },
            { questionId: 6207, answerId: 10677 },
            { questionId: 6208, answerId: 10679 },
            { questionId: 6209, answerId: 11164 },
            { questionId: 6210, answerId: 10686 },
            { questionId: 6211, answerId: 10689 },
            { questionId: 6212, answerId: 10696 },
            { questionId: 6213, answerId: 10698 },
            { questionId: 6214, answerId: 10699 },
            { questionId: 6215, answerId: 10703 },
            { questionId: 6216, answerId: 10709 },
            { questionId: 6217, answerId: 10712 },
            { questionId: 6218, answerId: 10714 },
            { questionId: 6219, answerId: 10721 },
        ],
    },
    skiing_base: {
        answers: [
            { questionId: 7130, answerId: 12488 },
            { questionId: 7131, answerId: 12493 },
            { questionId: 7132, answerId: 12497 },
            { questionId: 7133, answerId: 12500 },
            { questionId: 7134, answerId: 12502 },
            { questionId: 7135, answerId: 12504 },
            { questionId: 7136, answerId: 12509 },
            { questionId: 7137, answerId: 12512 },
            { questionId: 7138, answerId: 12514 },
        ],
    },
    fitness_preparing: {
        answers: [
            { questionId: 7281, answerId: 12781 },
            { questionId: 7282, answerId: 12786 },
            { questionId: 7283, answerId: 12791 },
            { questionId: 7284, answerId: 12795 },
            { questionId: 7285, answerId: 12796 },
            { questionId: 7286, answerId: 12799 },
            { questionId: 7287, answerId: 12804 },
            { questionId: 7288, answerId: 12808 },
            { questionId: 7289, answerId: 12810 },
            { questionId: 7290, answerId: 12814 },
            { questionId: 7291, answerId: 12818 },
            { questionId: 7292, answerId: 12824 },
        ],
    },
    hiking: {
        answers: [
            { questionId: 8241, answerId: 14542 },
            { questionId: 8242, answerId: 14544 },
            { questionId: 8244, answerId: 14550 },
            { questionId: 8245, answerId: 14557 },
            { questionId: 8246, answerId: 14558 },
            { questionId: 8249, answerId: 14569 },
            { questionId: 8243, answerId: 14548 },
            { questionId: 8247, answerId: 14564 },
            { questionId: 8248, answerId: 14567 },
            { questionId: 8250, answerId: 14571 },
            { questionId: 8251, answerId: 14578 },
            { questionId: 8252, answerId: 14581 },
        ],
    },
    freestyleski: {
        answers: [
            { questionId: 8481, answerId: 15081 },
            { questionId: 8482, answerId: 15085 },
            { questionId: 8483, answerId: 15089 },
            { questionId: 8484, answerId: 15090 },
            { questionId: 8501, answerId: 15103 },
            { questionId: 8502, answerId: 15105 },
            { questionId: 8503, answerId: 15108 },
            { questionId: 8504, answerId: 15111 },
        ],
    },
};
