# Geo Pinas

An interactive Philippine province map with explore, weather, travel tracking, quiz, and fun facts tools. Built for fun, free and open source.

## Features

- All 83 Philippine provinces (including Metro Manila as NCR)
- **Explore** — browse and search provinces by region
- **Weather** — live weather conditions per province via Open-Meteo
- **Travel Level** — track how well you've visited each province, with a score, progress bar, and achievements
- **Province Quiz** — test your knowledge of Philippine provinces
- **Fun Facts** — random facts about selected provinces
- Map customization: sea color, land color, border color, sea texture, province borders toggle
- Dark / light mode (respects device preference, persists across sessions)
- Zoom and pan with mouse / touch or the +/⊙/− buttons

## Tech Stack

- [D3.js v7](https://d3js.org/) — SVG rendering, zoom/pan
- [Twemoji](https://github.com/twitter/twemoji) — emoji weather icons
- [Open-Meteo API](https://open-meteo.com/) — free weather data (no API key required)
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) — province summaries
- Vanilla JS + SVG — no framework, no build step

## Inspiration & Credits

**Travel Level concept** inspired by  
**[My Philippines Travel Level](https://my-philippines-travel-level.com/)** — the original tool for tracking which Philippine provinces you've visited.

**Province map shapes** adapted from  
**[OSSPhilippines / philippines-travel-level-map](https://github.com/OSSPhilippines/philippines-travel-level-map)**  
licensed under the [GNU General Public License v3.0 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html).

**Province flag images** sourced from  
**[Flags of the World (crwflags.com)](https://www.crwflags.com/fotw/flags/ph.html)** — used for reference/educational purposes.

Additional flag images (Zamboanga Sibugay, Davao de Oro, Davao Occidental, Sarangani, Dinagat Islands, Apayao) sourced from  
**[Wikimedia Commons](https://commons.wikimedia.org/)** — used under their respective free licenses.

Southern Leyte flag image sourced from the  
**[official Southern Leyte provincial government website](https://southernleyte.gov.ph/)**.

## License

In compliance with GPL-3.0:

- The source code of this project is publicly available.
- This project is distributed under **[GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html)**.
- Any modifications to the map shape data retain the same license.

This project is made for fun and educational purposes only. No commercial use intended.
