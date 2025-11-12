const postFormDiscordLeaderboard = async() => {
  // not a valid event if "level" attribute is present or "value" attribute is missing (check explicitly)
  if (document.querySelector('option:checked').getAttribute('level') !== null || document.querySelector('option:checked').getAttribute('value') === null) {
    return
  }

  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.remove('d-none')
  document.querySelector('#discordLeaderboardLoadError').innerText = 'Loading ...'

  const selectedEventId = document.querySelector('option:checked').value
  const playerData = await getDiscordLeaderboard(selectedEventId)

  if (!playerData) {
    document.querySelector('#discordLeaderboardLoadError').classList.remove('d-none')
    return
  } else if (playerData.length === 0) {
    document.querySelector('#discordLeaderboardLoadError').innerText = 'No player records found for the specified query'
    return
  }

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

  document.querySelector('table').classList.add('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')

  const discordId = await getDiscordId()

  populateDiscordLeaderboardTable(playerData, discordId)
  populateSharedDivisions(playerData["players"])
  populateBoxPlot(playerData["players"], discordId)
}

const getEventSchedule = async() => {
  return await fetch('api/list')
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
    document.querySelector('option').innerText = 'Please check your internet connection'
    return
  })
}

const getDiscordId = async() => {
  const cachedPlayFab = localStorage.getItem('playerId')

  if (!cachedPlayFab) {
    return
  }

  const data = {
    "playFabId": cachedPlayFab
  }

  return await fetch(`api/discord/account`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 200) {
      return response.json()
      .then((data) => {
        if (new Date() - new Date(data["lastCheckDate"]+"Z") >= 56*86400*1000) {
          document.querySelector('#uncacheDisclaimer').classList.remove('d-none')
        } else {
          document.querySelector('#uncacheDisclaimer').classList.add('d-none')
        }
        return data["discordId"]
      })
    } else {
      document.querySelector('#uncacheDisclaimer').classList.add('d-none')
      return
    }
  })
  .catch((error) => {
    return
  })
}

const getDiscordLeaderboard = async(eventId) => {
  let queryUrl = `api/discord/${eventId}`

  return await fetch(queryUrl)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#discordLeaderboardLoadError').innerText = `Server error (${response.status})`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
    return false
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

const populateDiscordLeaderboardTable = (discordLb, discordId) => {
  const lteLiveSelectors = document.querySelectorAll('.live-lte');
  if (discordLb["event"]["isLteLive"]) {
    for (let i of lteLiveSelectors) {
      i.classList.remove('d-none')
    }
  } else {
    for (let i of lteLiveSelectors) {
      i.classList.add('d-none')
    }
  }

  const lteActiveSelectors = document.querySelectorAll('.active-lte');
  if (discordLb["event"]["eventStatus"] !== 'archived') {
    for (let i of lteActiveSelectors) {
      i.classList.remove('d-none')
    }
  } else {
    for (let i of lteActiveSelectors) {
      i.classList.add('d-none')
    }
  }

  document.querySelector('#mainContent').classList.remove('d-none')

  let tbody = document.querySelector('#discordLeaderboard')
  const allExistingRows = document.querySelectorAll('tbody tr')
  
  for (let i of allExistingRows) {
    i.remove()
  }

  for (let i in discordLb["players"]) {
    let discordLbRow = document.createElement('tr')
    if (discordId === discordLb["players"][i]["discordId"]) {
      discordLbRow.classList.add('fw-bold')
      
      if (i !== "0") {
        let trophyDelta = discordLb["players"][i-1]["trophies"] - discordLb["players"][i]["trophies"] + 10

        let moveUp = document.createElement('tr')
        moveUp.classList.add('fw-bold')
        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 11)
        moveUpCell.classList.add('text-center', 'trophy-delta')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`
        moveUpCell.id = 'moveUpTrophies'

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i) + 1

    let imageCell = document.createElement('td')
    imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important'

    let image = document.createElement('img')
    if (discordLb["players"][i]["discordPfpId"] !== null) {
      image.src = `https://cdn.discordapp.com/avatars/${discordLb["players"][i]["discordId"]}/${discordLb["players"][i]["discordPfpId"]}.png?size=256`
    }
    image.width = 40
    image.alt = '' // don't add a value to this or it'll look ugly
    image.classList.add('rounded-circle')
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    nameCell.innerText = discordLb["players"][i]["name"]

    let discordNameCell = document.createElement('td')
    discordNameCell.innerText = discordLb["players"][i]["discordName"]

    let positionCell = document.createElement('td')
    if (discordLb["players"][i]["isMainBoard"]) {
      positionCell.innerText = `${discordLb["players"][i]["position"].toLocaleString()} / ${discordLb["players"][i]["positionOf"].toLocaleString()}`
    } else {
      positionCell.innerText = '*'
    }

    let percentileCell = document.createElement('td')
    if (discordLb["players"][i]["isMainBoard"]) {
      percentileCell.innerText = `${(discordLb["players"][i]["position"]/discordLb["players"][i]["positionOf"] * 100).toFixed(2)}%`
    } else {
      percentileCell.innerText = '*'
    }

    let trophiesCell = document.createElement('td')
    trophiesCell.innerText = discordLb["players"][i]["trophies"].toLocaleString()

    let lastUpdatedCell = document.createElement('td')
    lastUpdatedCell.innerText = new Date(discordLb["players"][i]["lastUpdated"]).toLocaleString()

    let amountSpentCell = document.createElement('td')
    amountSpentCell.innerText = amountSpentDollars(discordLb["players"][i]["divisionId"])

    discordLbRow.append(idCell)
    discordLbRow.append(imageCell)
    discordLbRow.append(nameCell)
    discordLbRow.append(discordNameCell)
    discordLbRow.append(positionCell)
    discordLbRow.append(percentileCell)

    if (discordLb["event"]["eventStatus"] !== 'archived') {
      let divRankCell = document.createElement('td')
      divRankCell.innerHTML = getPositionHTMLFormat(discordLb["players"][i]["divisionPosition"])
      discordLbRow.append(divRankCell)
    }

    discordLbRow.append(trophiesCell)

    if (discordLb["event"]["isLteLive"]) {
      let rankCell = document.createElement('td')
      rankCell.innerText = discordLb["players"][i]["lteRank"]
      discordLbRow.appendChild(rankCell)
    }

    discordLbRow.append(lastUpdatedCell)
    discordLbRow.append(amountSpentCell)
    
    tbody.appendChild(discordLbRow)
  }

  document.querySelector('table').classList.remove('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')
}

const populateSharedDivisions = (data) => {
  const keys = {}
  const listRoot = document.createElement('ul')

  document.querySelector('#sharedDivisions').innerHTML = ''
  for (i of data) {
    let cheaterLabel = i["isMainBoard"] ? "main" : "cheater"
    let divisionExtendedKey = `${i["divisionId"]}~${cheaterLabel}`

    if (Object.keys(keys).includes(divisionExtendedKey)) {
      keys[divisionExtendedKey].push(i["name"])
    } else {
      keys[divisionExtendedKey] = [i["name"]]
    }
  }
  
  for (j of Object.keys(keys)) {
    if (keys[j].length > 1) {
      const element = document.createElement('li')
      element.innerHTML = `${expandPlayerList(keys[j])} shared a shortboard!`
      listRoot.append(element)
    }
  }

  if (listRoot.childElementCount > 0) {
    document.querySelector('#sharedDivisions').appendChild(listRoot)
  } else {
    document.querySelector('#sharedDivisions').innerText = 'No players on the Discord leaderboard shared a shortboard in this event.'
  }
}

const populateBoxPlot = (data, playerId) => {
  while (document.querySelector('#boxPlotLabelContainer').childElementCount > 0) {
    document.querySelector('#boxPlotLabelContainer').children[0].remove()
  }
  
  while (document.querySelector('#boxPlotContent').childElementCount > 0) {
    document.querySelector('#boxPlotContent').children[0].remove()
  }

  let brackets = [
    {"absoluteThreshold":    1, "label": "Champion"},
    {"absoluteThreshold":    5, "label": "Top 5"},
    {"absoluteThreshold":   25, "label": "Top 25"},
    {"absoluteThreshold":  100, "label": "Top 100"},
    {"relativeThreshold": 0.01, "label": "Top 1%"},
    {"relativeThreshold": 0.05, "label": "Top 5%"},
    {"relativeThreshold": 0.10, "label": "Top 10%"},
    {"relativeThreshold": 0.25, "label": "Top 25%"},
    {"relativeThreshold": 0.50, "label": "Top 50%"},
    {"relativeThreshold": 0.75, "label": "Top 75%"},
    {"relativeThreshold": 1.00, "label": "Top 100%"}
  ]

  const totalPlayerCount = data[0]["positionOf"]

  for (let i = brackets.length - 1; i >= 0; i--) {
    if (!brackets[i]["relativeThreshold"]) {
      break
    }

    if (Math.floor(brackets[i]["relativeThreshold"] * totalPlayerCount) <= 100) {
      brackets.splice(i, 1)
    } else {
      brackets[i]["absoluteThreshold"] = Math.floor(brackets[i]["relativeThreshold"] * totalPlayerCount)
    }
  }

  for (let i in brackets) {
    const bracketLabelContainer = document.createElement('div')
    bracketLabelContainer.classList.add('box-plot-label')

    const bracketLabel = document.createElement('span')
    bracketLabel.classList.add('label')
    bracketLabel.innerText = brackets[i]["label"]

    const bracketLine = document.createElement('span')
    bracketLine.classList.add('line-border')

    bracketLabelContainer.appendChild(bracketLabel)
    bracketLabelContainer.appendChild(bracketLine)

    document.querySelector('#boxPlotLabelContainer').appendChild(bracketLabelContainer)
  }

  // We need to be visible to place the dots correctly, if this is not the case, we will temporarily toggle visibility
  const isCurrentlyHidden = document.querySelector('#leaderboardBoxPlotView').classList.contains('d-none')
  document.querySelector('#leaderboardBoxPlotView').classList.remove('d-none')

  // Get proper length of flexbox width (not possible to get grandparent width in CSS)
  const lineWidth = window.getComputedStyle(document.querySelector('#leaderboardBoxPlotView')).width
  document.querySelectorAll('.line-border').forEach((element) => element.style.width = lineWidth)

  if (data.length < 1) {
    return
  }
  const minTopMargin = -10
  const minLeftMargin = 25
  const minVerticalDistanceOnSameHorizontalPos = 20
  const lineLength = 200

  let activeBracket = 0
  let lastLeftLockedPlayer = 0

  // remove all records that are not on main board
  data = data.filter(x => x["isMainBoard"])

  for (let i in data) {
    const playerDot = document.createElement('span')
    playerDot.classList.add('player-dot')
    playerDot.innerText = `${data[i]["name"]}`
    
    if (data[i]["discordId"] === playerId) {
      playerDot.style.fontWeight = 'bold'
    }

    while (brackets[activeBracket]["absoluteThreshold"] < data[i]["position"]) {
      activeBracket++
    }

    if (activeBracket == 0) {
      // champion
      playerDot.style.top = `${minTopMargin}`
      playerDot.style.left = `${minLeftMargin}px`
    } else {
      // all other players
      const prevBracketMargin = (activeBracket - 1) * lineLength 
      const currBracketMargin = (1 - ((brackets[activeBracket]["absoluteThreshold"] - data[i]["position"]) / (brackets[activeBracket]["absoluteThreshold"] - brackets[activeBracket - 1]["absoluteThreshold"]))) * lineLength
      const actualTopPosition = minTopMargin + prevBracketMargin + currBracketMargin
      playerDot.style.top = `${actualTopPosition}px`

      const playerDotCount = document.querySelector('#boxPlotContent').childElementCount
      let antiOverlapLeftOffset = minLeftMargin + 0
      
      if (playerDotCount > 0) {
        // DP algorithm to assure no labels overlap
        const lastPlayerDot = document.querySelector('#boxPlotContent').children[playerDotCount - 1]
        const lastLeftLockedPlayerDot = document.querySelector('#boxPlotContent').children[lastLeftLockedPlayer]
        
        if (parseFloat(lastPlayerDot.style.top.replace('px', '')) + minVerticalDistanceOnSameHorizontalPos > actualTopPosition &&
            parseFloat(lastLeftLockedPlayerDot.style.top.replace('px', '')) + minVerticalDistanceOnSameHorizontalPos > actualTopPosition) {
          antiOverlapLeftOffset += parseFloat(window.getComputedStyle(lastPlayerDot).width.replace('px', '')) + parseFloat(lastPlayerDot.style.left.replace('px', '')) + 15
        } else {
          lastLeftLockedPlayer = i
        }
      }
      playerDot.style.left = `${antiOverlapLeftOffset}px`
    }

    document.querySelector('#boxPlotContent').appendChild(playerDot)
  }

  // hide at the end if we were not on that view
  if (isCurrentlyHidden) {
    document.querySelector('#leaderboardBoxPlotView').classList.add('d-none')
  }
}

const expandPlayerList = (names) => {
  if (names.length < 2) {
    return names[0]
  } else if (names.length === 2) {
    return `<em>${names[0]}</em> and <em>${names[1]}</em>`
  } else if (names.length > 2) {
    return `<em>${names.slice(0, -1).join('</em>, <em>')}</em>, and <em>${names.slice(-1)}</em>`
  }
}

const init = async() => {
  const eventSchedule = await getEventSchedule()

  if (eventSchedule) {
    const selectElement = document.querySelector('#eventSelect')
    const selectButton = document.querySelector('#formSubmitEvent')
    nestedEventSelector(eventSchedule, selectElement, selectButton)
  }

  document.querySelector('#earliestPossibleDate').innerText = new Date((new Date() - 56*86400*1000)).toLocaleString()

  document.querySelector('#toggleLbViewState').addEventListener('click', function() {
    if (document.querySelector('#leaderboardBoxPlotView').classList.contains('d-none')) {
      document.querySelector('#leaderboardBoxPlotView').classList.remove('d-none')
      document.querySelector('#leaderboardTabularView').classList.add('d-none')
      document.querySelector('#toggleLbViewState').innerText = 'View Leaderboard'
      document.querySelector('#contentHeader').innerText = 'Chart Plot'
    } else {
      document.querySelector('#leaderboardBoxPlotView').classList.add('d-none')
      document.querySelector('#leaderboardTabularView').classList.remove('d-none')
      document.querySelector('#toggleLbViewState').innerText = 'View Chart Plot'
      document.querySelector('#contentHeader').innerText = 'Leaderboard'
    }
  })
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormDiscordLeaderboard()
})