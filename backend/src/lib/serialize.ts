// Shared serialisers so every endpoint returns the exact same public shape.
//
// Previously each route hand-built the user object it sent to the client, and
// they drifted apart: `register` forgot `systemPrompt`, so a freshly-registered
// user had `systemPrompt: undefined` until their next login. Centralising the
// projection here removes that whole class of bug.

// Structural type of the columns we expose. Kept independent of the generated
// Prisma `User` type so it type-checks even when the client hasn't been
// generated yet (e.g. offline), while still matching the real row at runtime.
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  onboardingDone: boolean;
  defaultModel: string;
  personality: string;
  chatMode: boolean;
  soundEnabled: boolean;
  avatarColor: string;
  systemPrompt: string | null;
}

export type PublicUser = UserRow;

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onboardingDone: user.onboardingDone,
    defaultModel: user.defaultModel,
    personality: user.personality,
    chatMode: user.chatMode,
    soundEnabled: user.soundEnabled,
    avatarColor: user.avatarColor,
    systemPrompt: user.systemPrompt,
  };
}
