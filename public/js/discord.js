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
  }

  const invalidBanner = await getInvalidState(selectedEventId)

  if (invalidBanner && invalidBanner === "true") {
    document.querySelector('#exploitWarning').classList.remove('d-none')
  } else {
    document.querySelector('#exploitWarning').classList.add('d-none')
  }

  document.querySelector('table').classList.add('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')

  const discordId = await getDiscordId()
  populateDiscordLeaderboardTable(playerData, discordId)
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
  return await fetch(`api/discord/${eventId}`)
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
  document.querySelector('#mainContent').classList.remove('d-none')

  let tbody = document.querySelector('#discordLeaderboard')
  const allExistingRows = document.querySelectorAll('tbody tr')
  
  for (let i of allExistingRows) {
    i.remove()
  }

  for (let i in discordLb) {
    let discordLbRow = document.createElement('tr')
    if (discordId === discordLb[i]["discordId"]) {
      discordLbRow.classList.add('fw-bold')
      
      if (i !== "0") {
        let trophyDelta = discordLb[i-1]["trophies"] - discordLb[i]["trophies"] + 10

        let moveUp = document.createElement('tr')
        moveUp.classList.add('fw-bold')
        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 10)
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
    image.src = `img/users/${discordLb[i]["discordId"]}.png`
    image.style = 'width: 40px;'
    image.alt = '' // don't add a value to this or it'll look ugly
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    nameCell.innerText = discordLb[i]["name"]

    let discordNameCell = document.createElement('td')
    discordNameCell.innerText = discordLb[i]["discordName"]

    let positionCell = document.createElement('td')
    if (discordLb[i]["isMainBoard"]) {
      positionCell.innerText = `${discordLb[i]["position"].toLocaleString()} / ${discordLb[i]["positionOf"].toLocaleString()}`
    } else {
      positionCell.innerText = '*'
    }

    let percentileCell = document.createElement('td')
    if (discordLb[i]["isMainBoard"]) {
      percentileCell.innerText = `${(discordLb[i]["position"]/discordLb[i]["positionOf"] * 100).toFixed(2)}%`
    } else {
      percentileCell.innerText = '*'
    }

    let divRankCell = document.createElement('td')
    divRankCell.innerHTML = discordLb[i]["divisionPosition"] ? getPositionHTMLFormat(discordLb[i]["divisionPosition"]) : '?'

    let trophiesCell = document.createElement('td')
    trophiesCell.innerText = discordLb[i]["trophies"].toLocaleString()

    let rankCell = document.createElement('td')
    rankCell.innerText = `${discordLb[i]["rankString"]["rank"]}/${discordLb[i]["rankString"]["mission"]}`

    let lastUpdatedCell = document.createElement('td')
    lastUpdatedCell.innerText = new Date(discordLb[i]["lastUpdated"]).toLocaleString()

    discordLbRow.append(idCell)
    discordLbRow.append(imageCell)
    discordLbRow.append(nameCell)
    discordLbRow.append(discordNameCell)
    discordLbRow.append(positionCell)
    discordLbRow.append(percentileCell)
    discordLbRow.append(divRankCell)
    discordLbRow.append(trophiesCell)
    discordLbRow.append(rankCell)
    discordLbRow.append(lastUpdatedCell)
    
    tbody.appendChild(discordLbRow)
  }

  populateSharedDivisions(discordLb)

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
      element.innerHTML = `${expandPlayerList(keys[j])} shared a division!`
      listRoot.append(element)
    }
  }

  if (listRoot.childElementCount > 0) {
    document.querySelector('#sharedDivisions').appendChild(listRoot)
  } else {
    document.querySelector('#sharedDivisions').innerText = 'No players on the Discord leaderboard shared a division in this event.'
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
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormDiscordLeaderboard()
})