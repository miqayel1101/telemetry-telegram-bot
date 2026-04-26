export type RedeemUserTokenResult =
  | { status: 'ok'; coreUserId: number; firstName: string; lastName: string }
  | { status: 'expired' }
  | { status: 'already_used' }
  | { status: 'not_found' }
  | { status: 'wrong_purpose' };

export type RedeemGroupTokenResult =
  | { status: 'ok'; fleetId: number; coreUserId: number; fleetName: string; companyName: string }
  | { status: 'expired' }
  | { status: 'already_used' }
  | { status: 'not_found' }
  | { status: 'wrong_purpose' }
  | { status: 'no_fleet' };
