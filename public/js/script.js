const postFormPlayFab = async() => {
  const playerId = document.querySelector('#playFabQuery').value
  const saveCurrentId = document.querySelector('#playFabSetDefault')
  
  const userExists = await getPlayerState(playerId)
  
  if (userExists) {
    // success
    if (saveCurrentId.checked) {
      localStorage.setItem('playerId', playerId)
    } else {
      localStorage.removeItem('playerId')
    }
    
    document.querySelector('#noAccountFound').classList.add('d-none')
    document.querySelector('#activePlayFabId').innerText = playerId

    // load event list
    await postFormEventList()
  } else {
    // no user found or general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
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
  newOption.innerText = 'Please wait ...'
  selectList.appendChild(newOption)
  selectList.setAttribute('disabled', 'disabled')
  selectButton.setAttribute('disabled', 'disabled')

  const playerId = document.querySelector('#activePlayFabId').innerText
  const eventList = await getPlayerEventList(playerId)

  if (eventList) {
    selectList.removeAttribute('disabled')
    selectButton.removeAttribute('disabled')

    const templateOption = document.querySelector('option')
    templateOption.remove()

    for (let i of eventList) {
      if (i["status"]) {
        // the player participated in this event
        const newOption = document.createElement('option')
        newOption.innerText = `${i["eventName"]} ${i["startDate"]}`
        newOption.value = i["eventId"]
        
        selectList.appendChild(newOption)
      }
    }

    if (selectList.childElementCount < 1) {
      // if after all this there have been no events found, we will restore the template message
      // it is possible for a PlayFab account to exist but no events to have been participated in
      const newOption = document.createElement('option')
      newOption.innerText = 'No event participation'
      selectList.appendChild(newOption)
      selectList.setAttribute('disabled', 'disabled')
      selectButton.setAttribute('disabled', 'disabled')
    }
  }
}

const postFormEvent = async() => {
  const playerId = document.querySelector('#activePlayFabId').innerText
  const selectedEventId = document.querySelector('option:checked').value

  const eventData = await getPlayerEventRecord(playerId, selectedEventId)
  
  if (eventData) {
    // success
    document.querySelector('#noAccountFound').classList.add('d-none')
    populateFieldsDivision(eventData)
  } else {
    // general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
    return
  }

  const eventBrackets = await getLeaderboardBrackets(playerId, selectedEventId)

  if (eventBrackets) {
    // success
    document.querySelector('#eventLoadConnectionError').classList.add('d-none')
    populateFieldsGlobal(eventBrackets)
  } else {
    // general failure
    document.querySelector('#eventLoadConnectionError').classList.remove('d-none')
  }
}

const getPlayerState = async(playerId) => {
  return await fetch(`/api/player/${playerId}`)
  .then((response) => {
    if (response.status === 200) {
      return true
    } else {
      document.querySelector('#noAccountFound').innerText = `No account ${playerId} found.`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#noAccountFound').innerText = 'Please check your internet connection'
    return false
  })
}

const getPlayerEventList = async(playerId) => {
  return await fetch(`/api/list/${playerId}`)
    .then((response) => {
      return response.json()
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('option').innerText = 'Please check your internet connection'
      return
    })
}

const getPlayerEventRecord = async(playerId, eventId) => {
  return await fetch(`/api/event/${eventId}/${playerId}`)
    .then((response) => {
      return response.json()
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#eventLoadConnectionError').innerText = 'Please check your internet connection'
      return
    })
}

const getLeaderboardBrackets = async(playerId, eventId) => {
  return await fetch(`/api/event/${eventId}/${playerId}/brackets`)
    .then((response) => {
      return response.json()
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#eventLoadConnectionError').innerText = 'Please check your internet connection'
      return
    })
}

const populateFieldsDivision = (data) => {
  document.querySelector('#playerName').innerText = getPlayerNameFromOrdinal(data["player"]["playerOrdinal"])
  document.querySelector('#globalPosition').innerText = `${(data["player"]["globalPosition"]+1).toLocaleString()} / ${data["global"]["count"].toLocaleString()}`
  document.querySelector('#globalPositionPercentile').innerText = `Top ${(data["player"]["globalPosition"] / (data["global"]["count"]-1) * 100).toFixed(2)}%`
  document.querySelector('#joinDate').innerText = new Date(data["player"]["dateJoined"]).toLocaleString()
  document.querySelector('#updateDate').innerText = new Date(data["player"]["dateUpdated"]).toLocaleString()
  document.querySelector('#divisionId').innerText = data["player"]["divisionId"]
  document.querySelector('#divisionType').innerText = getSpendingCategory(data["player"]["divisionId"])
  document.querySelector('#leaderboardType').innerText = getLeaderboardType(data["player"]["divisionRoot"])
  document.querySelector('#leaderboardId').innerText = data["event"]["eventGuid"]
  
  let tbody = document.querySelector('#divisionPlayers')
  tbody.innerHTML = ''
  for (let i in data["division"]["top"]) {
    let divisionPlayer = document.createElement('tr')
    if (data["division"]["top"][i]["ordinal"] === data["player"]["playerOrdinal"]) {
      // bold the current player's line and add a trophy delta to the player above
      divisionPlayer.classList.add('fw-bold')

      if (i !== "0") {
        let trophyDelta = data["division"]["top"][i-1]["trophies"] - data["division"]["top"][i]["trophies"] + 10

        let moveUp = document.createElement('tr')
        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 3)
        moveUpCell.classList.add('text-center')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let positionCell = document.createElement('td')
    positionCell.innerText = parseInt(i) + 1

    let nameCell = document.createElement('td')
    nameCell.innerText = getPlayerNameFromOrdinal(data["division"]["top"][i]["ordinal"])

    let trophyCell = document.createElement('td')
    trophyCell.innerText = data["division"]["top"][i]["trophies"].toLocaleString()

    divisionPlayer.appendChild(positionCell)
    divisionPlayer.appendChild(nameCell)
    divisionPlayer.appendChild(trophyCell)
    
    tbody.appendChild(divisionPlayer)
  }
}

const populateFieldsGlobal = (data) => {
  const bracketNames = [
    'Champion',
    'Top 5',
    'Top 25',
    'Top 100',
    'Glorious',
    'Elite',
    'Prime',
    'Grand',
    'Advanced',
    'Workforce'
  ]
  
  let tbody = document.querySelector('#globalPositions')
  tbody.innerHTML = ''

  for (let i = 0; i < Object.keys(data["brackets"]).length; i++) {
    let globalBracketLine = document.createElement('tr')

    let bracketNameCell = document.createElement('td')
    bracketNameCell.innerText = bracketNames[i]

    let actualPositionInt
    if (Object.keys(data["brackets"])[i] >= 1) {
      actualPositionInt = (Object.keys(data["brackets"])[i])
    } else {
      actualPositionInt = Math.floor(data["totalPlayers"] * (Object.keys(data["brackets"])[i]))
    }

    let actualPositionCell = document.createElement('td')
    actualPositionCell.innerText = actualPositionInt.toLocaleString()

    let thresholdCell = document.createElement('td')
    if (!Object.values(data["brackets"])[i]) {
      // broken archived leaderboard
      return
    }
    thresholdCell.innerText = Object.values(data["brackets"])[i].toLocaleString()

    globalBracketLine.appendChild(bracketNameCell)
    globalBracketLine.appendChild(actualPositionCell)
    globalBracketLine.appendChild(thresholdCell)
    
    tbody.append(globalBracketLine)
  }
}

document.querySelector('#playFabQuery').addEventListener('keyup', function() {
  this.value = this.value.toUpperCase()
})

document.querySelector('#formSubmitPlayFab').addEventListener('click', function() {
  postFormPlayFab()
})

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormEvent()
})

if (localStorage.getItem('playerId')) {
  let playerId = localStorage.getItem('playerId')
  document.querySelector('#playFabQuery').value = playerId
  document.querySelector('#playFabSetDefault').checked = true
}