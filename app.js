const express = require('express')
const fs = require('fs')
const axios = require('axios')
const db = require('./db')
const { cached } = require('sqlite3')

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
    hhcfg["fullBaseLeaderboard"] = hhcfg["baseLeaderboard"] + '/project/' + hhcfg["application"]
    hhcfg["fullBasePlayerMeta"] = hhcfg["basePlayerMeta"] + '/project/' + hhcfg["application"]
  }
})

// load static content
app.use(express.static('public'))
app.use(express.static(__dirname + '/node_modules/bootstrap/dist/'))

// returns a list of every event since the inception of v3 leaderboard service up until now
const getAllEvents = async () => {
  const eventList = []
  const eventListReq = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards`, config={
    "headers": {
      "_token": hhcfg["token"],
      "User-agent": "Axios"
    }
  })

  // iterate through all leaderboards exposed by the API
  for (let i of eventListReq["data"]["data"]) {
    // some "template" events should be ignored
    if (i["instance"]["definition"]["requirements"].length === 0) {
      continue
    }

    const eventId = i["instance"]["guid"]
    const eventName = i["instance"]["definition"]["name"]
    const startDate = new Date(i["instance"]["definition"]["requirements"][0]["dateFrom"])
    const endDate = new Date(i["instance"]["definition"]["requirements"][0]["dateTo"])
    const currentDate = new Date()

    if (i["instance"]["definition"]["project"] === 'adcom' && (endDate < currentDate || (endDate > currentDate && startDate < currentDate))) {
      // found a valid event
      const eventStruct = {
        "eventId": eventId,
        "eventName": eventName,
        "startDate": startDate,
        "endDate": endDate
      }
      eventList.push(eventStruct)
    }
  }

  // sort by date bounds
  eventList.sort((a, b) => b["startDate"] - a["startDate"])
  return eventList
}

// returns a bool indicating if the PlayFab ID exists
const getPlayerState = async(id) => {
  const dbHandler = new db()
  const cachedPlayerState = await dbHandler.getPlayer(id)

  if (cachedPlayerState) {
    // check cache first
    return true
  }

  try {
    await axios.get(`${hhcfg["fullBasePlayerMeta"]}/players/${id}`, config={
      "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })

    // add player to cache
    dbHandler.addPlayer(id)
    return true
  } catch (e) {
    return false
  } finally {
    // close db connection
    dbHandler.close()
  }
}

// returns a bool indicating if the PlayFab ID participated in the event
const getPlayerEventState = async(id, eventId, isCurrent) => {
  const dbHandler = new db()
  const cachedPlayerEventState = await dbHandler.getPlayerEvents(id)

  // check cache first
  for (let i of cachedPlayerEventState) {
    if (i["eventId"] == eventId) {
      return Boolean(i["exists"])
    }
  }

  const playerEventRecord = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards/${eventId}/players/${id}`, config={
    "headers": {
      "_token": hhcfg["token"],
      "User-agent": "Axios"
    }
  })

  if (playerEventRecord["data"]["data"]) {
    // player has participated in event

    dbHandler.addPlayerEvent(id, eventId, true)
    dbHandler.close()

    return true
  } else {
    // player has NOT participated in event

    if (!isCurrent) {
      // they could join later if it's the current event, so only flag if it's passed
      dbHandler.addPlayerEvent(id, eventId, false)
      dbHandler.close()
    }

    return false
  }
}

// returns a fully updated synopsis of player participation
const getKnownPlayerEvents = async(id) => {
  const dbHandler = new db()
  const allEvents = await getAllEvents()
  const currentKnownEvents = await dbHandler.getPlayerEvents(id)
  const newKnownEvents = []

  // inefficient O(mn) loop but luckily this isn't a lot of data
  for (let i of allEvents) {
    let foundIt = false
    for (let j of currentKnownEvents) {
      if (i["eventId"] === j["eventId"]) {
        // found a candidate match, so we know it's included
        foundIt = true
      }
    }
    
    const isCurrent = Boolean(i["eventId"] == allEvents[0]["eventId"])
    const status = await getPlayerEventState(id, i["eventId"], isCurrent)
    const eventStruct = {
      "eventId": i["eventId"],
      "eventName": i["eventName"],
      "startDate": i["startDate"],
      "endDate": i["endDate"],
      "status": status
    }

    newKnownEvents.push(eventStruct)
  }

  newKnownEvents.sort((a, b) => b["startDate"] - a["startDate"])
  return newKnownEvents
}

// return information about individual player event registration
const getPlayerEventInfo = async(id, eventId) => {
  try {
    const playerEventReq = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards/${eventId}/players/${id}`, config={
      "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })
    
    return playerEventReq["data"]["data"]
  } catch (e) {
    console.error(e.response.status)
    return
  }
}

// return the player's division leaderboard and global leaderboard
const getPlayerLeaderboard = async(id, eventId, adjacentCount, topCount) => {
  try {
    // todo: add ability to adjust adjacent players (offset) and top players (topCount)
    const playerLeaderboardReq = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards/${eventId}/players/${id}/results?offset=${adjacentCount}&resolvePlayers=true&topCount=${topCount}`, config={
      "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })
    
    return playerLeaderboardReq["data"]["resultMap"]
  } catch (e) {
    console.error(e.response.status)
    return
  }
}

// returns the trophies at an exact position
const getPosition = async(id, eventId, n) => {
  try {
    const positionReq = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards/${eventId}/players/${id}/score/position?position=${n}`, config={
      "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })

    return positionReq["data"]["resultMap"]["rootResult"]["score"]
  } catch (e) {
    console.error(e.response.status)
    return
  }
}

// returns the brackets for a leaderboard
const getBrackets = async(id, eventId, brackets, totalPlayers) => {
  const trophies = {}

  for (let i of brackets) {
    let n = i - 1
    if (i < 1) {
      n = Math.floor(totalPlayers * i) - 1
    }
    const position = await getPosition(id, eventId, n)

    trophies[i.toString()] = Math.floor(position)
  }

  return trophies
}

// returns the data for an active event
const rankedEntryData = async(currentEventData, playerEventInfo, playerLeaderboard, id) => {
  let proximalPlayerHashMap = {}
  for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
    // generate a list of players from the "resolvedPlayers" key, so we can obtain metadata such as ordinal ID (yields nickname) and custom name/icon (planned implementation in 2023)
    proximalPlayerHashMap[i["playerId"]] = i["sequence"]
  }

  let returnStruct = {}

  returnStruct["status"] = "active"

  returnStruct["event"] = {}
  returnStruct["event"]["eventGuid"] = currentEventData["eventId"]
  returnStruct["event"]["eventName"] = currentEventData["eventName"]
  returnStruct["event"]["dateCommence"] = currentEventData["startDate"]
  returnStruct["event"]["dateConclude"] = currentEventData["endDate"]

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

  return returnStruct
}

// returns the data for an archived event (which is way less unfortunately)
const archivedEntryData = async(currentEventData, playerEventInfo, playerLeaderboardInfo) => {
  let returnStruct = {}

  returnStruct["status"] = "archived"

  returnStruct["event"] = {}
  returnStruct["event"]["eventGuid"] = currentEventData["eventId"]
  returnStruct["event"]["eventName"] = currentEventData["eventName"]
  returnStruct["event"]["dateCommence"] = currentEventData["startDate"]
  returnStruct["event"]["dateConclude"] = currentEventData["endDate"]

  returnStruct["player"] = {}
  returnStruct["player"]["leaderboardGuid"] = playerEventInfo["leaderboardGuid"]
  returnStruct["player"]["playerId"] = playerEventInfo["playerId"]
  returnStruct["player"]["playerOrdinal"] = -1
  returnStruct["player"]["divisionRoot"] = playerEventInfo["root"]
  returnStruct["player"]["divisionId"] = playerEventInfo["segmentId"]
  returnStruct["player"]["trophies"] = playerEventInfo["score"]
  returnStruct["player"]["dateJoined"] = playerEventInfo["created"]
  returnStruct["player"]["dateUpdated"] = playerEventInfo["updated"]
  returnStruct["player"]["globalPosition"] = playerLeaderboardInfo["results"]["rootResults"]["offsetResults"]["archivedEntry"]["rootPosition"]["position"]
  
  returnStruct["global"] = {}
  returnStruct["global"]["count"] = playerLeaderboardInfo["results"]["rootResults"]["offsetResults"]["archivedEntry"]["rootPosition"]["count"]
  
  returnStruct["division"] = {}
  returnStruct["division"]["count"] = playerLeaderboardInfo["results"]["rootResults"]["offsetResults"]["archivedEntry"]["segmentPosition"]["count"]

  return returnStruct
}

// get event list
app.get('/api/list', async (req, res) => {
  const allEvents = await getAllEvents()
  res.send(allEvents)
})

// check if player exists
app.get('/api/player/:id', async (req, res) => {
  const id = req.params.id
  console.log(`Testing player ${id}`)

  const playerState = await getPlayerState(id)
  if (playerState) {
    res.status(200).end()
  } else {
    res.status(404).end()
  }
})

// get list of all registered events for a player
app.get('/api/list/:id', async (req, res) => {
  const id = req.params.id
  console.log(`Checking all events for ${id}`)

  const allKnownPlayerEvents = await getKnownPlayerEvents(id)
  if (allKnownPlayerEvents) {
    res.status(200).json(allKnownPlayerEvents)
  } else {
    res.status(404).end()
  }
})

// master player API
app.get('/api/event/:event/:id', async (req, res) => {
  const id = req.params.id
  const eventId = req.params.event
  console.log(`Querying player ${id} for event ${eventId}`)

  const allEventData = await getAllEvents()
  let currentEventData

  for (let i of allEventData) {
    if (i["eventId"] == eventId) {
      currentEventData = i
      break
    }
  }

  const playerEventInfo = await getPlayerEventInfo(id, eventId)
  if (!playerEventInfo) {
    // don't even bother continuing if we know the ID has no record
    console.log(`Player ${id} not found`)
    res.status(404).end()
    return
  }

  const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
  if (!playerLeaderboard) {
    // don't even bother continuing if we know the ID has no record
    console.log(`Player ${id} not registered with ${eventId}`)
    res.status(404).end()
    return
  }

  // differentiate between archived and active leaderboard
  let returnStruct
  if (playerLeaderboard["results"]["rootResults"]["topResults"]) {
    // active
    returnStruct = await rankedEntryData(currentEventData, playerEventInfo, playerLeaderboard, id)
  } else {
    // archive
    returnStruct = await archivedEntryData(currentEventData, playerEventInfo, playerLeaderboard)
  }
  
  res.status(200).json(returnStruct)
})

// brackets
app.get('/api/event/:event/:id/brackets', async (req, res) => {
  const id = req.params.id
  const eventId = req.params.event
  const brackets = [1, 5, 25, 100, 0.01, 0.05, 0.10, 0.25, 0.50, 0.75]
  console.log(`Querying player ${id} for event ${eventId} (lb brackets)`)

  const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
  if (!playerLeaderboard) {
    // don't even bother continuing if we know the ID has no record
    console.log(`Player ${id} not registered with ${eventId}`)
    res.status(404).end()
    return
  }

  // hacky way to determine number of players
  let totalPlayers
  if (playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
    totalPlayers = playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"][0]["position"]["count"]
  } else {
    totalPlayers = playerLeaderboard["results"]["rootResults"]["offsetResults"]["archivedEntry"]["rootPosition"]["count"]
  }

  const bracketData = await getBrackets(id, eventId, brackets, totalPlayers)
  const returnStruct = {
    "totalPlayers": totalPlayers,
    "brackets": bracketData
  }

  res.status(200).json(returnStruct)
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})