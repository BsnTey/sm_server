import {
    ADMIN_SCENE,
    CALCULATE_SCENE,
    CASH_RECEIPT_SCENE,
    CHANGE_NUMBER_SCENE,
    CHECKER_SCENE,
    COOKIE_SCENE,
    HELP_SCENE,
    ORDER_SCENE,
    PROFILE_SCENE,
    QR_CODE_SCENE,
    START_SCENE,
} from '../../scenes/base.scene-constants';

export const CALCULATE_BONUS = {
    name: '💵 Рассчитать стоимость',
    scene: CALCULATE_SCENE,
};

export const CHANGE_NUMBER = {
    name: '📱 Смена номера',
    scene: CHANGE_NUMBER_SCENE,
};

export const MAKE_ORDER = {
    name: '🛒 Сделать заказ',
    scene: ORDER_SCENE,
};

export const COOKIE = {
    name: '🔑 Выдать Cookie',
    scene: COOKIE_SCENE,
};

export const CHECK = {
    name: '♻️ Чекер',
    scene: CHECKER_SCENE,
};

export const QR_CODE = {
    name: '🪪 Выдать QR',
    scene: QR_CODE_SCENE,
};

export const CASH_RECEIPT = {
    name: '✉️ Выдать чек',
    scene: CASH_RECEIPT_SCENE,
};

export const PROFILE = {
    name: '🏠️ Личный кабинет',
    scene: PROFILE_SCENE,
};

export const HELP = {
    name: '📞 Поддержка',
    scene: HELP_SCENE,
};

export const START = {
    name: '/start',
    scene: START_SCENE,
};

export const ADMIN = {
    name: '/admin',
    scene: ADMIN_SCENE,
};

export const ALL_KEYS_MENU_BUTTON = [
    CALCULATE_BONUS,
    CHANGE_NUMBER,
    MAKE_ORDER,
    COOKIE,
    CHECK,
    QR_CODE,
    CASH_RECEIPT,
    PROFILE,
    HELP,
    START,
    ADMIN,
];

export const ALL_KEYS_MENU_BUTTON_NAME = ALL_KEYS_MENU_BUTTON.map(item => item.name);
export const getValueKeysMenu = (key: string) => ALL_KEYS_MENU_BUTTON.find(btnObj => key === btnObj.name)?.scene;
