import { Markup } from 'telegraf';
import { Family, StatusFamilyMember, statusFamilyMemberRus } from '../../account/interfaces/profile-family.interface';

export const ownerFamilyStatusKeyboard = (family: Family) => {
    const familyId = family.id;
    const countMember = family.members.length;

    const keyboard = [
        [Markup.button.callback('Покинуть семью', 'leave_family')],
        ...family.members
            .filter(member => member.status != StatusFamilyMember.OWNER)
            .map(member => [
                Markup.button.callback(
                    `Исключить ${member.name} (${statusFamilyMemberRus[member.status]})`,
                    `exclude_${familyId}_${member.id}`,
                ),
            ]),
    ];

    if (countMember < family.settings.maxFamilySize) {
        keyboard.unshift([Markup.button.callback('Пригласить участника', 'invite_member')]);
    }

    return Markup.inlineKeyboard(keyboard);
};

export const deleteYourselfFamilyStatusKeyboard = (familyId: string, memberId: string) => {
    return Markup.inlineKeyboard([[Markup.button.callback('Покинуть семью', `exclude_${familyId}_${memberId}`)]]);
};

export const invitedFamilyStatusKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Принять приглашение', 'accept_family')],
    [Markup.button.callback('Отклонить приглашение', 'reject_family')],
]);

export const defaultFamilyStatusKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Пригласить участника', 'invite_member')],
    [Markup.button.callback('Обновить информацию', 'refresh_info_family')],
]);

export const refreshFamilyStatusKeyboard = Markup.inlineKeyboard([[Markup.button.callback('Обновить информацию', 'refresh_info_family')]]);

export const leaveFamilyKeyboard = Markup.inlineKeyboard([[Markup.button.callback('Покинуть семью', 'leave_family')]]);

export const wantToBuyAcessKeyboard = (accountIdInvited: string) => {
    return Markup.inlineKeyboard([[Markup.button.callback('Купить', `buy_access_${accountIdInvited}`)]]);
};
