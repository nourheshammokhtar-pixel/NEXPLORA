# NASA and science data sources

The app separates NASA source material from its generated lunar artwork and simplified game values. NASA does not endorse this project.

| Source | In-game use | Live or saved | Limits |
|---|---|---|---|
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI) | The game requests recent FLR (solar flare) records for the Day 9 educational alert. A record is labeled historical and is never presented as a current safety warning. | Live request to `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR`. If it fails, the game uses a clearly labeled practice alert. | The browser test loaded a recent-record response. The game derives no numeric radiation model from flare records. |
| [NASA Images and Video Library](https://images.nasa.gov/) | Loads real lunar image thumbnails, titles, descriptions, credits, and source records in the Science Center. A thumbnail opens an enlarged preview. | Live search at `https://images-api.nasa.gov/search?q=lunar%20surface%20Moon&media_type=image&page_size=6`. Successful results are cached in LocalStorage and labeled as saved rather than live on later loads. | The browser test received six records and loaded a NASA thumbnail. Network failures show an error state, retry control, and link to the NASA library. |
| [NASA Open Science Data Repository](https://osdr.nasa.gov/) | Provides links for exploring space biology data. | Linked source, not numerically ingested. | No OSDR findings are currently modeled as game facts or health values. |
| [NASA RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | Linked for radiation dosimetry learning. | Linked source, not numerically ingested. | Crew health points are invented game-balancing values, not dose calculations or medical guidance. |
| [NASA Moon water and ice](https://science.nasa.gov/moon/moon-water-and-ices/) | Provides context for shadowed lunar regions and water-ice exploration. | Linked learning source. | Game site profiles are strategic game settings, not measured landing-site forecasts. |
| [NASA Artemis](https://www.nasa.gov/humans-in-space/artemis/), [LRO](https://science.nasa.gov/mission/lro/), [VIPER](https://science.nasa.gov/mission/viper/) | Gives players links to lunar exploration programs and missions. | Linked learning sources. | The game does not ingest mission map or temperature data. |
| [Canadian Space Agency](https://www.asc-csa.gc.ca/eng/) | Credited as a source to explore for space food and lunar food-production work. | Source hub link only. | The specific CSA “Food production on the Moon” toolkit page was not verified or used to create gameplay numbers. |

## What the simulation calculates

- The selected site applies a game-only sunlight multiplier to the power added at each day boundary.
- Solar panels, life support, stored supplies, and mission choices change the shared game state.
- The Day 9 solar-weather choice is based on a recent DONKI flare record only if the live request succeeds. Otherwise, it is explicitly a practice scenario.
- Site terrain, resource pickups, building recipes, and crew-health changes are authored game settings.

## Verification notes

The live DONKI request, NASA Images search, and at least one NASA image thumbnail were verified in the browser. The CSA toolkit destination and NASA-derived health or radiation formulas were not independently verified. No static NASA event is labeled as live, and no unverifiable health or radiation value is presented as NASA data.
