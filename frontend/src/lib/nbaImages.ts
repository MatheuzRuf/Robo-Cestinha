export type NbaHeadshotSize = 'thumbnail' | 'profile';

const HEADSHOT_DIMENSIONS: Record<NbaHeadshotSize, string> = {
  thumbnail: '260x190',
  profile: '1040x760',
};

export function getNbaPlayerHeadshotUrl(
  nbaPlayerId: number | null | undefined,
  size: NbaHeadshotSize = 'thumbnail',
): string | null {
  if (!Number.isInteger(nbaPlayerId) || !nbaPlayerId || nbaPlayerId < 1) return null;

  return `https://cdn.nba.com/headshots/nba/latest/${HEADSHOT_DIMENSIONS[size]}/${nbaPlayerId}.png`;
}

export function getNbaTeamLogoUrl(nbaTeamId: number | null | undefined): string | null {
  if (!Number.isInteger(nbaTeamId) || !nbaTeamId || nbaTeamId < 1) return null;

  return `https://cdn.nba.com/logos/nba/${nbaTeamId}/primary/L/logo.svg`;
}
