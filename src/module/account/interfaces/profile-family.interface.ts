export interface ProfileFamilyResponse {
    family: Family | null;
    bonusInfo: BonusInfo;
    email: Email;
    advertising: boolean;
    subscriptionReceiptAvailable: boolean;
}

export interface Email {
    email: string;
    isConfirmed: boolean;
}

export interface BonusInfo {
    bonusLevel: BonusLevel;
    totalAmount: number;
    personalAmount: number;
}

export interface BonusLevel {
    name: string;
    code: string;
}

export interface Family {
    id: string;
    currentMember: CurrentMember;
    invitationSenderName: string;
    invitationSenderPhone: string;
    members: Member[];
    settings: Settings;
}

export interface Settings {
    maxInvitations: number;
    maxInvitationsDates: number;
    maxJoins: number;
    maxJoinsDays: number;
    maxFamilySize: number;
}

export interface Member {
    name: string;
    phone: string;
    status: StatusFamilyMember;
    id: string;
    inviteCode?: string;
}

export interface CurrentMember {
    id: string;
    phone: string;
    status: StatusFamilyMember;
    availableInvitationsAmount: number;
    limitsRefreshDate: string;
    invitationEndTime?: any;
    availableJoinsAmount: number;
    limitsJoinsRefreshDate?: any;
}

export enum StatusFamilyMember {
    OWNER = 'OWNER',
    INVITED = 'INVITED',
    MEMBER = 'MEMBER',
}

export const statusFamilyMemberRus = {
    OWNER: 'Владелец',
    INVITED: 'Приглашен',
    MEMBER: 'Участник',
};
