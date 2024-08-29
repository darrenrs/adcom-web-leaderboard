# AdVenture Communist Web Leaderboard
A freely accessible fullstack Node.js server that enables players of the idle game AdVenture Communist to gain insights into its competitive leaderboards. Currently live on my [personal website](https://darrenskidmore.com/adcom-leaderboard/).

## Technical Background
The website is built in Node.js/Express with a SQLite database. It is far from cutting-edge and reflects technical quality from 2022-23.

The underlying REST API leverages Hyper Hippo's undocumented Google Cloud API to make player records easily accessible in a clean and security-oriented format. Most API requests act as a gateway to the Hyper Hippo Leaderboard API, while a few others deal with internal databases such as player caching. Most parts of the website require a player to input their PlayFab-issued ID. PlayFabs cached in the website or used in the Discord leaderboard are only accessible to site administrator(s). Some API requests are issued to Discord and PlayFab API to augment the user experience.

Although events were added to AdVenture Communist on May 9, 2019, the original leaderboards were bare-bones and did not expose nearly as much information as the September 2022 revamp. In addition, the original leaderboards required PlayFab authentication and were much slower than the newer Google Cloud API because of the presence of an additional, throttled gateway server. Last but not least, it natively supports dark mode.

## Pages
- Primary Event Summary (`/`) - View all of your previous events, including global and division placement.
- Top Players (`/top`) - View up to the top 1,000 players for a given event.
- Event List (`/eventlist`) - View every event that has ran since the inception of the new leaderboards.
- Account Registration (`/account`) - Add your account to the Discord leaderboard.
- Discord Leaderboard (`/discord`) - Compare yourself against the members of the [Official](https://discord.gg/XMeABQzk3C) and [Unofficial](https://discord.gg/hxPRpZME54) Discord servers. Good luck, for many are able to finish around the top 100 while remaining free-to-play.
- Event Report (`/report`) - View a report of every event you have ever played.
- Account Value (`/accountvalue`) - View the true value (lifetime amount spent in United States dollars) of a given account.
- Event Rank Estimator (`/rankestimator`) - Estimate the rank associated with a given timestamp and trophy count.
- Number of Players at MAX Rank (`/finished`) - See an estimate of how many players have finished the current event, and how much they might have spent (hint: it's probably way too much.) This leverages the regression-computed figures derived in the Rank Estimator.

## Additional Usages
The public API is used as the primary data source by [Catster's visual leaderboard](https://github.com/KittyCatGamer123/adcom-discordleaderboard-visual).

## Disclaimer
This material is not official and is not endorsed by Hyper Hippo. For more information, see [Hyper Hippo’s Fan Content Policy.](https://hyperhippo.com/fan-content-policy/)

Copyright (C) 2022-24 Darren R. Skidmore ("Enigma"). All rights reserved.
