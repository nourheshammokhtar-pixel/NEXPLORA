# NEXPLORA: Lunar Outpost

NEXPLORA is a browser-based lunar exploration game for young players. Walk around a generated Moon surface, collect supplies, mark a base site, build outpost modules, run a rover trip, study a rock sample, and manage a ten-day mission.

## Run the game

Open `idex.html` in a current desktop or mobile browser with WebGL enabled. The current workspace has no `package.json`, Node.js/npm installation, or Vite/React scaffold, so there is no `npm install` or `npm run dev` command yet. The game uses browser-native JavaScript and WebGL so its current version can run without a package install.

## Controls

- **W, A, S, D** or **arrow keys**: walk.
- **Click the ground**: walk to that spot.
- **Drag the world**: orbit the camera.
- **Mouse wheel**: zoom in or out.
- **E**: collect a nearby item or use a nearby building.
- **Touch**: drag the world to move and use the on-screen direction buttons.
- **Build**: choose a structure, then click a clear point near the marked base.

## Project files

- `idex.html`: screen structure, navigation, setup, dialogs, and game interface.
- `main.css`: responsive interface and welcome scene.
- `game.js`: shared mission state, inventory, objectives, resources, building placement, events, save/continue, Nova, passport, and NASA data UI.
- `scene.js`: standalone WebGL renderer, lunar terrain, astronaut, rover, buildings, camera orbit, zoom, and world picking.
- `DATA_SOURCES.md`: source links, data handling, and verification limits.

## Simulation notes

The Moon surface and all buildings are game-made art. Site sunlight settings, resource quantities, health changes, and building costs are simplified learning values. They are not engineering plans, landing-site measurements, radiation-dose guidance, or medical advice.

Progress is saved in this browser using LocalStorage. NASA requests need internet access. If a NASA request fails, the game labels the alert as a practice scenario and offers source links or a retry.

## Current implementation limit

This runnable workspace version is vanilla JavaScript/WebGL, not React, TypeScript, Vite, React Three Fiber, Tailwind, or Lucide. Those packages could not be installed or tested here because Node/npm are not installed and network name resolution is unavailable. The game has not been migrated to that stack.
