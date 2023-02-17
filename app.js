const express = require('express')
const fs = require('fs')
const axios = require('axios')
const db = require('./db')
const balance = require('./balance')
const { cached } = require('sqlite3')
const parse = require('csv-parse')
const { send, json } = require('express/lib/response')
const { start } = require('repl')

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

// returns a list of every event since the inception of v3 leaderboard service up until either now or all scheduled
const getAllEvents = async (future=false) => {
  try {
    const eventListReq = await axios.get(`${hhcfg["fullBaseLeaderboard"]}/leaderboards`, config={
      "headers": {
        "_token": hhcfg["token"],
        "User-agent": "Axios"
      }
    })

    const eventList = parseAllEvents(eventListReq, future)
    return eventList
  } catch (e) {
    console.error(e)
    return Promise.reject(e)
  }
}

const parseAllEvents = async (eventListReq, future) => {
  const eventList = []

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
    const status = (i["instance"]["status"]["currentStatus"] === "Enabled") ? "active" : "archived"
    let playerCount = i["instance"]["statistics"]["rootCounts"]["global"] + i["instance"]["statistics"]["rootCounts"]["sandbox"]
    const currentDate = new Date()

    if (!isNaN(i["instance"]["statistics"]["rootCounts"]["archive"])) {
      playerCount += i["instance"]["statistics"]["rootCounts"]["archive"]
    }
    
    if (i["instance"]["definition"]["project"] === 'adcom' && !(startDate < currentDate && playerCount === 0) && !(!future && startDate > currentDate)) {
      // found a valid event
      const eventStruct = {
        "eventId": eventId,
        "eventName": eventName,
        "eventStatus": status,
        "startDate": startDate,
        "endDate": endDate,
        "players": playerCount
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
  try {
    const cachedPlayerState = await dbHandler.getPlayer(id)

    if (cachedPlayerState) {
      // check cache first
      return true
    }

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
    if (e.response && e.reponse.status === 404) {
      return false
    } else {
      console.error(e)
      return Promise.reject(e)
    }
  } finally {
    // close db connection
    dbHandler.close()
  }
}

// returns a bool indicating if the PlayFab ID participated in the event
const getPlayerEventState = async(id, eventId, isCurrent) => {
  const dbHandler = new db()
  try {
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

      return true
    } else {
      // player has NOT participated in event

      if (!isCurrent) {
        // they could join later if it's the current event, so only flag if it's passed
        dbHandler.addPlayerEvent(id, eventId, false)
      }

      return false
    }
  } catch (e) {
    if (e.response && e.reponse.status === 404) {
      return false
    } else {
      console.error(e)
      return Promise.reject(e)
    }
  } finally {
    // close db connection
    dbHandler.close()
  }
}

// returns a fully updated synopsis of player participation
const getKnownPlayerEvents = async(id) => {
  const dbHandler = new db()

  try {
    const allEvents = await getAllEvents()
    const currentKnownEvents = await dbHandler.getPlayerEvents(id)

    const newKnownEvents = parseKnownPlayerEvents(id, allEvents, currentKnownEvents)
    return newKnownEvents
  } catch (e) {
    console.error(e)
    return Promise.reject(e)
  }
}

const parseKnownPlayerEvents = async(id, allEvents, currentKnownEvents) => {
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
      "eventStatus": i["eventStatus"],
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
    console.error(e)
    return Promise.reject(e)
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
    console.error(e)
    return Promise.reject(e)
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
    console.error(`Note: this may simply be an archived event\n${e}`)
    return Promise.reject(e)
  }
}

// returns the brackets for a leaderboard
const getBrackets = async(id, eventId, brackets, totalPlayers) => {
  try {
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
  } catch (e) {
    console.error(e)
    return
  }
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
  returnStruct["event"]["startDate"] = currentEventData["startDate"]
  returnStruct["event"]["endDate"] = currentEventData["endDate"]

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
  returnStruct["event"]["startDate"] = currentEventData["startDate"]
  returnStruct["event"]["endDate"] = currentEventData["endDate"]

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
  try {
    const allEvents = await getAllEvents()
    res.send(allEvents)
  } catch (e) {
    res.sendStatus(502)
  }
})

// get event list including future events
app.get('/api/list/all', async (req, res) => {
  try {
    const allEvents = await getAllEvents(true)
    res.send(allEvents)
  } catch (e) {
    res.sendStatus(502)
  }
})

// query all players who are participants in the Discord leaderboard
app.get('/api/discord/:event', async(req, res) => {
  try {
    const eventId = req.params.event

    const allEventData = await getAllEvents()
    let currentEventData

    for (let i of allEventData) {
      if (i["eventId"] == eventId) {
        currentEventData = i
        break
      }
    }

    if (!currentEventData) {
      res.sendStatus(404)
      return
    }

    let playerRecords = []
    let playerEventRecords = []

    // get player records in a list format
    fs.createReadStream('discord.csv')
      .pipe(parse.parse({delimiter: ','}))
      .on('data', (row) => {
        let jsonRow = {
          "discordId": null,
          "nameDiscord": null,
          "nameWebsite": null,
          "playFabId": null
        }

        jsonRow["discordId"] = row[0]
        jsonRow["nameDiscord"] = row[1]
        jsonRow["nameWebsite"] = row[2]
        jsonRow["playFabId"] = row[3]
        playerRecords.push(jsonRow)
      })
      .on('end', async () => {
        console.log("Successfully parsed discord.csv")
        // get results for each player
        for (let i in playerRecords) {
          const id = playerRecords[i]["playFabId"]
          console.log(`Querying player ${id} for event ${eventId} (Discord leaderboard)`)

          const playerEventInfo = await getPlayerEventInfo(id, eventId)
          if (!playerEventInfo) {
            // don't even bother continuing if we know the ID has no record
            console.log(`Player ${id} not found (Discord leaderboard)`)
            continue
          }

          const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
          if (!playerLeaderboard) {
            // don't even bother continuing if we know the ID has no record
            console.log(`Player ${id} not registered with ${eventId} (Discord ledaerboard)`)
            continue
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
          
          playerEventRecords.push(returnStruct)
        }
        
        playerEventRecords.sort((a, b) => a["player"]["globalPosition"] - b["player"]["globalPosition"])
        
        let playerFinalRecords = []

        // transform data to correct format
        // a non-efficient O(n^2) loop, but there are few records so performance implications are negligible
        for (let j of playerEventRecords) {
          for (let k of playerRecords) {
            if (j["player"]["playerId"] === k["playFabId"]) {
              let individualPlayerFinalRecord = {
                "name": k["nameWebsite"],
                "discordId": k["discordId"],
                "discordName": k["nameDiscord"],
                "primaryKeySeq": j["player"]["playerOrdinal"],
                "position": j["player"]["globalPosition"] + 1,
                "positionOf": playerEventRecords[playerEventRecords.length-1]["global"]["count"],
                "trophies": j["player"]["trophies"],
                "divisionId": j["player"]["divisionId"],
                "isMainBoard": j["player"]["divisionRoot"] === 'global' ? true : false,
                "lastUpdated": j["player"]["dateUpdated"]
              }

              playerFinalRecords.push(individualPlayerFinalRecord)
            }
          }
        }

        res.status(200).send(playerFinalRecords)
      })
      .on('error', async(err) => {
        // fs emitted error
        res.sendStatus(502)
      })
  } catch (e) {
    res.sendStatus(502)
  }
})

// check if player exists
app.get('/api/player/:id', async (req, res) => {
  try {
    const id = req.params.id
    console.log(`Testing player ${id}`)

    const playerState = await getPlayerState(id)
    if (playerState) {
      res.status(200).end()
    } else {
      res.status(404).end()
    }
  } catch (e) {
    res.sendStatus(502)
  }
})

// get list of all registered events for a player
app.get('/api/list/:id', async (req, res) => {
  try {
    const id = req.params.id
    console.log(`Checking all events for ${id}`)

    const allKnownPlayerEvents = await getKnownPlayerEvents(id)
    if (allKnownPlayerEvents) {
      res.status(200).json(allKnownPlayerEvents)
    } else {
      res.status(404).end()
    }
  } catch (e) {
    res.sendStatus(502)
  }
})

// master player API
app.get('/api/event/:event/:id', async (req, res) => {
  try {
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
  } catch (e) {
    res.sendStatus(502)
  }
})

// individual position for a player
app.get('/api/event/:event/:id/position', async (req, res) => {
  try {
    const id = req.params.id
    const eventId = req.params.event
    console.log(`Querying player ${id} for event ${eventId} (position)`)

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
    if (!playerLeaderboard) {
      // don't even bother continuing if we know the ID has no record
      console.log(`Player ${id} not found`)
      res.status(404).end()
      return
    }

    if (playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
      for (let i of playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
        if (i["playerId"] === id) {
          res.status(200).send(i["position"]["position"].toString())
          return
        }
      }
    } else {
      res.status(200).send(playerLeaderboard["results"]["rootResults"]["offsetResults"]["archivedEntry"]["rootPosition"]["position"].toString())
    }
  } catch (e) {
    res.sendStatus(502)
  }
})

// brackets for a leaderboard (requires PlayFab)
app.get('/api/event/:event/:id/brackets', async (req, res) => {
  try {
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
      res.sendStatus(404) // can't currently retrieve brackets from archived leaderboards
      return
      totalPlayers = playerLeaderboard["results"]["rootResults"]["offsetResults"]["archivedEntry"]["rootPosition"]["count"]
    }

    const bracketData = await getBrackets(id, eventId, brackets, totalPlayers)

    const returnStruct = {
      "totalPlayers": totalPlayers,
      "brackets": bracketData
    }

    res.status(200).json(returnStruct)
  } catch (e) {
    res.sendStatus(502)
  }
})

// top players for a leaderboard (requires PlayFab)
app.get('/api/event/:event/:id/top/:count', async (req, res) => {
  try {
    const id = req.params.id
    const eventId = req.params.event
    const topPlayers = parseInt(req.params.count)
    console.log(`Querying player ${id} for event ${eventId} (top ${topPlayers})`)

    if (isNaN(topPlayers)) {
      console.error('Must be an int')
      res.status(400).end()
      return
    } else if (topPlayers < 1 || topPlayers > 1000) {
      console.error('Out of bounds')
      res.status(403).end()
      return
    }

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 1, topPlayers)
    if (!playerLeaderboard["results"]["rootResults"]["topResults"]) {
      // don't even bother continuing if we know the ID has no record
      console.log(`Player ${id} not registered with ${eventId}`)
      res.status(404).end()
      return
    }

    let proximalPlayerHashMap = {}
    for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
      // generate a list of players from the "resolvedPlayers" key, so we can obtain metadata such as ordinal ID (yields nickname) and custom name/icon (planned implementation in 2023)
      proximalPlayerHashMap[i["playerId"]] = i["sequence"]
    }

    const returnStruct = {}
    returnStruct["count"] = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["position"]["count"]

    returnStruct["top"] = {}
    returnStruct["top"]["count"] = topPlayers
    returnStruct["top"]["list"] = []
    for (let i of playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"]) {
      returnStruct["top"]["list"].push({
        "playerId": i["playerId"],
        "ordinal": proximalPlayerHashMap[i["playerId"]],
        "position": i["position"]["position"],
        "trophies": i["score"],
      })
    }

    res.status(200).json(returnStruct)
  } catch (e) {
    res.sendStatus(502)
  }
})

// how many players have finished the event? (estimate)
app.get('/api/event/:event/:id/finished', async(req, res) => {
  try {
    // todo add back Try/catch
    const id = req.params.id
    const eventId = req.params.event

    const stepCount = 100
    let lastPlayerId = undefined
    let currentPlayerId = `${id}`

    console.log(`Querying player ${id} for event ${eventId} (number of event finishers)`)

    const allEventData = await getAllEvents()
    let eventName
    let startTime
    let endTime

    for (let i of allEventData) {
      if (i["eventId"] == eventId) {
        eventName = i["eventName"]
        startTime = new Date(i["startDate"])
        endTime = new Date(i["endDate"])
        break
      }
    }

    let playerLeaderboard = await getPlayerLeaderboard(id, eventId, 1, 1)
    if (!playerLeaderboard["results"]["rootResults"]["topResults"]) {
      // don't even bother continuing if we know the ID has no record
      console.log(`Player ${id} not registered with ${eventId}`)
      res.status(404).end()
      return
    }

    const balanceHandler = new balance(eventName, startTime, endTime)
    await balanceHandler.loadBalanceData()
    
    const requiredTrophies = await balanceHandler.getThreshold()
    let finalPlayersFinished = -1

    currentPlayerId = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["playerId"]
    if (playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["score"] < requiredTrophies) {
      finalPlayersFinished = 0
    }

    while (finalPlayersFinished === -1) {
      playerLeaderboard = await getPlayerLeaderboard(currentPlayerId, eventId, stepCount, 1)
      
      for (let i of playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
        lastPlayerId = `${currentPlayerId}`
        currentPlayerId = i["playerId"]
        if (i["score"] < requiredTrophies) {
          finalPlayersFinished = i["position"]["position"]
          break
        }
      }

      if (lastPlayerId === currentPlayerId) {
        break
      }
    }
    
    if (finalPlayersFinished === -1) {
      res.status(500)
      return
    } else {
      const struct = {
        "finishers": finalPlayersFinished,
        "spendingCurve": await balanceHandler.getBalanceSpendingCurve(),
        "chrono": await balanceHandler.getChrono()
      }
      res.status(200).json(struct)
      return
    }

  } catch(e) {
    console.log(e)
    res.sendStatus(502)
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})