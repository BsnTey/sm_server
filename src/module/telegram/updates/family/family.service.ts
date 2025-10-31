import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountService } from '../../../account/account.service';
import { UserService } from '../../../user/user.service';
import { TelegramService } from '../../telegram.service';
import { ProfileFamilyResponse, StatusFamilyMember } from '../../../account/interfaces/profile-family.interface';
import { InviteMemberFamily, MemberFamily } from '../../../account/interfaces/family-invite.interface';
import {
    defaultFamilyStatusKeyboard,
    deleteYourselfFamilyStatusKeyboard,
    invitedFamilyStatusKeyboard,
    leaveFamilyKeyboard,
    ownerFamilyStatusKeyboard,
    refreshFamilyStatusKeyboard,
} from '../../keyboards/family.keyboard';
import { PhoneName } from '../../interfaces/person.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class FamilyService {
    constructor(
        private readonly accountService: AccountService,
        private readonly userService: UserService,
        private readonly telegramService: TelegramService,
    ) {}

    async getFamilyView(accountId: string, userRole: UserRole) {
        const familyResponse = await this.accountService.getProfileFamily(accountId);
        const status = familyResponse.family?.currentMember?.status;

        switch (userRole) {
            case UserRole.Admin:
                return this.getViewForAdmin(accountId, familyResponse, status);
            case UserRole.Seller:
                return this.getViewForSeller(familyResponse, status);
            default:
                throw new BadRequestException('Недостаточно прав для просмотра информации о семье');
        }
    }

    async getFamilyViewUser(accountId: string) {
        const familyResponse = await this.accountService.getProfileFamily(accountId);
        const status = familyResponse.family?.currentMember?.status;
        return this.getViewDefault(accountId, familyResponse, status);
    }

    private async getViewDefault(accountId: string, familyResponse: ProfileFamilyResponse, status?: StatusFamilyMember) {
        switch (status) {
            case undefined: {
                const profileResponse = await this.accountService.getProfile(accountId);
                const text = `📱 Аккаунт найден. Баланс: ${familyResponse.bonusInfo.personalAmount} баллов.\nДанные аккаунта для привязки:\n- Номер телефона: ${profileResponse.profile.phone.nationalNumber}\n- Имя: ${profileResponse.profile.anketa.firstName} (или любое другое)`;
                return { text, keyboard: refreshFamilyStatusKeyboard };
            }
            case StatusFamilyMember.INVITED: {
                const text = `📱 Аккаунт найден и приглашен в семью.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                return { text, keyboard: invitedFamilyStatusKeyboard };
            }
            case StatusFamilyMember.MEMBER: {
                const text = `📱 Аккаунт найден. Персональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\nПокиньте семью, прежде чем вступить в новую`;
                return {
                    text,
                    keyboard: deleteYourselfFamilyStatusKeyboard(familyResponse.family!.id, familyResponse.family!.currentMember.id),
                };
            }
            default: {
                const text = `📱 Аккаунт найден. Персональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\nПокиньте семью, прежде чем вступить в новую`;
                return { text, keyboard: leaveFamilyKeyboard };
            }
        }
    }

    private async getViewForSeller(familyResponse: ProfileFamilyResponse, status?: StatusFamilyMember) {
        let text;
        let keyboard;
        switch (status) {
            case StatusFamilyMember.OWNER: {
                text = `📱 Аккаунт найден и является владельцем семьи.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\nПригласить можно аккаунт, если после покупки прошло не более 24ч и аккаунт был без промокода`;
                keyboard = ownerFamilyStatusKeyboard(familyResponse.family!);
                break;
            }
            case StatusFamilyMember.MEMBER: {
                text = `📱 Аккаунт найден и является участником семьи.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                keyboard = deleteYourselfFamilyStatusKeyboard(familyResponse.family!.id, familyResponse.family!.currentMember.id);
                break;
            }
            case StatusFamilyMember.INVITED: {
                text = `📱 Аккаунт найден и приглашен в семью.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                keyboard = invitedFamilyStatusKeyboard;
                break;
            }
            default: {
                text = `📱 Аккаунт найден. Баланс: ${familyResponse.bonusInfo.personalAmount} баллов. Не состоит в семье\nПригласить можно аккаунт, если после покупки прошло не более 24ч и аккаунт был без промокода`;
                keyboard = defaultFamilyStatusKeyboard;
            }
        }
        return {
            text,
            keyboard,
        };
    }

    private async getViewForAdmin(accountId: string, familyResponse: ProfileFamilyResponse, status?: StatusFamilyMember) {
        switch (status) {
            case StatusFamilyMember.OWNER: {
                const text = `📱 Аккаунт найден и является владельцем семьи.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                return { text, keyboard: ownerFamilyStatusKeyboard(familyResponse.family!) };
            }
            case StatusFamilyMember.MEMBER: {
                const text = `📱 Аккаунт найден и является участником семьи.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                return {
                    text,
                    keyboard: deleteYourselfFamilyStatusKeyboard(familyResponse.family!.id, familyResponse.family!.currentMember.id),
                };
            }
            case StatusFamilyMember.INVITED: {
                const text = `📱 Аккаунт найден и приглашен в семью.\nПерсональный баланс: ${familyResponse.bonusInfo.personalAmount}.\nСемейный баланс: ${familyResponse.bonusInfo.totalAmount}.\n`;
                return { text, keyboard: invitedFamilyStatusKeyboard };
            }
            default: {
                const profileResponse = await this.accountService.getProfile(accountId);
                const text = `📱 Аккаунт найден. Баланс: ${familyResponse.bonusInfo.personalAmount} баллов.\nДанные аккаунта для привязки:\n- Номер телефона: ${profileResponse.profile.phone.nationalNumber}\n- Имя: ${profileResponse.profile.anketa.firstName} (или любое другое)`;
                return { text, keyboard: defaultFamilyStatusKeyboard };
            }
        }
    }

    async leaveFamily(accountId: string) {
        const profileFamilyResponse = await this.accountService.getProfileFamily(accountId);
        if (!profileFamilyResponse.family) {
            throw new NotFoundException('Семья не найдена');
        }

        await this.accountService.deleteFamily(accountId, profileFamilyResponse.family.id);
        return { ok: true };
    }

    async excludeMemberFamily(accountId: string, member: MemberFamily) {
        const profileFamilyResponse = await this.accountService.getProfileFamily(accountId);
        if (!profileFamilyResponse.family || profileFamilyResponse.family.id != member.familyId) {
            throw new NotFoundException('Семья не найдена');
        }

        if (!profileFamilyResponse.family.members.find(el => el.id == member.memberId))
            throw new NotFoundException('Участник не найден в семье');

        await this.accountService.deleteFamilyMember(accountId, member);
        return { ok: true };
    }

    async getProfileNamePhone(accountId: string): Promise<PhoneName> {
        const profileResponse = await this.accountService.getProfile(accountId);
        return {
            name: profileResponse.profile.anketa.firstName,
            phone: String(profileResponse.profile.phone.nationalNumber),
        };
    }

    async getFamilyProfile(accountId: string) {
        return this.accountService.getProfileFamily(accountId);
    }

    isValidForInvite(profile: ProfileFamilyResponse): boolean {
        const status = profile.family?.currentMember?.status;
        const isOwner = StatusFamilyMember.OWNER === status;
        const isInvited = StatusFamilyMember.INVITED === status;
        const isMember = StatusFamilyMember.MEMBER === status;
        const statusIsNull = status == null;
        const familyIsNull = profile.family == null;

        return (!isOwner && !isInvited && !isMember) || statusIsNull || familyIsNull;
    }

    async inviteMember(accountId: string, phoneName: PhoneName) {
        const profileFamilyResponse = await this.getFamilyProfile(accountId);
        const status = profileFamilyResponse.family?.currentMember?.status;
        const isOwner = StatusFamilyMember.OWNER === status;
        const statusIsNull = status == null;
        const familyIsNull = profileFamilyResponse.family == null;

        if (!(statusIsNull || isOwner || familyIsNull)) {
            throw new BadRequestException('Невозможно пригласить нового члена. Вы не являетесь владельцем семьи');
        }

        const memberName = phoneName.name || 'Семен';

        const member: InviteMemberFamily = {
            memberPhone: phoneName.phone,
            memberName,
        };

        if (familyIsNull) {
            await this.accountService.familyInvite(accountId, member);
        } else {
            const familyId = profileFamilyResponse.family?.id;
            if (familyId) (member as any).familyId = familyId;
            await this.accountService.familyInvite(accountId, member);
        }

        return { ok: true };
    }

    async answerInvite(accountId: string, accept: boolean) {
        const familyResponse = await this.accountService.getProfileFamily(accountId);
        const status = familyResponse.family?.currentMember?.status;

        if (status !== StatusFamilyMember.INVITED) {
            throw new BadRequestException('Вы не были приглашены в семью');
        }

        await this.accountService.familyAnswer(accountId, familyResponse.family!.id, accept);
        return { accepted: accept };
    }

    async getAccountIdByTelegram(telegramId: string) {
        const account = await this.telegramService.getFromCache(telegramId);
        if (!account?.accountId) throw new NotFoundException('Информация устарела. Попробуйте заново');
        return account.accountId;
    }
}
