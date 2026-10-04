import type { PlayerAttributes } from '../../../types/team';

let catalogValuesPromise: Promise<Record<keyof PlayerAttributes, number[]>> | null = null;

async function getCatalogValues() {
  if (!catalogValuesPromise) {
    catalogValuesPromise = import('../../../../../data/processed/players.json').then(({ default: playersCatalog }) => ({
      twoPointPct: playersCatalog.map((player) => player.attributes.two_pt_pct),
      threePointPct: playersCatalog.map((player) => player.attributes.three_pt_pct),
      freeThrowPct: playersCatalog.map((player) => player.attributes.ft_pct),
      turnoverRate: playersCatalog.map((player) => player.attributes.turnover_rate),
      foulRate: playersCatalog.map((player) => player.attributes.foul_rate),
      reboundRate: playersCatalog.map((player) => player.attributes.rebound_rate),
      assistRate: playersCatalog.map((player) => player.attributes.assist_rate),
      stealRate: playersCatalog.map((player) => player.attributes.steal_rate),
      blockRate: playersCatalog.map((player) => player.attributes.block_rate),
      stamina: playersCatalog.map((player) => player.attributes.stamina),
      clutchFactor: playersCatalog.map((player) => player.attributes.clutch_factor),
      usageRate: playersCatalog.map((player) => player.attributes.usage_rate),
    }));
  }

  return catalogValuesPromise;
}

export async function getPlayerCatalogPercentiles(
  attributes: PlayerAttributes,
): Promise<Record<keyof PlayerAttributes, number>> {
  const catalogValues = await getCatalogValues();
  return Object.fromEntries(
    Object.entries(catalogValues).map(([key, values]) => {
      const value = attributes[key as keyof PlayerAttributes];
      const atOrBelow = values.filter((catalogValue) => catalogValue <= value).length;
      return [key, Math.round((atOrBelow / values.length) * 100)];
    }),
  ) as Record<keyof PlayerAttributes, number>;
}
