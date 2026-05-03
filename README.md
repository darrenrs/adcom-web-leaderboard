# AdVenture Communist Web Leaderboard

A freely accessible fullstack Node.js server that enables players of the idle game AdVenture Communist to gain insights into its competitive events. Currently live on [Idle Game Tools](https://idlegametools.com/adcom-leaderboard/).

Note: No new features will be added to this site as of May 3, 2026, but maintenance will continue to take place.

## Technical Background

The website is built in Node.js/Express with a SQLite database. It is far from cutting-edge and reflects technical quality from 2022-23.

The underlying REST API leverages Hyper Hippo's undocumented Google Cloud API to make player records easily accessible in a clean and security-oriented format. Most API requests act as a gateway to the Hyper Hippo Leaderboard API, while a few others deal with internal databases such as player caching. Most parts of the website require a player to input their PlayFab-issued ID. PlayFabs cached in the website or used in the Discord leaderboard are only accessible to site administrator(s). Some API requests are issued to Discord and PlayFab API to augment the user experience.

Although events were added to AdVenture Communist on May 9, 2019, the original leaderboards were bare-bones and did not expose nearly as much information as the September 2022 revamp. In addition, the original leaderboards required PlayFab authentication and were much slower than the newer Google Cloud API because of the presence of an additional, throttled gateway server. Last but not least, it natively supports dark mode.

## Build Instructions

As of March 2025 the website runs on a Docker container. With Docker Compose installed on a Linux/macOS system, run `build.sh` to start the server.

In addition, as of May 2026, you also will need to have the [AdCom Assets app](https://github.com/darrenrs/adcom-assets) running. It is not technically required but certain parts of the website will not work without it.

### Environment Variables (`.env`)

Please make a copy of `.env.example` and rename it to `.env`. This file is mandatory and the app will fail to start without it.

#### Variable Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Express server port. |
| `ASSET_SERVER` | Yes | Backend-to-backend asset server base URL. |
| `ASSET_PUBLIC_BASE` | Yes | Browser-facing asset base URL for images/JSON. |
| `ASSET_UPDATE_URL` | No | Override for update endpoint. Defaults to `${ASSET_SERVER}/update`. |
| `ADMIN_PWD` | Yes | SHA-256 hash of leaderboard admin password (not plain text). |
| `API_APPLICATION_ID` | Yes | Hyper Hippo project/application id (example: `adcom`). |
| `API_URL_LEADERBOARD` | Yes | HH leaderboard API base URL. |
| `API_URL_PLAYERMETA` | Yes | HH player metadata API base URL. |
| `API_GCLOUD_TOKEN` | Yes | Auth token used for HH API requests. |
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth client id. |
| `DISCORD_SECRET` | Yes | Discord OAuth client secret. |
| `GC_DEVICE_ID` | Yes | Device id used for PlayFab auth requests. |
| `PLAYFAB_TITLE_ID` | Yes | PlayFab title id / asset namespace (example: `6bf5`). |
| `COMMIT_HASH` | No | Build metadata injected by Docker/build script. |

#### Practical Notes

- In Docker, if the asset server runs on the host machine, use `ASSET_SERVER=http://host.docker.internal:3002`.
- `ASSET_SERVER` is backend reachability; `ASSET_PUBLIC_BASE` is browser reachability (they can differ).
- Typical values:
  `ASSET_PUBLIC_BASE=http://localhost:3002/assets/6bf5` (dev) and `ASSET_PUBLIC_BASE=https://idlegametools.com/adcom-assets/assets/6bf5` (prod).
- Generate `ADMIN_PWD` from a plain password:
  `echo -n "your-password" | shasum -a 256`

## Additional Uses

The public API is used as the primary data source by [Catster's visual leaderboard](https://github.com/KittyCatGamer123/adcom-discordleaderboard-visual).

## Disclaimer

This material is not official and is not endorsed by Hyper Hippo. For more information, see [Hyper Hippo’s Fan Content Policy.](https://hyperhippo.com/fan-content-policy/)

All code in this repository, with the exception of `public/img/github.png` and `public/img/icon.png` are released under the provisions of the MIT license.

Copyright (C) 2022-26 Darren R. Skidmore ("Enigma"). All rights reserved.
