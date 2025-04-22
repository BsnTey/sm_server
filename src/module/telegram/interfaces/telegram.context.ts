import { Scenes } from 'telegraf';

interface SessionData {
    [key: string]: any;
}

export interface Context extends Scenes.SceneContext {
    mySession?: SessionData;
}

export interface SenderTelegram {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    language_code: string;
}
