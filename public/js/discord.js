const postFormDiscordLeaderboard = async() => {
  const selectedEventId = document.querySelector('option:checked').value

  document.querySelector('table').classList.add('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.remove('d-none')

  const playerData = await getDiscordLeaderboard(selectedEventId)
  populateDiscordLeaderboardTable(playerData)
}

const getEventSchedule = async() => {
  return await fetch('/api/list')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
    return false
  })
}

const getDiscordLeaderboard = async(eventId) => {
  return await fetch(`/api/discord/${eventId}`)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
    return false
  })
}

const populateDiscordLeaderboardTable = (discordLb) => {
  let tbody = document.querySelector('#discordLeaderboard')
  const allExistingRows = document.querySelectorAll('tbody tr')
  
  for (let i of allExistingRows) {
    i.remove()
  }

  for (let i in discordLb) {
    let discordLbRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i) + 1

    let imageCell = document.createElement('td')
    imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important'

    let image = document.createElement('img')
    image.src = `/img/users/${discordLb[i]["discordId"]}.png`
    image.style = 'width: 40px;'
    image.alt = ''
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    nameCell.innerText = discordLb[i]["name"]

    let discordNameCell = document.createElement('td')
    discordNameCell.innerText = discordLb[i]["discordName"]

    let positionCell = document.createElement('td')
    positionCell.innerText = `${discordLb[i]["position"].toLocaleString()} / ${discordLb[i]["positionOf"].toLocaleString()}`

    let percentileCell = document.createElement('td')
    percentileCell.innerText = `${(discordLb[i]["position"]/discordLb[i]["positionOf"] * 100).toFixed(2)}%`

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
    discordLbRow.append(trophiesCell)
    discordLbRow.append(rankCell)
    discordLbRow.append(lastUpdatedCell)
    
    tbody.appendChild(discordLbRow)
  }

  document.querySelector('table').classList.remove('d-none')
  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')
}

const populateEventScheduleList = (data) => {
  const selectList = document.querySelector('#eventSelect')
  const selectButton = document.querySelector('#formSubmitEvent')

  while (selectList.childElementCount > 0) {
    selectList.remove(selectList.lastChild)
  }

  selectList.removeAttribute('disabled')
  selectButton.removeAttribute('disabled')

  for (let i of data) {
    const newOption = document.createElement('option')
    newOption.innerText = `${getEventDetails(i["eventName"])["short"]} (${new Date(i["startDate"]).toDateString().substring(4)} to ${new Date(i["endDate"]).toDateString().substring(4)})`
    newOption.value = i["eventId"]
    
    selectList.appendChild(newOption)
  }
}

const init = async() => {
  const eventSchedule = await getEventSchedule()
  populateEventScheduleList(eventSchedule)
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormDiscordLeaderboard()
})