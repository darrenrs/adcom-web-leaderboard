const express = require('express')
const fs = require('fs')
const axios = require('axios')

const app = express()
const port = 3000
let hhcfg

// load HH API endpoint and API key
// this information cannot be made public to minimize abuse against HH's systems
fs.readFile(__dirname + '/hh-config.json', 'utf8', (err, data) => {
  if (err) {
    console.log('Unable to load API config. PlayFab requests will not be enabled.')
  } else {
    console.log('Successfully loaded API config.')
    hhcfg = JSON.parse(data)
    hhcfg["fullBase"] = hhcfg["base"] + '/project/' + hhcfg["application"]
  }
})

// load static content
app.use(express.static('public'))
app.use(express.static(__dirname + "/node_modules/bootstrap/dist/"))

// master player API
app.get('/api/event/now/:id', async (req, res) => {
  const id = req.params.id
  console.log(`Querying player ${id}`)

  let getCurrentEventId = async() => {
    const eventListReq = await axios.get(`${hhcfg["fullBase"]}/leaderboards`, config={
    "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })

    for (let i of eventListReq["data"]["data"]) {
      // some "template" events should be ignored
      if (i["instance"]["definition"]["requirements"].length === 0) {
        continue
      }
      const startDate = new Date(i["instance"]["definition"]["requirements"][0]["dateFrom"])
      const endDate = new Date(i["instance"]["definition"]["requirements"][0]["dateTo"])
      const currentDate = new Date()

      if (currentDate < endDate && currentDate >= startDate && i["instance"]["definition"]["project"] === 'adcom') {
        // found an event in the active date bounds
        return i["instance"]["guid"]
      }
    }
    
    // no event found
    return null
  }

  let getPlayerEventInfo = async(eventId) => {
    try {
      const playerEventReq = await axios.get(`${hhcfg["fullBase"]}/leaderboards/${eventId}/players/${id}`, config={
        "headers": {
          "_token": hhcfg["token"],
          "User-agent": "Axios"
        }
      })
      
      return playerEventReq["data"]["data"]
    } catch (e) {
      if (e.response.status !== 404) {
        console.error(e.response.status)
      } else {
        console.log(`Player ${id} not found`)
      }

      return null
    }
  }

  let getPlayerLeaderboard = async(eventId) => {
    try {
      // todo: add ability to adjust adjacent players (offset) and top players (topCount)
      const playerLeaderboardReq = await axios.get(`${hhcfg["fullBase"]}/leaderboards/${eventId}/players/${id}/results?offset=25&resolvePlayers=true&topCount=25`, config={
        "headers": {
          "_token": hhcfg["token"],
          "User-agent": "Axios"
        }
      })
      
      return playerLeaderboardReq["data"]["resultMap"]
    } catch (e) {
      if (e.response.status !== 404) {
        console.error(e.response.status)
      } else {
        console.log(`Player ${id} not found`)
      }

      return null
    }
  }

  const currentEventId = await getCurrentEventId()
  const playerEventInfo = await getPlayerEventInfo(currentEventId)
  let returnStruct = {}

  if (playerEventInfo === null) {
    // don't even bother continuing if we know the ID has no record
    console.log(`Player ${id} not found`)
    res.sendStatus(404)
    return
  }

  const playerLeaderboard = await getPlayerLeaderboard(currentEventId)
  let proximalPlayerHashMap = {}
  for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
    // generate a list of players from the "resolvedPlayers" key, so we can obtain metadata such as ordinal ID (yields nickname) and custom name/icon (planned implementation in 2023)
    proximalPlayerHashMap[i["playerId"]] = i["sequence"]
  }

  // is there a more elegant way to approach this?
  returnStruct["player"] = {}
  returnStruct["player"]["leaderboardGuid"] = playerEventInfo["leaderboardGuid"]
  returnStruct["player"]["playerId"] = playerEventInfo["playerId"]
  returnStruct["player"]["playerOrdinal"] = proximalPlayerHashMap[playerEventInfo["playerId"]]
  returnStruct["player"]["divisionRoot"] = playerEventInfo["root"]
  returnStruct["player"]["divisionId"] = playerEventInfo["segmentId"]
  returnStruct["player"]["trophies"] = playerEventInfo["score"]
  returnStruct["player"]["dateJoined"] = playerEventInfo["created"]
  returnStruct["player"]["dateUpdated"] = playerEventInfo["updated"]

  returnStruct["global"] = {}
  returnStruct["global"]["count"] = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["position"]["count"]
  returnStruct["global"]["top"] = []
  returnStruct["global"]["adjacent"] = []
  // todo: add support for old leaderboards (rankedEntry -> archivedEntry)
  for (let i of playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"]) {
    returnStruct["global"]["top"].push({
      "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
  }

  for (let i of playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
    returnStruct["global"]["adjacent"].push({
      "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
    if (i["playerId"] === id) {
      returnStruct["player"]["globalPosition"] = i["position"]["position"]
    }
  }

  returnStruct["division"] = {}
  returnStruct["division"]["count"] = playerLeaderboard["results"]["segmentResults"]["topResults"]["rankedEntry"][0]["position"]["count"]
  returnStruct["division"]["top"] = []
  returnStruct["division"]["adjacent"] = []
  for (let i of playerLeaderboard["results"]["segmentResults"]["topResults"]["rankedEntry"]) {
    returnStruct["division"]["top"].push({
      "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
  }

  for (let i of playerLeaderboard["results"]["segmentResults"]["offsetResults"]["rankedEntry"]) {
    returnStruct["division"]["adjacent"].push({
      "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
  }

  res.json(returnStruct)
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})