export interface FamilyInviteResponse {
    isRegisteredMember: boolean;
    shareLink: string;
}

export interface InviteMemberFamily {
    memberPhone: string;
    memberName: string;
    familyId?: string;
}

export interface MemberFamily {
    familyId: string;
    memberId: string;
}
