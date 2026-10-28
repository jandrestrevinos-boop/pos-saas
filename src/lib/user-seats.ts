/**
 * Límite de usuarios POR SUCURSAL.
 *
 *   usuarios del plan (License.allowedUsers, por sucursal)
 *   + asientos extra pactados (Subscription.extraUsersPerBranch, puede ser negativo)
 *
 * Cada sucursal tiene su propio tope. Con extraUsersPerBranch = 0 el tope es
 * el del plan. Nunca baja de 1.
 */
export function userLimitPerBranch(baseUsers: number, extraUsersPerBranch: number | null | undefined): number {
  return Math.max(1, baseUsers + (extraUsersPerBranch ?? 0));
}
