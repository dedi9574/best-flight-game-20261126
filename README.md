# Merpati Express

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun entries](https://make.fun/badge/best-flight-game-20261126-0057/entries)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun results](https://make.fun/badge/best-flight-game-20261126-0057/results)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original 2D canvas chase-view flight game, built for the
[make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).
Fly a little red-and-white prop plane over an island chain — coastline,
beaches, a city, a lake and a mountain range — through glowing target rings
and onto runway 09. All art is drawn in code and all sound is synthesized
with WebAudio; the game loads no network resources at all.

## Missions

1. **Island Hop** — fly through 8 rings before the fuel runs out. Each ring
   refills some fuel; flying dead-centre on the ring's altitude earns a bonus.
2. **Runway Landing** — follow the two guide rings down and land on runway 09
   within 3 minutes: slow, low and lined up with the runway, or it counts as
   a crash.
3. **Night Storm** — 6 rings at night in gusting wind and rain, with lightning
   and a smaller fuel tank.

Score, timer and best score (saved in `localStorage`) are on the HUD, along
with altitude, speed, heading, a compass strip, throttle / fuel / damage bars
and a live minimap. Hard hits on the mountains cost damage; running out of
fuel means gliding down and hoping for a soft field.

## Controls

| Input | Action |
| --- | --- |
| W / S or ↑ / ↓ | Throttle up / down |
| A / D or ← / → | Turn |
| Shift or E | Climb |
| Ctrl or Q | Descend |
| Hold left mouse button | Steer toward the pointer |
| Mouse wheel | Throttle |
| P | Pause |
| M | Mute |
| 1 / 2 / 3 | Pick a mission from the menu |
| R | Fly again after a mission ends |
| Esc | Back to the mission list |

## How to run

No build step and no dependencies — just serve the `game/` folder with any
static server and open `index.html` in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Screenshot scenes are reproducible with `?shot=start|play|landing|storm`
(for example `http://localhost:8080/?shot=play&seed=1`).

## Layout

- `game/index.html` — the page; loads `src/main.js` as a module.
- `game/src/config.js` — world size, physics and the three mission definitions.
- `game/src/world.js` — terrain: islands, city, runway, mountains, lake.
- `game/src/plane.js` — aircraft physics: throttle, turn, climb, fuel, damage.
- `game/src/render.js` — all canvas drawing: terrain, aircraft, rings, HUD, screens.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/audio.js` — synthesized WebAudio: engine hum, ring chime, crash, fanfare.
- `game/src/shots.js` — the `?shot=` scenes used for the screenshots.
- `game/src/random.js` — seeded RNG and angle helpers.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `$MAKEFUN_OUTPUT_DIR` and writes `dossier.json` with `buildDossier`.
- `screenshots/` — four real renders of the game (1280×720).

## License

MIT — see [LICENSE](LICENSE).
