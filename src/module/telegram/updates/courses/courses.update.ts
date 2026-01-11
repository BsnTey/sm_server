import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { COURSES_SCENE, GET_COURSES_SCENE } from '../../scenes/profile.scene-constant';
import { BaseUpdate } from '../base/base.update';
import { RedisCacheService } from '../../../cache/cache.service';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { coursesCacheKey } from '../../cashe-key/keys';
import { CourseWorkService } from '../../../courses/courses.service';

const TTL_COURSES = 3600;

@Scene(COURSES_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class CoursesUpdate extends BaseUpdate {
    constructor(private cacheService: RedisCacheService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        await ctx.reply('🔑 Пришлите номер вашего аккаунта:');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() sender: SenderTelegram,
        @Ctx() ctx: WizardContext,
    ) {
        await this.cacheService.set(coursesCacheKey(sender.id), { accountId }, TTL_COURSES);
        await ctx.scene.enter(GET_COURSES_SCENE);
    }
}

@Scene(GET_COURSES_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class GetCoursesUpdate extends BaseUpdate {
    constructor(
        private cacheService: RedisCacheService,
        private courseWorkService: CourseWorkService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const account = await this.cacheService.get<{ accountId: string }>(coursesCacheKey(sender.id));
        if (!account) return ctx.reply('Сессия истекла.');

        const courses = await this.courseWorkService.getCoursesByAccountId(account.accountId);
        await ctx.reply(courses);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
}
