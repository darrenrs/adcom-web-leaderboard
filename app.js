const express = require('express')
const fs = require('fs')
const axios = require('axios')
const readline = require('readline')
require('dotenv').config()
const crypto = require('crypto')
const path = require('path')
const zlib = require('zlib')
const { promisify } = require('util')
const gunzip = promisify(zlib.gunzip)

const db = require('./db')
const balance = require('./balance')
const { url } = require('inspector')

const app = express({
  strict: true
})
const port = process.env.PORT
const fullBaseLeaderboard = `${process.env.API_URL_LEADERBOARD}/project/${process.env.API_APPLICATION_ID}`
const fullBasePlayerMeta = `${process.env.API_URL_PLAYERMETA}/project/${process.env.API_APPLICATION_ID}`

// load static content
app.use(express.json())
app.use(express.static('public', {extensions: ['html']}))
app.use(express.static(__dirname + '/node_modules/bootstrap/dist/'))
app.enable('trust proxy')

const log = async (message, remoteAddress, error=false) => {
  const currentTime = (new Date()).toISOString()
  const logMessage = `${currentTime} [${remoteAddress}] - ${message}`

  if (error) {
    console.error(logMessage)
  } else {
    console.log(logMessage)
  }
}

// returns a list of every event since the inception of v3 leaderboard service up until either now or all scheduled
const getAllEvents = async (future=false) => {
  try {
    const eventListReq = await axios.get(`${fullBaseLeaderboard}/leaderboards`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
        "User-agent": "Axios"
      }
    })

    const eventList = parseAllEvents(eventListReq, future)
    return eventList
  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

const parseAllEvents = async (eventListReq, future) => {
  const eventList = []

  // some events might have no way to tell that it's a test event, so we specify the IDs here to hide them
  const EVENT_OVERRIDE = ['3b788292-787f-4c60-9f8d-fee2f1216847']

  // iterate through all leaderboards exposed by the API
  for (let i of eventListReq["data"]["data"]) {
    // some "template" events should be ignored
    if (!i["instance"]["definition"]["requirements"] ||
        !i["instance"]["definition"]["segmentDefinition"] ||
        i["instance"]["definition"]["project"] !== process.env.API_APPLICATION_ID ||
        EVENT_OVERRIDE.includes(i["instance"]["guid"])) {
      continue
    }

    const eventId = i["instance"]["guid"]
    const eventName = i["instance"]["definition"]["name"]
    const startDate = new Date(i["instance"]["definition"]["requirements"][0]["dateFrom"])
    const endDate = new Date(i["instance"]["definition"]["requirements"][0]["dateTo"])
    const createdAt = new Date(i["instance"]["status"]["created"])
    const archivedAt = new Date(i["instance"]["status"]["archived"])
    const status = (i["instance"]["status"]["currentStatus"] === "Enabled") ? "active" : "archived"
    const currentDate = new Date()
    const divisionSize = parseInt(i["instance"]["definition"]["segmentDefinition"]["configuration"]["MAX_ENTRIES"])
    
    let playerCount = i["instance"]["statistics"]["rootCounts"]["global"] + i["instance"]["statistics"]["rootCounts"]["sandbox"]
    if (!isNaN(i["instance"]["statistics"]["rootCounts"]["archive"])) {
      playerCount += i["instance"]["statistics"]["rootCounts"]["archive"]
    }

    const isLteLive = Date.now() >= startDate && Date.now() < endDate
    
    if (!(startDate < currentDate && playerCount === 0) && !(!future && startDate > currentDate)) {
      // found a valid event
      const eventStruct = {
        "eventId": eventId,
        "eventName": eventName,
        "eventStatus": status,
        "startDate": startDate,
        "endDate": endDate,
        "createdAt": createdAt,
        "archivedAt": archivedAt,
        "players": playerCount,
        "divisionSize": divisionSize,
        "isLteLive": isLteLive
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
    dbHandler.updatePlayerDiscordTimestamp(id)

    if (cachedPlayerState) {
      // check cache first
      return true
    }

    await axios.get(`${fullBasePlayerMeta}/players/${id}`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
        "User-agent": "Axios"
      }
    })

    // add player to cache
    dbHandler.addPlayer(id)
    return true
  } catch (e) {
    if (e.response && e.response.status === 404) {
      return false
    } else {
      // console.error(e)
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

    const playerEventRecord = await axios.get(`${fullBaseLeaderboard}/leaderboards/${eventId}/players/${id}`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
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
    if (e.response && e.response.status === 404) {
      return false
    } else {
      // console.error(e)
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
    dbHandler.updatePlayerDiscordTimestamp(id)
    const allEvents = await getAllEvents()
    const newKnownEvents = await parseKnownPlayerEvents(id, allEvents)

    return newKnownEvents
  } catch (e) {
    console.error(e)
    return Promise.reject(e)
  }
}

const parseKnownPlayerEvents = async(id, allEvents) => {
  while (true) {
    try {
      const newKnownEventsPromises = allEvents.map(async (i) => {
        const isCurrent = Boolean(i["eventId"] == allEvents[0]["eventId"])
        const status = await getPlayerEventState(id, i["eventId"], isCurrent)
        const eventStruct = {
          "eventId": i["eventId"],
          "eventName": i["eventName"],
          "eventStatus": i["eventStatus"],
          "startDate": i["startDate"],
          "endDate": i["endDate"],
          "status": status,
          "isLteLive": i["isLteLive"]
        }

        return eventStruct
      })

      const newKnownEvents = await Promise.all(newKnownEventsPromises)

      newKnownEvents.sort((a, b) => b["startDate"] - a["startDate"])
      return newKnownEvents
    } catch(e) {
      // Ratelimited; try again
    }
  }
}

// return information about individual player event registration
const getPlayerEventInfo = async(id, eventId) => {
  try {
    const playerEventReq = await axios.get(`${fullBaseLeaderboard}/leaderboards/${eventId}/players/${id}`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
        "User-agent": "Axios"
      }
    })
    
    return playerEventReq["data"]["data"]
  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

// return the player's division leaderboard and global leaderboard
const getPlayerLeaderboard = async(id, eventId, adjacentCount, topCount, indirectRequest) => {
  const dbHandler = new db()
  try {
    if (!indirectRequest) {
      dbHandler.updatePlayerDiscordTimestamp(id)
    }

    const playerLeaderboardReq = await axios.get(`${fullBaseLeaderboard}/leaderboards/${eventId}/players/${id}/results?offset=${adjacentCount}&resolvePlayers=true&topCount=${topCount}`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
        "User-agent": "Axios"
      }
    })
    
    return playerLeaderboardReq["data"]["resultMap"]
  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

// returns the trophies at an exact position
const getPosition = async(id, eventId, n) => {
  try {
    const positionReq = await axios.get(`${fullBaseLeaderboard}/leaderboards/${eventId}/players/${id}/score/position?position=${n}`, config={
      "headers": {
        "_token": process.env.API_GCLOUD_TOKEN,
        "User-agent": "Axios"
      }
    })
    return positionReq["data"]["resultMap"]["rootResult"]["score"]
  } catch (e) {
    // console.error(`Note: this may simply be an archived event\n${e}`)
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

      // don't display bracket if it does not exist yet
      // (i.e., insufficient number of players or cheater leaderboard)
      if (n <= 99 && i < 1) {
        continue
      }

      const position = await getPosition(id, eventId, n)

      trophies[i.toString()] = Math.floor(position)
    }

    trophies["0.999999"] = 0  // hacky thing
    return trophies
  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

// returns the data for an active event
const rankedEntryData = async(currentEventData, playerEventInfo, playerLeaderboard, id, returnGlobalForDivision=false) => {
  let proximalPlayerHashMap = {}
  for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
    // generate a list of players from the "resolvedPlayers" key, so we can obtain metadata such as ordinal ID (yields nickname) and icon
    proximalPlayerHashMap[i["playerId"]] = {
      "sequence": i["sequence"],
      "avatarId": i["customData"] ? i["customData"]["avatarId"] : null,
      "lteRank": i["customData"] ? i["customData"]["lteRank"] : null
    }
  }

  let returnStruct = {}

  returnStruct["status"] = "active"

  returnStruct["event"] = {}
  returnStruct["event"]["eventGuid"] = currentEventData["eventId"]
  returnStruct["event"]["eventName"] = currentEventData["eventName"]
  returnStruct["event"]["startDate"] = currentEventData["startDate"]
  returnStruct["event"]["endDate"] = currentEventData["endDate"]
  returnStruct["event"]["isLteLive"] = currentEventData["isLteLive"]

  returnStruct["player"] = {}
  returnStruct["player"]["leaderboardGuid"] = playerEventInfo["leaderboardGuid"]
  returnStruct["player"]["playerId"] = playerEventInfo["playerId"]
  returnStruct["player"]["playerOrdinal"] = proximalPlayerHashMap[playerEventInfo["playerId"]]["sequence"]
  returnStruct["player"]["divisionRoot"] = playerEventInfo["root"]
  returnStruct["player"]["divisionId"] = playerEventInfo["segmentId"]
  returnStruct["player"]["trophies"] = playerEventInfo["score"]
  returnStruct["player"]["dateJoined"] = playerEventInfo["created"]
  returnStruct["player"]["dateUpdated"] = playerEventInfo["updated"]
  returnStruct["player"]["avatarId"] = proximalPlayerHashMap[playerEventInfo["playerId"]]["avatarId"]
  returnStruct["player"]["lteRank"] = proximalPlayerHashMap[playerEventInfo["playerId"]]["lteRank"]

  returnStruct["global"] = {}
  returnStruct["global"]["count"] = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["position"]["count"]
  returnStruct["global"]["top"] = []
  returnStruct["global"]["adjacent"] = []
  for (let i of playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"]) {
    returnStruct["global"]["top"].push({
      // "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]]["sequence"],
      "avatarId": proximalPlayerHashMap[i["playerId"]]["avatarId"],
      "lteRank": proximalPlayerHashMap[i["playerId"]]["lteRank"],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
  }

  for (let i of playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
    returnStruct["global"]["adjacent"].push({
      // "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]]["sequence"],
      "avatarId": proximalPlayerHashMap[i["playerId"]]["avatarId"],
      "lteRank": proximalPlayerHashMap[i["playerId"]]["lteRank"],
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
      "ordinal": proximalPlayerHashMap[i["playerId"]]["sequence"],
      "avatarId": proximalPlayerHashMap[i["playerId"]]["avatarId"],
      "lteRank": proximalPlayerHashMap[i["playerId"]]["lteRank"],
      "position": i["position"]["position"],
      "trophies": i["score"],
    })
  }

  for (let i of playerLeaderboard["results"]["segmentResults"]["offsetResults"]["rankedEntry"]) {
    returnStruct["division"]["adjacent"].push({
      "playerId": i["playerId"],
      "ordinal": proximalPlayerHashMap[i["playerId"]]["sequence"],
      "avatarId": proximalPlayerHashMap[i["playerId"]]["avatarId"],
      "lteRank": proximalPlayerHashMap[i["playerId"]]["lteRank"],
      "position": i["position"]["position"],
      "globalPosition": null,
      "trophies": i["score"],
    })
  }

  // get results for each division player
  if (returnGlobalForDivision) {
    const playerEventRecordsPromises = returnStruct["division"]["adjacent"].map(async (record) => {
      const id = record["playerId"]
      const eventId = returnStruct["event"]["eventGuid"]
      const rvalue = {
        "playFabId": id,
        "position": null,
        "dateJoined": null,
        "dateUpdated": null,
      }

      const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25, true)
      const playerEventInfo = await getPlayerEventInfo(id, eventId)

      rvalue["dateJoined"] = playerEventInfo["created"]
      rvalue["dateUpdated"] = playerEventInfo["updated"]

      if (!playerLeaderboard) {
        return rvalue
      }
      
      // differentiate between archived and active leaderboard
      if (playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
        for (let i of playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
          if (i["playerId"] === id) {
            rvalue["position"] = i["position"]["position"]
            return rvalue
          }
        }
      } else {
        return rvalue
      }
    })

    const playerEventRecords = (await Promise.allSettled(playerEventRecordsPromises)).filter(
      (result) => result.status === 'fulfilled' && result.value !== null
    ).map(result => result.value)

    for (let i of playerEventRecords) {
      for (let j of returnStruct["division"]["adjacent"]) {
        if (i["playFabId"] === j["playerId"]) {
          j["globalPosition"] = i["position"]
          j["dateJoined"] = i["dateJoined"]
          j["dateUpdated"] = i["dateUpdated"]
          j["playerId"] = null
        }
      }
      
      for (let k of returnStruct["division"]["top"]) {
        if (i["playFabId"] === k["playerId"]) {
          k["globalPosition"] = i["position"]
          k["dateJoined"] = i["dateJoined"]
          k["dateUpdated"] = i["dateUpdated"]
          k["playerId"] = null
        }
      }
    }
  }

  return returnStruct
}

// returns the data for an archived event (which is unfortunately limited)
const archivedEntryData = async(currentEventData, playerEventInfo, playerLeaderboardInfo) => {
  let returnStruct = {}

  returnStruct["status"] = "archived"

  returnStruct["event"] = {}
  returnStruct["event"]["eventGuid"] = currentEventData["eventId"]
  returnStruct["event"]["eventName"] = currentEventData["eventName"]
  returnStruct["event"]["startDate"] = currentEventData["startDate"]
  returnStruct["event"]["endDate"] = currentEventData["endDate"]
  returnStruct["event"]["isLteLive"] = currentEventData["isLteLive"]

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

const dbPlayerList = async() => {
  const dbHandler = new db()
  const data = await dbHandler.getAllPlayers()

  dbHandler.close()
  return data
}

const dbPlayerEventRecords = async() => {
  const dbHandler = new db()
  const data = await dbHandler.getAllPlayerEvents()

  dbHandler.close()
  return data
}

const dbPlayerDiscordRecords = async() => {
  const dbHandler = new db()
  const data = await dbHandler.getAllPlayerDiscordRecords()

  dbHandler.close()
  return data
}

const dbPlayerDiscordRecordsNoDateConstraint = async() => {
  const dbHandler = new db()
  const data = await dbHandler.getAllPlayerDiscordRecordsNoDateConstraint()

  dbHandler.close()
  return data
}

// must have an iOS device; not known how to acquire Android-equivalent token
const getPlayerAccountValueFromPlayFab = async(id) => {
  try {
    // login with hardcoded iOS device ID
    const sessionGenesisReq = await axios.post(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithIOSDeviceID`,
      data={
        "AuthenticationContext": null,
        "CreateAccount": false,
        "CustomTags": null,
        "DeviceId": process.env.GC_DEVICE_ID,
        "DeviceModel": null,
        "EncryptedRequest": null,
        "InfoRequestParameters": {
            "GetCharacterInventories": false,
            "GetCharacterList": false,
            "GetPlayerProfile": true,
            "GetPlayerStatistics": false,
            "GetTitleData": true,
            "GetUserAccountInfo": true,
            "GetUserData": true,
            "GetUserInventory": true,
            "GetUserReadOnlyData": true,
            "GetUserVirtualCurrency": true,
            "PlayerStatisticNames": null,
            "ProfileConstraints": {
                "ShowAvatarUrl": false,
                "ShowBannedUntil": false,
                "ShowCampaignAttributions": false,
                "ShowContactEmailAddresses": false,
                "ShowCreated": true,
                "ShowDisplayName": false,
                "ShowExperimentVariants": false,
                "ShowLastLogin": false,
                "ShowLinkedAccounts": false,
                "ShowLocations": true,
                "ShowMemberships": false,
                "ShowOrigination": false,
                "ShowPushNotificationRegistrations": false,
                "ShowStatistics": false,
                "ShowTags": false,
                "ShowTotalValueToDateInUsd": true,
                "ShowValuesToDate": false
            },
            "TitleDataKeys": [
                "HardCurrencyCap",
                "SoftCurrencyCap",
                "TrophyCurrencyCap",
                "EnableSzTransitionSdk",
                "EnableIDFA",
                "YoutubeUrl",
                "WappierIosEnable",
                "CrashlyticsUserIdCollected",
                "FeatureFlags",
                "ForceDataVersion"
            ],
            "UserDataKeys": null,
            "UserReadOnlyDataKeys": null
        },
        "OS": null,
        "PlayerSecret": null,
        "TitleId": process.env.PLAYFAB_TITLE_ID
      }
    )
    
    const sessionToken = sessionGenesisReq["data"]["data"]["SessionTicket"]

    const playerAccountValueReq = await axios.post(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetPlayerProfile`,
      data={
        "AuthenticationContext": null,
        "CustomTags": null,
        "PlayFabId": id,
        "ProfileConstraints": {
            "ShowCreated": true,
            "ShowDisplayName": true,
            "ShowLastLogin": true,
            "ShowLocations": true,
            "ShowTotalValueToDateInUsd": true
        }
      },
      {
        headers: {
          'X-Authorization': sessionToken
        }
      }
    )

    const accountValueUSD = playerAccountValueReq["data"]["data"]["PlayerProfile"]["TotalValueToDateInUSD"] / 100 || 0
    const dateAccountGenesis = playerAccountValueReq["data"]["data"]["PlayerProfile"]["Created"]
    const dateAccountLastLogin = playerAccountValueReq["data"]["data"]["PlayerProfile"]["LastLogin"]

    return {
      "accountValueUSD": accountValueUSD,
      "dateAccountGenesis": dateAccountGenesis,
      "dateAccountLastLogin": dateAccountLastLogin
    }

  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

// must have an iOS device; not known how to acquire Android-equivalent token
const getDataFilesForTitleVersion = async(version) => {
  try {
    // login with hardcoded iOS device ID
    const sessionGenesisReq = await axios.post(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithIOSDeviceID`,
      data={
        "AuthenticationContext": null,
        "CreateAccount": false,
        "CustomTags": null,
        "DeviceId": process.env.GC_DEVICE_ID,
        "DeviceModel": null,
        "EncryptedRequest": null,
        "InfoRequestParameters": {
            "GetCharacterInventories": false,
            "GetCharacterList": false,
            "GetPlayerProfile": true,
            "GetPlayerStatistics": false,
            "GetTitleData": true,
            "GetUserAccountInfo": true,
            "GetUserData": true,
            "GetUserInventory": true,
            "GetUserReadOnlyData": true,
            "GetUserVirtualCurrency": true,
            "PlayerStatisticNames": null,
            "ProfileConstraints": {
                "ShowAvatarUrl": false,
                "ShowBannedUntil": false,
                "ShowCampaignAttributions": false,
                "ShowContactEmailAddresses": false,
                "ShowCreated": true,
                "ShowDisplayName": false,
                "ShowExperimentVariants": false,
                "ShowLastLogin": false,
                "ShowLinkedAccounts": false,
                "ShowLocations": true,
                "ShowMemberships": false,
                "ShowOrigination": false,
                "ShowPushNotificationRegistrations": false,
                "ShowStatistics": false,
                "ShowTags": false,
                "ShowTotalValueToDateInUsd": true,
                "ShowValuesToDate": false
            },
            "TitleDataKeys": [
                "HardCurrencyCap",
                "SoftCurrencyCap",
                "TrophyCurrencyCap",
                "EnableSzTransitionSdk",
                "EnableIDFA",
                "YoutubeUrl",
                "WappierIosEnable",
                "CrashlyticsUserIdCollected",
                "FeatureFlags",
                "ForceDataVersion"
            ],
            "UserDataKeys": null,
            "UserReadOnlyDataKeys": null
        },
        "OS": null,
        "PlayerSecret": null,
        "TitleId": process.env.PLAYFAB_TITLE_ID
      }
    )
    
    const sessionToken = sessionGenesisReq["data"]["data"]["SessionTicket"]

    const dataFileManifestReq = await axios.post(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/ExecuteCloudScript`,
      data={
        "FunctionName": "DataConfig",
        "FunctionParameter": {
          "DataVersion": version
        },
        "GeneratePlayStreamEvent": true,
        "RevisionSelection": "Live",
        "SpecificRevision": null,
        "AuthenticationContext": null
      },
      {
        headers: {
          'X-Authorization': sessionToken
        }
      }
    )
    
    return JSON.parse(dataFileManifestReq["data"]["data"]["FunctionResult"])
  } catch (e) {
    // console.error(e)
    return Promise.reject(e)
  }
}

const downloadToBalance = async(urls) => {
  const dir = path.join(__dirname, 'balance');

  await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
      }

      const gzBuffer = Buffer.from(await res.arrayBuffer());
      const data = await gunzip(gzBuffer); // decompressed content

      let filename = url.split('/').pop().split('?')[0];
      if (filename.endsWith('.gz')) {
        filename = filename.slice(0, -3); // remove ".gz"
      }

      const filePath = path.join(dir, filename);
      await fs.promises.writeFile(filePath, data);
    })
  );
}

// get event list
app.get('/api/list', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)
    
    const allEvents = await getAllEvents()

    res.send(allEvents)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// get event list including future events
app.get('/api/list/all', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const allEvents = await getAllEvents(true)

    res.send(allEvents)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// check if exists in discord lb
app.post('/api/discord/account', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    if (!req.body || !req.body["playFabId"]) {
      res.sendStatus(400)
      return
    }

    let id = req.body["playFabId"]
    id = id.toString().trim()

    if (id.length > 16) {
      res.sendStatus(400)
      return
    }

    const dbHandler = new db()
    const playerRecord = await dbHandler.checkPlayerDiscord(id)
    await dbHandler.updatePlayerDiscordTimestamp(id)
    
    if (playerRecord) {
      res.send(playerRecord)
    } else {
      res.sendStatus(404)
    }

    dbHandler.close()
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(500)
    
    return
  }
})

// add record to discord lb
app.put('/api/discord/account', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    if (!req.body) {
      res.sendStatus(400)
      return
    }
    
    let id = req.body.playFabId
    let discordId = req.body.discordId
    let displayName = req.body.displayName
    let username = req.body.username
    let iconDesc = req.body.iconQualitativeDesc  // deprecated as of 2024-01-01
    let discordPfpId = req.body.discordProfilePictureId

    if (!id || !displayName || !username) {
      res.sendStatus(400)
      return
    }
    
    // input validation
    id = id.toString().trim()
    discordId = discordId.toString().trim()
    displayName = displayName.toString().trim()
    username = username.toString().trim()
    iconDesc = iconDesc.toString().trim()
    discordPfpId = discordPfpId.toString().trim()

    // 1 in 4 billion chance of ID length being less than 8; almost certainly user input error
    if (id.length > 16 || id.length < 8) {
      res.sendStatus(400)
      return
    }
    
    if (discordId && (discordId.length < 17 || discordId.length > 19 || !(/^\d+$/.test(discordId)))) {
      res.sendStatus(400)
      return
    }

    if (displayName.length > 32) {
      res.sendStatus(400)
      return
    }

    // if (discordPfpId.length !== 32) {
    //   res.sendStatus(400)
    //   return
    // }

    if (iconDesc.length > 1024) {
      res.sendStatus(400)
      return
    }

    const dbHandler = new db()
    await dbHandler.addPlayerDiscord(id, discordId, displayName, username, iconDesc, discordPfpId)

    res.sendStatus(201)

    dbHandler.close()
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    if (e.includes("UNIQUE constraint failed")) {
      res.sendStatus(409)
    } else {
      res.sendStatus(500)
    }
    
    return
  }
})

// update discord lb record
app.patch('/api/discord/account', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    if (!req.body) {
      res.sendStatus(400)
      return
    }
    
    let id = req.body.playFabId
    let discordId = req.body.discordId
    let displayName = req.body.displayName
    let username = req.body.username
    let iconDesc = req.body.iconQualitativeDesc  // deprecated as of 2024-01-01
    let discordPfpId = req.body.discordProfilePictureId

    if (!id || !displayName || !username) {
      res.sendStatus(400)
      return
    }
    
    // input validation
    id = id.toString().trim()
    discordId = discordId.toString().trim()
    displayName = displayName.toString().trim()
    username = username.toString().trim()
    iconDesc = iconDesc.toString().trim()
    discordPfpId = discordPfpId.toString().trim()
    
    // 1 in 4 billion chance of ID length being less than 8; almost certainly user input error
    if (id.length > 16 || id.length < 8) {
      res.sendStatus(400)
      return
    }
    
    if (discordId && (discordId.length < 17 || discordId.length > 19 || !(/^\d+$/.test(discordId)))) {
      res.sendStatus(400)
      return
    }

    if (displayName.length > 32) {
      res.sendStatus(400)
      return
    }

    // if (discordPfpId.length !== 32) {
    //   res.sendStatus(400)
    //   return
    // }

    if (iconDesc.length > 1024) {
      res.sendStatus(400)
      return
    }

    const dbHandler = new db()
    await dbHandler.updatePlayerDiscord(id, discordId, displayName, username, iconDesc, discordPfpId)

    res.sendStatus(204)

    dbHandler.close()
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    if (e.includes("no records found")) {
      res.sendStatus(404)
    } else {
      res.sendStatus(500)
    }
    
    return
  }
})

// delete record from discord lb
app.delete('/api/discord/account', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    if (!req.body) {
      res.sendStatus(400)
      return
    }
    
    let id = req.body.playFabId

    if (!id) {
      res.sendStatus(400)
      return
    }
    
    // input validation
    id = id.toString().trim()

    if (id.length > 16) {
      res.sendStatus(400)
      return
    }

    const dbHandler = new db()
    await dbHandler.removePlayerDiscord(id)
    
    res.sendStatus(200)

    dbHandler.close()
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    if (e.includes("no records found")) {
      res.sendStatus(404)
    } else {
      res.sendStatus(500)
    }

    return
  }
})

// discord OAuth2 callback
app.get('/api/discord/oauth', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const origin = `${req.protocol}://${req.headers.host}`
  const basePath = req.headers['x-original-base-path'] || '' // Apache custom configuration

  let HTML_RESPONSE_SUCCESS = `<!DOCTYPE html>
<head>
  <title>Discord API Callback</title>
</head>
<body style="font-family: sans-serif;">
  <p>The operation completed successfully. Please close this window.</p>
  <script>
  const userData = {
      discordId: "$DISCORD_ID",
      username: "$DISCORD_USERNAME",
      profilePictureId: $DISCORD_AVATAR_ID
  }
  
  window.opener.postMessage(userData, '${origin}')
  window.close()
  </script>
</body>
  `

  let HTML_RESPONSE_ERROR = `<!DOCTYPE html>
<head>
  <title>Discord API Callback</title>
</head>
<body style="font-family: sans-serif;">
  <p>There was a problem authenticating with Discord. Please close this window and try again.</p>
  <script>
  const userData = null

  window.opener.postMessage(userData, '${origin}')
  window.close()
  </script>
</body>
  `
  const code = req.query.code

  if (code) {
    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${origin}${basePath}/api/discord/oauth`,
          scope: 'identify',
        }).toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            "Accept-Encoding": '*'
          }
        })

      const userResult = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          authorization: `${tokenResponse.data.token_type} ${tokenResponse.data.access_token}`,
        },
      })

      let username
      
      if (userResult.data.discriminator !== '0') {
        username = `${userResult.data.username}#${userResult.data.discriminator}`
      } else {
        username = userResult.data.username
      }
      
      HTML_RESPONSE_SUCCESS = HTML_RESPONSE_SUCCESS.replace('$DISCORD_ID', userResult.data.id)
      HTML_RESPONSE_SUCCESS = HTML_RESPONSE_SUCCESS.replace('$DISCORD_USERNAME', username)

      if (userResult.data.avatar) {
        HTML_RESPONSE_SUCCESS = HTML_RESPONSE_SUCCESS.replace('$DISCORD_AVATAR_ID', `"${(userResult.data.avatar).replace('a_', '')}"`)
      } else {
        HTML_RESPONSE_SUCCESS = HTML_RESPONSE_SUCCESS.replace('$DISCORD_AVATAR_ID', 'null')
      }

      res.send(HTML_RESPONSE_SUCCESS)
      return
    } catch (e) {
      log(`OAuth error ${e}`, remoteAddress, true)
      res.status(500).send(HTML_RESPONSE_ERROR)
      return
    }
  } else {
    res.status(400).send(HTML_RESPONSE_ERROR)
    return
  }
})

// query all players who are participants in the Discord leaderboard
app.get('/api/discord/:event', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

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
    
    let playerRecords = await dbPlayerDiscordRecords()
    let currentKnownMaxPlayers = 0
    
    // get results for each player
    const playerEventRecordsPromises = playerRecords.map(async (record) => {
      const id = record["id"]

      const playerEventInfoPromise = getPlayerEventInfo(id, eventId)
      const playerLeaderboardPromise = getPlayerLeaderboard(id, eventId, 25, 25, true)

      const results = await Promise.allSettled([
        playerEventInfoPromise,
        playerLeaderboardPromise,
      ])
      
      const [playerEventInfo, playerLeaderboard] = results.map((result) => result.value)

      if (!playerEventInfo || !playerLeaderboard) {
        return null
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

      if (returnStruct["global"]["count"] > currentKnownMaxPlayers) {
        currentKnownMaxPlayers = returnStruct["global"]["count"]
      }

      let divisionPosition = null

      if (returnStruct["division"]["top"]) {
        for (let j in returnStruct["division"]["top"]) {
          if (returnStruct["division"]["top"][j]["playerId"] === returnStruct["player"]["playerId"]) {
            divisionPosition = parseInt(j) + 1
            break
          }
        }
      }

      returnStruct["player"]["divisionPosition"] = divisionPosition

      return returnStruct
    })

    const playerEventRecords = (await Promise.allSettled(playerEventRecordsPromises)).filter(
      (result) => result.status === 'fulfilled' && result.value !== null
    ).map(result => result.value)

    playerEventRecords.sort((a, b) => b["player"]["trophies"] - a["player"]["trophies"] || a["player"]["globalPosition"] - b["player"]["globalPosition"])
    
    let playerFinalRecords = []

    // transform data to correct format
    // a non-efficient O(n^2) loop, but there are few records so performance implications are negligible
    for (let j of playerEventRecords) {
      for (let k of playerRecords) {
        if (j["player"]["playerId"] === k["id"]) {
          let individualPlayerFinalRecord = {
            "name": k["displayName"],
            "discordId": k["discordId"],
            "discordName": k["username"],
            "discordPfpId": k["discordProfilePictureId"],
            "primaryKeySeq": j["player"]["playerOrdinal"],
            "position": j["player"]["globalPosition"] + 1,
            "positionOf": currentKnownMaxPlayers,
            "trophies": j["player"]["trophies"],
            "divisionId": j["player"]["divisionId"],
            "divisionPosition": j["player"]["divisionPosition"],
            "isMainBoard": j["player"]["divisionRoot"] === 'global' ? true : false,
            "lastUpdated": j["player"]["dateUpdated"],
            "lteRank": j["player"]["lteRank"]
          }

          playerFinalRecords.push(individualPlayerFinalRecord)
        }
      }
    }
    
    const returnStructFinal = {}
    returnStructFinal["players"] = playerFinalRecords

    returnStructFinal["event"] = {}
    returnStructFinal["event"]["eventGuid"] = currentEventData["eventId"]
    returnStructFinal["event"]["eventName"] = currentEventData["eventName"]
    returnStructFinal["event"]["startDate"] = currentEventData["startDate"]
    returnStructFinal["event"]["endDate"] = currentEventData["endDate"]
    returnStructFinal["event"]["isLteLive"] = currentEventData["isLteLive"]
    returnStructFinal["event"]["eventStatus"] = currentEventData["eventStatus"]
    
    res.status(200).send(returnStructFinal)
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)
    res.sendStatus(502)
  }
})

// check if player exists
app.get('/api/player/:id', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id

    const playerState = await getPlayerState(id)
    if (playerState) {
      res.status(200).end()
    } else {
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
    }
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// get all player events with position
app.get('/api/player/:id/all', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id

    const allKnownPlayerEvents = await getKnownPlayerEvents(id)

    if (!allKnownPlayerEvents) {
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
      return
    }
    
    const joinedEvents = allKnownPlayerEvents.filter(element => element.status)

    // get results for each event
    const playerEventRecordsPromises = joinedEvents.map(async (record) => {
      const eventId = record["eventId"]

      const playerEventInfoPromise = getPlayerEventInfo(id, eventId)
      const playerLeaderboardPromise = getPlayerLeaderboard(id, eventId, 25, 25, true)

      const results = await Promise.allSettled([
        playerEventInfoPromise,
        playerLeaderboardPromise,
      ])
      
      const [playerEventInfo, playerLeaderboard] = results.map((result) => result.value)

      if (!playerEventInfo || !playerLeaderboard) {
        return null
      }
      
      // differentiate between archived and active leaderboard
      let returnStruct
      if (playerLeaderboard["results"]["rootResults"]["topResults"]) {
        // active
        returnStruct = await rankedEntryData(record, playerEventInfo, playerLeaderboard, id)
      } else {
        // archive
        returnStruct = await archivedEntryData(record, playerEventInfo, playerLeaderboard)
      }

      let divisionPosition = null

      if (returnStruct["division"]["top"]) {
        for (let j in returnStruct["division"]["top"]) {
          if (returnStruct["division"]["top"][j]["playerId"] === returnStruct["player"]["playerId"]) {
            divisionPosition = parseInt(j) + 1
            break
          }
        }

        for (let k in returnStruct["division"]["top"]) {
          returnStruct["division"]["top"][k]["playerId"] = null
        }

        for (let l in returnStruct["division"]["adjacent"]) {
          returnStruct["division"]["adjacent"][l]["playerId"] = null
        }
      }

      returnStruct["player"]["divisionPosition"] = divisionPosition
      
      return returnStruct
    })

    const playerEventRecords = (await Promise.allSettled(playerEventRecordsPromises)).filter(
      (result) => result.status === 'fulfilled' && result.value !== null
    ).map(result => result.value)
    
    res.status(200).send(playerEventRecords)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// get lifetime amount spent for player
app.get('/api/player/:id/accountvalue', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    let output = await getPlayerAccountValueFromPlayFab(id)

    // let output = {
    //   "playFabId": req.params.id,
    //   "accountValueUSD": 1234.56,
    //   "dateAccountGenesis": "2023-04-12T00:15:17Z",
    //   "dateAccountLastLogin": "2024-08-02T06:02:01Z"
    // }

    res.json(output)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// get list of all registered events for a player
app.get('/api/list/:id', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const allKnownPlayerEvents = await getKnownPlayerEvents(id)
    
    if (allKnownPlayerEvents) {
      res.status(200).json(allKnownPlayerEvents)
    } else {
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
    }
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

app.get('/api/event/:event/lb-invalid', async(req, res) => {
  const stream = await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream('afflicted-events.txt')
    const reader = readline.createInterface({
      input: readStream,
      output: process.stdout,
      terminal: false
    })
  
    reader.on('line', (line) => {
      if (line.includes(req.params.event)) {
        if (line.includes('UA')) {
          // UA: Unfair Advantage
          resolve('1')
        } else if (line.includes('DF')) {
          // DF: Data Fidelity Error
          resolve('2')
        } else {
          resolve('0')
        }
      }
    })
  
    reader.on('close', () => {
      resolve('-1')
    })
  
    readStream.on('error', (err) => {
      // fs emitted error
      reject('-1')
    })
  })
  
  res.send(stream)
  return
})

// balance data
// common gateway for rank estimator
app.get('/api/event/:event/balance', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const eventId = req.params.event

    const allEventData = await getAllEvents(future=true)
    let currentEventData

    for (let i of allEventData) {
      if (i["eventId"] == eventId) {
        currentEventData = i
        break
      }
    }

    if (currentEventData === undefined) {
      res.sendStatus(404).end()
      return
    }

    const balanceHandler = new balance(currentEventData["eventName"])
    await balanceHandler.loadBalanceData()

    const balanceData = await balanceHandler.getBalanceData()

    currentEventData["balance"] = JSON.stringify(balanceData)

    res.send(currentEventData)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(500).end()
  }
})

// common gateway for rank estimator
app.get('/api/event/:event/rank-estimator', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const eventId = req.params.event
    const trophies = req.query.trophies
    const timeElapsed = req.query.time

    // trophies is required
    if (!trophies || !parseInt(trophies)) {
      res.sendStatus(400).end()
      return
    }

    const allEventData = await getAllEvents()
    let currentEventData

    for (let i of allEventData) {
      if (i["eventId"] == eventId) {
        currentEventData = i
        break
      }
    }

    const balanceHandler = new balance(currentEventData["eventName"], currentEventData["startDate"], currentEventData["endDate"])
    await balanceHandler.loadBalanceData()

    if (!timeElapsed || !parseInt(timeElapsed)) {
      let rankString = await balanceHandler.getRankFromTrophies(parseInt(trophies))

      // getRankFromTrophies automatically caps event at the end time
      if (new Date() > currentEventData["endDate"]) {
        rankString["timeElapsed"] = currentEventData["endDate"] - currentEventData["startDate"]
      } else {
        rankString["timeElapsed"] = Math.floor((new Date() - currentEventData["startDate"]) / 1000)
      }

      res.json(rankString)
    } else {
      const timeElapsedInt = parseInt(timeElapsed)

      let currentEventStart = currentEventData["startDate"]
      let currentEventEnd = new Date(currentEventStart)
      currentEventEnd = new Date(currentEventEnd.getTime() + timeElapsedInt * 1000)

      let rankString = await balanceHandler.getRankFromTrophies(parseInt(trophies), currentEventStart, currentEventEnd)

      // getRankFromTrophies automatically caps event at the end time
      if (new Date() > currentEventData["endDate"]) {
        rankString["timeElapsed"] = currentEventData["endDate"] - currentEventData["startDate"]
      } else {
        rankString["timeElapsed"] = (currentEventEnd - currentEventStart) / 1000
      }

      res.json(rankString)
    }
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502).end()
  }
})

// master player API
app.get('/api/event/:event/:id', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const eventId = req.params.event

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
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
      return
    }

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
    if (!playerLeaderboard) {
      // don't even bother continuing if we know the ID has no record
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
      return
    }

    // differentiate between archived and active leaderboard
    let returnStruct
    if (playerLeaderboard["results"]["rootResults"]["topResults"]) {
      // active
      returnStruct = await rankedEntryData(currentEventData, playerEventInfo, playerLeaderboard, id, true)
    } else {
      // archive
      returnStruct = await archivedEntryData(currentEventData, playerEventInfo, playerLeaderboard)
    }
    
    res.status(200).json(returnStruct)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// individual position for a player
app.get('/api/event/:event/:id/position', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const eventId = req.params.event

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
    if (!playerLeaderboard) {
      // don't even bother continuing if we know the ID has no record
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

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
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// brackets for a leaderboard (requires PlayFab)
app.get('/api/event/:event/:id/brackets', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const eventId = req.params.event
    const brackets = [1, 5, 25, 100, 0.01, 0.05, 0.10, 0.25, 0.50, 0.75]

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 25, 25)
    if (!playerLeaderboard) {
      // don't even bother continuing if we know the ID has no record
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
      return
    }

    // hacky way to determine number of players
    let totalPlayers
    if (playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"]) {
      totalPlayers = playerLeaderboard["results"]["rootResults"]["offsetResults"]["rankedEntry"][0]["position"]["count"]
    } else {
      log(`${req.method} ${req.originalUrl} - cannot query from archived leaderboard.`, remoteAddress)

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
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// top players for a leaderboard (requires PlayFab)
app.get('/api/event/:event/:id/top/:count', async (req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const eventId = req.params.event
    
    const topPlayers = parseInt(req.params.count)

    if (isNaN(topPlayers)) {
      log(`${req.method} ${req.originalUrl} - invalid request`, remoteAddress)
      res.status(400).end()
      return
    } else if (topPlayers < 1 || topPlayers > 1000) {
      // server can return more than 1000 players but this ability should not be given to the client
      log(`${req.method} ${req.originalUrl} - invalid request`, remoteAddress)
      res.status(400).end()
      return
    }

    const playerLeaderboard = await getPlayerLeaderboard(id, eventId, 1, topPlayers)
    if (!playerLeaderboard["results"]["rootResults"]["topResults"]) {
      // don't even bother continuing if we know the ID has no record
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.status(404).end()
      return
    }

    let proximalPlayerHashMap = {}
    for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
      // generate a list of players from the "resolvedPlayers" key, so we can obtain metadata such as ordinal ID (yields nickname) and icon
      proximalPlayerHashMap[i["playerId"]] = {
        "sequence": i["sequence"],
        "avatarId": i["customData"] ? i["customData"]["avatarId"] : null,
        "lteRank": i["customData"] ? i["customData"]["lteRank"] : null
      }
    }

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

    const returnStruct = {}
    returnStruct["event"] = {}
    returnStruct["event"]["eventGuid"] = currentEventData["eventId"]
    returnStruct["event"]["eventName"] = currentEventData["eventName"]
    returnStruct["event"]["startDate"] = currentEventData["startDate"]
    returnStruct["event"]["endDate"] = currentEventData["endDate"]
    returnStruct["event"]["isLteLive"] = currentEventData["isLteLive"]

    returnStruct["count"] = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][0]["position"]["count"]

    returnStruct["top"] = {}
    returnStruct["top"]["count"] = topPlayers
    returnStruct["top"]["list"] = []
    for (let i of playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"]) {
      returnStruct["top"]["list"].push({
        "playerId": i["playerId"],
        "ordinal": proximalPlayerHashMap[i["playerId"]]["sequence"],
        "position": i["position"]["position"],
        "trophies": i["score"],
        "divisionId": null,
        "startTime": null,
        "endTime": null,
        "estimatedRank": null,
        "avatarId": proximalPlayerHashMap[i["playerId"]]["avatarId"],
        "lteRank": proximalPlayerHashMap[i["playerId"]]["lteRank"]
      })
    }

    const playerEventDivisionsPromises = playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"].map(async (record) => {
      const id = record["playerId"]
      
      const returnStruct = {
        "playerId": id,
        "divisionId": null,
        "startTime": null,
        "endTime": null,
        "estimatedRank": null
      }
      const playerEventInfo = await getPlayerEventInfo(id, eventId)
      
      if (!playerEventInfo) {
        return returnStruct
      }

      returnStruct["divisionId"] = playerEventInfo["segmentId"]
      returnStruct["startTime"] = playerEventInfo["created"]
      returnStruct["endTime"] = playerEventInfo["updated"]
      
      return returnStruct
    })

    const playerEventDivisions = (await Promise.allSettled(playerEventDivisionsPromises)).filter(
      (result) => result.status === 'fulfilled' && result.value !== null
    ).map(result => result.value)

    for (let i in returnStruct["top"]["list"]) {
      for (let j in playerEventDivisions) {
        if (playerEventDivisions[j]["playerId"] == returnStruct["top"]["list"][i]["playerId"]) {
          returnStruct["top"]["list"][i]["divisionId"] = playerEventDivisions[j]["divisionId"]
          returnStruct["top"]["list"][i]["startTime"] = playerEventDivisions[j]["startTime"]
          returnStruct["top"]["list"][i]["endTime"] = playerEventDivisions[j]["endTime"]
          returnStruct["top"]["list"][i]["estimatedRank"] = playerEventDivisions[j]["estimatedRank"]
          if (returnStruct["top"]["list"][i]["playerId"] !== req.params.id) {
            returnStruct["top"]["list"][i]["playerId"] = null
          }
        }
      }
    }

    res.status(200).json(returnStruct)
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    res.sendStatus(502)
  }
})

// how many players have finished the event? (estimate)
app.get('/api/event/:event/:id/finished', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)

    const id = req.params.id
    const eventId = req.params.event

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
      log(`${req.method} ${req.originalUrl} - no record found.`, remoteAddress)

      res.sendStatus(404)
      return
    }

    const balanceHandler = new balance(eventName, startTime, endTime)
    await balanceHandler.loadBalanceData()

    const maxRank = balanceHandler.getMaxRank()
    playerLeaderboard = await getPlayerLeaderboard(id, eventId, 1, 2147483647, true)

    let count = new Array(maxRank).fill(0)
    let cumulativeRank = 0
    for (let i of playerLeaderboard["resolvedPlayers"]["objectArray"]) {
      if (i["customData"] && i["customData"]["lteRank"]) {
        count[i["customData"]["lteRank"]-1] += 1
        cumulativeRank += i["customData"]["lteRank"]
      }
    }
    let rankAverage = cumulativeRank / playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"].length
    
    let percentile = []
    for (let j = 1; j <= 100; j++) {
      let rankIndex = Math.floor(j/100 * (playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"].length-1))

      percentile.push({x: j, y: playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"][rankIndex]["score"]})
    }

    let trophySum = 0
    for (let k of playerLeaderboard["results"]["rootResults"]["topResults"]["rankedEntry"]) {
      trophySum += k["score"]
    }

    let countStruct = {"maxRank": maxRank, "rankDistribution": count, "rankAverage": rankAverage, "trophyDistribution": percentile, "trophySum": trophySum}

    const returnStruct = {
      "finishers": countStruct,
      "chrono": await balanceHandler.getChrono()
    }
    res.status(200).json(returnStruct)
    return
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)

    // hacky fix
    if (e.response.status === 404) {
      res.sendStatus(404)
    } else {
      res.sendStatus(502)
    }
  }
})

app.get('/api/icons', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  try {
    log(`${req.method} ${req.originalUrl}`, remoteAddress)
    
    const fileName = await fs.promises.readFile(__dirname + '/balance/manifest.json', 'utf8')
    .then((data) => {
      const dc = JSON.parse(data)
      for (let i in dc["VersionSettings"]["Balance"]["Urls"]) {
        if (i === 'common') {
          // load balance with that name
          const balUrl = dc["VersionSettings"]["Balance"]["BaseURL"] + dc["VersionSettings"]["Balance"]["Urls"][i]
          const balUrlSplit = balUrl.split('/')
          return balUrlSplit[balUrlSplit.length - 1].slice(0, -3)
        }
      }

      return Promise.reject('Balance file not found')
    })
    .catch((error) => {
      console.error(`${(new Date()).toISOString()} [internal] - Unable to load balance master list: ${error}.`)
    })

    const commonData = await fs.promises.readFile(__dirname + '/balance/' + fileName, 'utf8')
    .then((data) => {
      const data1 = JSON.parse(data)
      return data1
    })
    .catch((error) => {
      console.error(`${(new Date()).toISOString()} [internal] - Unable to load data file ${fileName}: ${error}.`)
    })

    const avatarDataRaw = commonData["Avatars"]
    const avatarData = {}
    for (const avatar of avatarDataRaw) {
      avatarData[avatar.ID] = avatar.VisualKey
    }

    res.status(200).json(avatarData)
    
  } catch (e) {
    log(`${req.method} ${req.originalUrl} error - ${e}`, remoteAddress, true)
  }

  return
})

app.post('/api/admin', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  if (req.body && crypto.createHash('sha256').update(req.body.password).digest('hex') === process.env.ADMIN_PWD) {
    log(`${req.method} ${req.originalUrl} - successful admin login`, remoteAddress)
    const returnStruct = {
      "discordLeaderboard": null,
      "dbPlayerList": null,
      "dbPlayerEventRecordCount": null,
      "currentTitleDataFileVersion": null
    }

    returnStruct["discordLeaderboard"] = await dbPlayerDiscordRecords()
    returnStruct["dbPlayerList"] = await dbPlayerList()
    returnStruct["dbPlayerEventRecordCount"] = (await dbPlayerEventRecords()).length

    returnStruct["currentTitleDataFileVersion"] = await fs.promises.readFile(__dirname + '/balance/version', 'utf8')
    .then((data) => {
      return data
    })
    .catch((error) => {
      console.error('Unable to determine balance version')
    })

    res.json(returnStruct)
  } else {
    log(`${req.method} ${req.originalUrl} - failed admin login`, remoteAddress)
    res.sendStatus(401)
  }
  
  return
})

app.post('/api/admin/data-file', async(req, res) => {
  const remoteAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  if (req.body && crypto.createHash('sha256').update(req.body.password).digest('hex') === process.env.ADMIN_PWD) {
    log(`${req.method} ${req.originalUrl} - successful admin login`, remoteAddress)

    const returnStruct = {
      "status": 1,
      "statusMessage": null
    }
    
    const balanceVersionOnDisk = await fs.promises.readFile(__dirname + '/balance/version', 'utf8')
    .then((data) => {
      return data
    })
    .catch((error) => {
      console.error('Unable to determine balance version')
      return
    })

    const balanceVersionRequested = req.body.version
    const balanceVersionRequestedArr = balanceVersionRequested.split('.')

    // make sure version strings are INTS
    for (let i of balanceVersionRequestedArr) {
      if (isNaN(parseInt(i))) {
        returnStruct["statusMessage"] = 'Invalid version requested'
        res.json(returnStruct)
        return
      }
    }

    if (balanceVersionOnDisk) {
      const balanceVersionOnDiskArr = balanceVersionOnDisk.split('.')

      for (let i of balanceVersionOnDiskArr) {
        if (isNaN(parseInt(i))) {
          returnStruct["statusMessage"] = 'Invalid version requested'
          res.json(returnStruct)
          return
        }
      }
      
      // make sure we're not going back to a pervious version
      if (parseInt(balanceVersionOnDiskArr[0]) > parseInt(balanceVersionRequestedArr[0])) {
        returnStruct["statusMessage"] = 'Cannot request an older version'
        res.json(returnStruct)
        return
      } else if ((parseInt(balanceVersionOnDiskArr[0]) === parseInt(balanceVersionRequestedArr[0])) && (parseInt(balanceVersionOnDiskArr[1]) > parseInt(balanceVersionRequestedArr[1]))) {
        returnStruct["statusMessage"] = 'Cannot request an older version'
        res.json(returnStruct)
        return
      }
    }
    
    const dataFilesForRequestedVersion = await getDataFilesForTitleVersion(balanceVersionRequested)
    .catch((error) => {
      console.error('Unable to load new data files')
      returnStruct["statusMessage"] = 'Unable to load new data files'
      res.json(returnStruct)
      return
    })

    if (!dataFilesForRequestedVersion) {
      return
    }

    const pathToSaveNewDataFileManifest = path.join(__dirname, 'balance', 'manifest.json');
    await fs.promises.writeFile(pathToSaveNewDataFileManifest, JSON.stringify(dataFilesForRequestedVersion));

    // TODO: Delete old balance files
    const existingManifest = await fs.promises.readFile(__dirname + '/balance/manifest.json', 'utf8')
    .then((data) => {
      return JSON.parse(data)
    })
    .catch((error) => {
      console.error('Unable to load manifest')
      returnStruct["statusMessage"] = 'Unable to load manifest'
      res.json(returnStruct)
      return
    })

    const existingBalanceFiles = []
    for (let i of Object.values(existingManifest["VersionSettings"]["Balance"]["Urls"])) {
      existingBalanceFiles.push(i)
    }
    existingBalanceFiles.push(existingManifest["VersionSettings"]["LTESchedule"]["Url"].split('/').at(-1))
    
    for (let i of existingBalanceFiles) {
      await fs.promises.unlink(__dirname + '/balance/' + i.replace('.gz', ''))
      .catch((err) => console.log(`Unable to delete existing balance file ${i.replace('.gz', '')} (does it exist?)`))
    }

    const urlsToDownload = []
    for (let i of Object.values(dataFilesForRequestedVersion["VersionSettings"]["Balance"]["Urls"])) {
      urlsToDownload.push(`${dataFilesForRequestedVersion["VersionSettings"]["Balance"]["BaseURL"]}${i}`)
    }
    urlsToDownload.push(dataFilesForRequestedVersion["VersionSettings"]["LTESchedule"]["Url"])
    
    downloadToBalance(urlsToDownload)
    .then(() => {})
    .catch((err) => {console.error("Unable to download new data files")});

    const pathToSaveVersionString = path.join(__dirname, 'balance', 'version');
    await fs.promises.writeFile(pathToSaveVersionString, balanceVersionRequested);

    returnStruct["status"] = 0
    res.json(returnStruct)
  } else {
    log(`${req.method} ${req.originalUrl} - failed admin login`, remoteAddress)
    res.sendStatus(401)
  }

  return
})

app.get('/api/build', async(req, res) => {
  const buildId = process.env.COMMIT_HASH || "BUILD UNKNOWN";
  res.status(200).send(buildId)
})

app.listen(port, '0.0.0.0', () => {
  log(`Server listening on port ${port}.`, 'internal')
})