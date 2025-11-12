// MUST be global to reset the event listener
let eventSelectorListener

const postFormPlayFab = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#eventLoadConnectionError').classList.add('d-none')

  const playerId = document.querySelector('#playfabSavedValue').innerText
  const userExists = await getPlayerState(playerId)
  
  if (userExists) {
    document.querySelector('#playfabLoadStatus').classList.add('d-none')
    document.querySelector('#activePlayFabId').innerText = playerId

    // load event list
    await postFormEventList()
  } else {
    // no user found or general failure
    document.querySelector('#playfabLoadStatus').classList.remove('d-none')
  }
}

const postFormEventList = async() => {
  // disable dropdown while we load, and show "loading" option
  const selectList = document.querySelector('#eventSelect')
  const selectButton = document.querySelector('#formSubmitEvent')

  while (selectList.childElementCount > 0) {
    selectList.remove(selectList.lastChild)
  }

  const newOption = document.createElement('option')
  newOption.innerText = 'Loading ...'
  selectList.appendChild(newOption)
  selectList.setAttribute('disabled', 'disabled')
  selectButton.setAttribute('disabled', 'disabled')

  const playerId = document.querySelector('#activePlayFabId').innerText
  const eventList = await getPlayerEventList(playerId)

  if (eventList) {
    selectList.removeAttribute('disabled')
    selectButton.removeAttribute('disabled')

    if (eventSelectorListener) {
      selectList.removeEventListener('change', eventSelectorListener)
    }

    eventSelectorListener = nestedEventSelector(eventList.filter(element => element["status"]), selectList, selectButton)
  }
}

const postFormEvent = async() => {
  // not a valid event if "level" attribute is present or "value" attribute is missing (check explicitly)
  if (document.querySelector('option:checked').getAttribute('level') !== null || document.querySelector('option:checked').getAttribute('value') === null) {
    return
  }
  
  const playerId = document.querySelector('#activePlayFabId').innerText
  const selectedEventId = document.querySelector('option:checked').value
  const eventData = await getPlayerEventRecord(playerId, selectedEventId)
  
  if (eventData) {
    // success
    document.querySelector('#playfabLoadStatus').classList.add('d-none')
    document.querySelector('#eventLoadConnectionError').classList.add('d-none')
    document.querySelector('#mainContent').classList.remove('d-none')

    const invalidBanner = await getInvalidState(selectedEventId)

    if (invalidBanner && invalidBanner !== "-1") {
      if (invalidBanner === '1') {
        document.querySelector('#exploitWarning').classList.remove('d-none')
        document.querySelector('#dataFidelityWarning').classList.add('d-none')
      } else if (invalidBanner === '2') {
        document.querySelector('#exploitWarning').classList.add('d-none')
        document.querySelector('#dataFidelityWarning').classList.remove('d-none')
      }
    } else {
      document.querySelector('#exploitWarning').classList.add('d-none')
      document.querySelector('#dataFidelityWarning').classList.add('d-none')
    }

    const iconList = await getIconListFetch()

    populateFieldsGeneral(eventData, iconList)
  } else {
    // general failure
    document.querySelector('#eventLoadConnectionError').classList.remove('d-none')
    return
  }

  const eventBrackets = await getLeaderboardBrackets(playerId, selectedEventId)

  if (eventBrackets) {
    // success
    document.querySelector('#eventLoadConnectionError').classList.add('d-none')
    document.querySelector('#globalPositions').classList.remove('d-none')
    populateFieldsGlobal(eventBrackets, eventData)
  } else {
    // general failure
    document.querySelector('#eventLoadConnectionError').classList.remove('d-none')
    document.querySelector('#globalPositions').classList.add('d-none')
    document.querySelector('#leaderboardMarkerContainer').style = `margin-top: 0px !important;`
    document.querySelector('#leaderboardMarker').innerText = 'N/A'
    document.querySelector('#leaderboardMarker').setAttribute('inverse', 'N/A')
    document.querySelector('#bracketScore').innerText = 'unavailable'
  }
}

const getPlayerState = async(playerId) => {
  return await fetch(`api/player/${playerId}`)
  .then((response) => {
    if (response.status === 200) {
      return true
    } else if (response.status === 404) {
      document.querySelector('#playfabLoadStatus').innerText = `No account ${playerId} found.`
      return false
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#playfabLoadStatus').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#playfabLoadStatus').innerText = 'Please check your internet connection.'
    return false
  })
}

const getPlayerEventList = async(playerId) => {
  return await fetch(`api/list/${playerId}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        document.querySelector('option').innerText = `Server error (${response.status})`
        return
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('option').innerText = 'Please check your internet connection.'
      return
    })
}

const getPlayerEventRecord = async(playerId, eventId) => {
  return await fetch(`api/event/${eventId}/${playerId}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        document.querySelector('#eventLoadConnectionError').innerText = `Server error (${response.status}).`
        return
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#eventLoadConnectionError').innerText = 'Please check your internet connection'
      return
    })
}

const getLeaderboardPosition = async(playerId, eventId) => {
  return await fetch(`api/event/${eventId}/${playerId}/position`)
    .then((response) => {
      if (response.status === 200) {
        return response.text()
      } else {
        console.error(`Server error (${response.status})`)
        return `Error ${response.status}`
      }
    })
    .catch((error) => {
      console.error(error)
      return "Check connection"
    })
}

const getLeaderboardBrackets = async(playerId, eventId) => {
  return await fetch(`api/event/${eventId}/${playerId}/brackets`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        return
      }
    })
    .catch((error) => {
      console.error(error)
      return
    })
}

const getInvalidState = async(eventId) => {
  return await fetch(`api/event/${eventId}/lb-invalid`)
    .then((response) => {
      if (response.status === 200) {
        return response.text()
      } else {
        console.error(`Server error (${response.status})`)
        return
      }
    })
    .catch((error) => {
      console.error(error)
      return
    })
}

const populateFieldsGeneral = (data, iconList) => {
  const lteLiveSelectors = document.querySelectorAll('.live-lte');
  if (data["event"]["isLteLive"]) {
    for (let i of lteLiveSelectors) {
      i.classList.remove('d-none')
    }
  } else {
    for (let i of lteLiveSelectors) {
      i.classList.add('d-none')
    }
  }

  const eventDetails = getEventDetails(data["event"]["eventName"])
  document.querySelector('#eventImage').classList.remove('d-none')
  document.querySelector('#eventImage').setAttribute('src', `img/adcom/banner/${data["event"]["eventName"]}.png`)
  document.querySelector('#eventFullName').innerText = eventDetails["name"]
  document.querySelector('#eventDescription').innerText = eventDetails["desc"]
  document.querySelector('#eventStartDate').innerText = new Date(data["event"]["startDate"]).toLocaleString()
  document.querySelector('#eventEndDate').innerText = new Date(data["event"]["endDate"]).toLocaleString()
  document.querySelector('#eventDuration').innerText = `${Math.ceil((new Date(data["event"]["endDate"]) - new Date(data["event"]["startDate"])) / (60 * 60 * 1000))} hours`

  if (data["status"] === 'archived') {
    document.querySelector('#eventArchivedWarning').classList.remove('d-none')
  } else {
    document.querySelector('#eventArchivedWarning').classList.add('d-none')
  }

  document.querySelector('#playerName').innerText = getPlayerNameFromOrdinal(data["player"]["playerOrdinal"])["defaultName"]
  document.querySelector('#globalPosition').innerText = `${(data["player"]["globalPosition"]+1).toLocaleString()} / ${data["global"]["count"].toLocaleString()}`
  document.querySelector('#globalPositionPercentile').innerText = `Top ${(data["player"]["globalPosition"] / (data["global"]["count"]-1) * 100).toFixed(2)}%`
  document.querySelector('#trophies').innerText = data["player"]["trophies"].toLocaleString()
  document.querySelector('#rank').innerText = data["event"]["isLteLive"] ? data["player"]["lteRank"] : ""
  document.querySelector('#joinDate').innerText = new Date(data["player"]["dateJoined"]).toLocaleString()
  document.querySelector('#updateDate').innerText = new Date(data["player"]["dateUpdated"]).toLocaleString()
  document.querySelector('#divisionId').innerText = data["player"]["divisionId"] ? data["player"]["divisionId"] : "No division"
  document.querySelector('#divisionType').innerText = getSpendingCategory(data["player"]["divisionId"])
  document.querySelector('#leaderboardType').innerText = getLeaderboardType(data["player"]["divisionRoot"])
  document.querySelector('#leaderboardId').innerText = data["event"]["eventGuid"]
  
  let tbody = document.querySelector('#divisionPlayers')
  tbody.innerHTML = ''
  if (data["player"]["divisionId"]) {
    if (data["division"]["top"] && data["division"]["top"].length > 0) {
      const joinTimestamps = data["division"]["top"].map(x => x["dateJoined"]).sort()
      document.querySelector('#divisionTime').innerHTML = getFastTimedeltaFormat((new Date(joinTimestamps[joinTimestamps.length-1]) - new Date(joinTimestamps[0]))/1000)
    } else {
      document.querySelector('#divisionTime').innerText = 'unavailable'
    }

    for (let i in data["division"]["top"]) {
      let divisionPlayer = document.createElement('tr')
      if (data["division"]["top"][i]["ordinal"] === data["player"]["playerOrdinal"]) {
        // bold the current player's line and add a trophy delta to the player above
        divisionPlayer.classList.add('fw-bold')

        if (i !== "0") {
          let trophyDelta = data["division"]["top"][i-1]["trophies"] - data["division"]["top"][i]["trophies"] + 10

          let moveUp = document.createElement('tr')
          moveUp.classList.add('fw-bold')
          let moveUpCell = document.createElement('td')
          moveUpCell.setAttribute('colspan', 7)
          moveUpCell.classList.add('text-center', 'trophy-delta')
          moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`
          moveUpCell.class = 'moveUpTrophies'

          moveUp.appendChild(moveUpCell)
          tbody.appendChild(moveUp)
        }
      }

      let positionCell = document.createElement('td')
      positionCell.innerText = parseInt(i) + 1

      let imageCell = document.createElement('td')
      imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important; width: 0;'
  
      const playerNameProperties = getPlayerNameFromOrdinal(data["division"]["top"][i]["ordinal"])
      
      let image = document.createElement('img')
      image.src = `img/icons/v2/${iconList[data["division"]["top"][i]["avatarId"]]}.png`
      image.style = 'width: 40px; max-height: 40px;'
      image.alt = '' // don't add a value to this or it'll look ugly
      imageCell.appendChild(image)

      let nameCell = document.createElement('td')
      nameCell.innerText = playerNameProperties["defaultName"]

      let trophyCell = document.createElement('td')
      trophyCell.innerText = data["division"]["top"][i]["trophies"].toLocaleString()
      
      const lbp_parsed = parseInt(data["division"]["top"][i]["globalPosition"]) + 1
      let globalPosCell = document.createElement('td')
      globalPosCell.innerHTML = getPositionHTMLFormat(lbp_parsed)

      let globalPctCell = document.createElement('td')
      if (lbp_parsed / (data["global"]["count"]-1) >= 5e-4) {
        globalPctCell.innerHTML = `${(lbp_parsed / (data["global"]["count"]-1) * 100).toFixed(1)}%`
      }
      
      divisionPlayer.appendChild(positionCell)
      divisionPlayer.appendChild(imageCell)
      divisionPlayer.appendChild(nameCell)
      divisionPlayer.appendChild(trophyCell)
      divisionPlayer.appendChild(globalPosCell)
      divisionPlayer.appendChild(globalPctCell)
      
      if (data["event"]["isLteLive"]) {
        let rankCell = document.createElement('td')
        rankCell.innerText = data["division"]["top"][i]["lteRank"]
        divisionPlayer.appendChild(rankCell)
      }
      
      tbody.appendChild(divisionPlayer)
    }
  }
}

const populateFieldsGlobal = (data, playerData) => {
  const bracketNames = [
    'Champion',
    'Top 5',
    'Top 25',
    'Top 100',
    'Top 1%',
    'Top 5%',
    'Top 10%',
    'Top 25%',
    'Top 50%',
    'Top 75%',
    'Top 100%'
  ]

  // remove missing brackets (i.e., lack of players)
  if (Object.keys(data["brackets"]).length < bracketNames.length) {
    bracketNames.splice(4, bracketNames.length - Object.keys(data["brackets"]).length)
  }

  let bracketValues = []
  
  let tbody = document.querySelector('#globalPositions')
  tbody.innerHTML = ''
  moveUpBracket = true
  currentBracket = false

  for (let i = 0; i < Object.keys(data["brackets"]).length; i++) {
    let globalBracketLine = document.createElement('tr')
    globalBracketLine.classList.add('bracketLine')

    let bracketNameCell = document.createElement('td')
    bracketNameCell.innerText = bracketNames[i]

    let actualPositionInt

    if (Object.keys(data["brackets"])[i] >= 1) {
      actualPositionInt = parseInt(Object.keys(data["brackets"])[i])
    } else if (i === Object.keys(data["brackets"]).length - 1) {
      // correct misaligned player count
      actualPositionInt = data["totalPlayers"]
    } else {
      actualPositionInt = Math.floor(data["totalPlayers"] * (Object.keys(data["brackets"])[i]))
    }

    bracketValues.push(actualPositionInt)

    if (actualPositionInt > playerData["player"]["globalPosition"] && moveUpBracket) {
      moveUpBracket = false
      currentBracket = true

      if (currentBracket) {
        globalBracketLine.classList.add('fw-bold')
        currentBracket = false
      }

      if (playerData["player"]["globalPosition"] !== 0) {
        let trophyDelta = Object.values(data["brackets"])[i-1] - playerData["player"]["trophies"] + 10

        let moveUp = document.createElement('tr')
        moveUp.classList.add('fw-bold')

        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 3)
        moveUpCell.classList.add('text-center', 'trophy-delta')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`
        moveUpCell.id = 'moveUpTrophies'

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let actualPositionCell = document.createElement('td')
    actualPositionCell.innerHTML = getPositionHTMLFormat(actualPositionInt)

    let thresholdCell = document.createElement('td')
    if (!Object.values(data["brackets"])[i] && Object.values(data["brackets"])[i] !== 0) {
      // broken archived leaderboard
      return
    }
    thresholdCell.innerText = Object.values(data["brackets"])[i].toLocaleString()

    globalBracketLine.appendChild(bracketNameCell)
    globalBracketLine.appendChild(actualPositionCell)
    globalBracketLine.appendChild(thresholdCell)
    
    tbody.append(globalBracketLine)
  }

  let margin
  let percentageFromTop

  let bracketsTraversed = 0
  let percentageFromTopBracketScore = NaN

  for (let i = 0; i < bracketValues.length; i++) {
    if (playerData["player"]["globalPosition"] < bracketValues[i]) {
      percentageFromTop = (playerData["player"]["globalPosition"] - bracketValues[i-1]) / (bracketValues[i] - 1 - bracketValues[i-1])
      percentageFromTopBracketScore = (playerData["player"]["globalPosition"] - bracketValues[i-1] + 1) / (bracketValues[i] - bracketValues[i-1])

      margin = 41 + 80 * (i + percentageFromTop)
      break
    }
    bracketsTraversed++
  }

  if (isNaN(margin)) {
    // 1st place
    margin = 40
  }

  if (isNaN(percentageFromTopBracketScore)) {
    bracketScore = bracketValues.length - 1
  } else {
    bracketScore = bracketValues.length - (percentageFromTopBracketScore + bracketsTraversed)
  }

  document.querySelector('#bracketScore').innerText = bracketScore.toFixed(4)

  let anteriorMarkerText = getPositionHTMLFormat(playerData["player"]["globalPosition"] + 1)
  let posteriorMarkerText = getPositionHTMLFormat(playerData["player"]["globalPosition"] + 1)

  if (playerData["player"]["globalPosition"] >= 100) {
    anteriorMarkerText = `${((playerData["player"]["globalPosition"] + 1) / data["totalPlayers"] * 100).toFixed(1)}%`
  } else if (playerData["player"]["globalPosition"] / data["totalPlayers"] >= 5e-4) {
    posteriorMarkerText = `${((playerData["player"]["globalPosition"] + 1) / data["totalPlayers"] * 100).toFixed(1)}%`
  } else {
    posteriorMarkerText = '🐳'  // easter egg!
  }

  if (anteriorMarkerText.slice(-3) === ".0%") {
    anteriorMarkerText = anteriorMarkerText.slice(0, -3) + "%"
  }

  document.querySelector('#leaderboardMarker').innerHTML = anteriorMarkerText
  document.querySelector('#leaderboardMarker').setAttribute('inverse', posteriorMarkerText)
  document.querySelector('#leaderboardMarkerContainer').style = `margin-top: ${margin}px !important;`
}

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormEvent()
})

document.querySelector('#leaderboardMarker').addEventListener('click', function() {
  let posteriorMarkerText = this.getAttribute('inverse')
  let anteriorMarkerText = this.innerHTML

  this.innerHTML = posteriorMarkerText
  this.setAttribute('inverse', anteriorMarkerText)
})