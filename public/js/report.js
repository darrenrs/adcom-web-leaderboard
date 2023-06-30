const postFormPlayerReport = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#loadStatus').classList.remove('d-none')
  document.querySelector('#loadStatus').innerText = 'Loading ...'

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
    
    document.querySelector('#activePlayFabId').innerText = playerId
    
    // get player report
    const userData = await getPlayerReport(playerId)
    document.querySelector('#loadStatus').classList.add('d-none')
    populateUserData(userData)
  } else {
    // no user found or general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
  }
}

const getPlayerState = async(playerId) => {
  return await fetch(`api/player/${playerId}`)
  .then((response) => {
    if (response.status === 200) {
      return true
    } else if (response.status === 404) {
      document.querySelector('#loadStatus').innerText = `No account ${playerId} found.`
      return false
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#loadStatus').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#loadStatus').innerText = 'Please check your internet connection.'
    return false
  })
}

const getPlayerReport = async(playerId) => {
  return await fetch(`api/player/${playerId}/all`)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#loadStatus').innerText = `Server error (${response.status})`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#loadStatus').innerText = 'Please check your internet connection.'
    return false
  })
}

const populateUserData = (data) => {
  document.querySelector('#mainContent').classList.remove('d-none')

  let tbody = document.querySelector('#eventReport')
  const allExistingRows = document.querySelectorAll('tbody tr')
  
  for (let i of allExistingRows) {
    i.remove()
  }

  for (let i in data) {
    let discordLbRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = data.length - parseInt(i)

    let imageCell = document.createElement('td')
    imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important'

    let image = document.createElement('img')
    image.src = `img/adcom/icon/${data[i]["event"]["eventName"]}.png`
    image.style = 'height: 40px; width: 40px; background-color: rgba(0, 0, 0, 0) !important'
    image.alt = '' // don't add a value to this or it'll look ugly
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    if (!getEventDetails(data[i]["event"]["eventName"])) {
      newCell.innerText = "Unknown event!"
    } else {
      nameCell.innerText = getEventDetails(data[i]["event"]["eventName"])["name"]
    }

    let positionCell = document.createElement('td')
    positionCell.innerText = `${(data[i]["player"]["globalPosition"] + 1).toLocaleString()} / ${data[i]["global"]["count"].toLocaleString()}`

    let percentileCell = document.createElement('td')
    percentileCell.innerText = `${((data[i]["player"]["globalPosition"]+1)/data[i]["global"]["count"] * 100).toFixed(2)}%`

    let divRankCell = document.createElement('td')
    divRankCell.innerHTML = data[i]["player"]["divisionPosition"] ? getPositionHTMLFormat(data[i]["player"]["divisionPosition"]) : '?'

    let trophiesCell = document.createElement('td')
    trophiesCell.innerText = data[i]["player"]["trophies"].toLocaleString()

    let rankCell = document.createElement('td')
    rankCell.innerText = `${data[i]["rankString"]["rank"]}/${data[i]["rankString"]["mission"]}`

    let divisionTypeCell = document.createElement('td')
    divisionTypeCell.innerText = getSpendingCategory(data[i]["player"]["divisionId"])

    let lastUpdatedCell = document.createElement('td')
    lastUpdatedCell.innerText = new Date(data[i]["player"]["dateUpdated"]).toLocaleString()

    discordLbRow.append(idCell)
    discordLbRow.append(imageCell)
    discordLbRow.append(nameCell)
    discordLbRow.append(positionCell)
    discordLbRow.append(percentileCell)
    discordLbRow.append(divRankCell)
    discordLbRow.append(trophiesCell)
    discordLbRow.append(rankCell)
    discordLbRow.append(divisionTypeCell)
    discordLbRow.append(lastUpdatedCell)
    
    tbody.appendChild(discordLbRow)
  }

  document.querySelector('table').classList.remove('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')
}

const init = async() => {
  if (localStorage.getItem('playerId')) {
    let playerId = localStorage.getItem('playerId')
    document.querySelector('#playFabQuery').value = playerId
    document.querySelector('#playFabSetDefault').checked = true
  }
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formSubmitPlayFab').addEventListener('click', function() {
  postFormPlayerReport()
})

document.querySelector('#playFabQuery').addEventListener('keyup', function() {
  this.value = this.value.toUpperCase()
})