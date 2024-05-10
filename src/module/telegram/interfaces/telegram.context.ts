import { Scenes } from 'telegraf';

interface SessionData {
    [key: string]: any;
}

export interface Context extends Scenes.SceneContext {
    mySession?: SessionData;
}
