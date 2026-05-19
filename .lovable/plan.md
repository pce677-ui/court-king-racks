## Goal
Promote the "full stats" view (currently a sub-link from `/me` that routes to `/players/:playerId`) into a top-level page alongside Ranking and Matches.

## Changes

1. **New route `src/routes/_authenticated.stats.tsx`** → path `/stats`
   - For the signed-in user, renders the same stats UI used on `/players/$playerId` (ranking chart, win streak, toughest opponent, doubles partner chemistry, recent matches).
   - Extract the body of the existing player-profile page into a shared component `src/components/app/PlayerStats.tsx` that takes a `playerId` prop, so both `/stats` (self) and `/players/$playerId` (any player) render from one source of truth.

2. **Bottom nav `src/components/app/AppShell.tsx`**
   - Add a 4th nav entry: `Stats` (icon: `BarChart3`) between Matches and Me.
   - Switch the bottom nav grid from `grid-cols-3` to `grid-cols-4`.

3. **`/me` page `src/routes/_authenticated.me.tsx`**
   - Remove the "View full stats" link card (now redundant with the new tab).
   - Keep ranking-points header and profile editor.

4. **No DB changes, no business-logic changes.** Pure routing/UI refactor. Route tree regenerates automatically.

## Result
Bottom nav: Ranking · Matches · Stats · Me. Tapping Stats opens the current user's full stats page directly, with the same page-transition animation as other routes.
