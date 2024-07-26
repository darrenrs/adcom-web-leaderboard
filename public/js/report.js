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
  
  let cumulativeTrophies = 0
  let globalPositions = []
  let divPositions = []

  let eventCountWithCheaterFlag = 0
  let bestPositionsByType = {
    "weekend": null,
    "mini": null,
    "supreme": null,
    "fusion": null
  }

  for (let i in data) {
    let eventReportRow = document.createElement('tr')

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
      nameCell.innerText = "Unknown event!"
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

    eventReportRow.append(idCell)
    eventReportRow.append(imageCell)
    eventReportRow.append(nameCell)
    eventReportRow.append(positionCell)
    eventReportRow.append(percentileCell)
    eventReportRow.append(divRankCell)
    eventReportRow.append(trophiesCell)
    eventReportRow.append(rankCell)
    eventReportRow.append(divisionTypeCell)
    eventReportRow.append(lastUpdatedCell)
    
    tbody.appendChild(eventReportRow)

    cumulativeTrophies += data[i]["player"]["trophies"]
    globalPositions.push(data[i]["player"]["globalPosition"])

    if (data[i]["player"]["divisionPosition"] !== null) {
      divPositions.push(data[i]["player"]["divisionPosition"])
    }

    // EVENT TYPE BEST OVERALL PERFORMANCE

    // Skip currently active event or some bugged events
    if ((new Date()).toISOString() < data[i]["event"]["endDate"] || data[i]["global"]["count"] < 1 || data[i]["event"]["eventGuid"] === 'c4b9f245-a2c5-4967-817f-93eb45ffa4e2' || data[i]["event"]["eventGuid"] === '922fc5f1-aafc-4e73-bd08-8ce2cd2ae2c9') {
      continue
    }

    const eventType = getEventDetails(data[i]["event"]["eventName"])["eventType"]
    const bracketScore = getBracketScoreFromPosition(data[i]["player"]["globalPosition"], data[i]["global"]["count"])

    if (bestPositionsByType[eventType] === null || bracketScore > bestPositionsByType[eventType]["bracketScore"]) {
      bestPositionsByType[eventType] = {
        "eventId": data[i]["event"]["eventName"],
        "eventName": getEventDetails(data[i]["event"]["eventName"])["name"],
        "bracketScore": bracketScore,
        "bracketName": getBracketNameFromId(bracketScore),
        "dateRegistered": new Date(data[i]["player"]["dateUpdated"]).toGMTString().substring(5, 16)
      }
    }

    if (data[i]["player"]["divisionRoot"] !== 'global') {
      eventCountWithCheaterFlag ++
    }
  }

  document.querySelector('table').classList.remove('d-none')
  document.querySelector('#loadStatus').classList.add('d-none')

  document.querySelector('#totalTrophies').innerText = cumulativeTrophies.toLocaleString()
  document.querySelector('#medianGlobalPos').innerHTML = getPositionHTMLFormat(globalPositions.slice().sort((a, b) => a - b)[Math.floor(globalPositions.length / 2)])

  if (divPositions.length > 0) {
    document.querySelector('#medianDivPos').innerHTML = getPositionHTMLFormat(divPositions.slice().sort((a, b) => a - b)[Math.floor(divPositions.length / 2)])
  } else {
    document.querySelector('#medianDivPos').innerText = '?'
  }

  if (eventCountWithCheaterFlag > 0) {
    document.querySelector('#cheaterExclusion').classList.remove('d-none')
    document.querySelector('#eventPositionApexByClass').parentElement.classList.add('d-none')
    return
  } else {
    document.querySelector('#cheaterExclusion').classList.add('d-none')
    document.querySelector('#eventPositionApexByClass').parentElement.classList.remove('d-none')
  }

  let missingEventTypes = 0
  let bracketScoreSum = 0

  for (let i of Object.keys(bestPositionsByType)) {
    let eventPositionApexRow = document.createElement('tr')

    let eventTypeCell = document.createElement('td')
    eventTypeCell.innerText = i.substring(0,1).toUpperCase() + i.substring(1)

    eventPositionApexRow.appendChild(eventTypeCell)

    if (bestPositionsByType[i] === null) {
      missingEventTypes ++

      let zeroEntriesCell = document.createElement('td')
      zeroEntriesCell.setAttribute('colspan', 5)
      zeroEntriesCell.innerText = 'You haven\'t played this event type before!'
      
      eventPositionApexRow.appendChild(zeroEntriesCell)
      document.querySelector('#eventPositionApexByClass').appendChild(eventPositionApexRow)
      continue
    }

    let imageCell = document.createElement('td')
    imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important'

    let image = document.createElement('img')
    image.src = `img/adcom/icon/${bestPositionsByType[i]["eventId"]}.png`
    image.style = 'height: 40px; width: 40px; background-color: rgba(0, 0, 0, 0) !important'
    image.alt = '' // don't add a value to this or it'll look ugly
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    nameCell.innerText = bestPositionsByType[i]["eventName"]

    let bracketCell = document.createElement('td')
    bracketCell.innerText = bestPositionsByType[i]["bracketName"]

    let bracketScoreCell = document.createElement('td')
    bracketScoreCell.innerText = bestPositionsByType[i]["bracketScore"].toFixed(4)

    let dateRegisteredCell = document.createElement('td')
    dateRegisteredCell.innerText = bestPositionsByType[i]["dateRegistered"]

    eventPositionApexRow.appendChild(imageCell)
    eventPositionApexRow.appendChild(nameCell)
    eventPositionApexRow.appendChild(bracketCell)
    eventPositionApexRow.appendChild(bracketScoreCell)
    eventPositionApexRow.appendChild(dateRegisteredCell)

    document.querySelector('#eventPositionApexByClass').appendChild(eventPositionApexRow)

    bracketScoreSum += bestPositionsByType[i]["bracketScore"]
  }

  if (missingEventTypes === 0) {
    document.querySelector('#bracketScoreSum').innerText = `Bracket Score Sum: ${bracketScoreSum.toFixed(4)} (${getBracketScoreSumQualitativeDescriptor(bracketScoreSum)})`
    document.querySelector('#bracketScoreSum').classList.remove('d-none')
  } else {
    document.querySelector('#bracketScoreSum').classList.add('d-none')
  }
}

const getBracketScoreFromPosition = (position, total) => {
  let baseScore
  let minBracketPos
  let maxBracketPos
  
  if (position < 1) {
    return 10
  } else if (position < 5) {
    baseScore = 9
    minBracketPos = 1
    maxBracketPos = 5
  } else if (position < 25) {
    baseScore = 8
    minBracketPos = 5
    maxBracketPos = 25
  } else if (position < 100) {
    baseScore = 7
    minBracketPos = 25
    maxBracketPos = 100
  } else if ((position+1)/total <= 0.01) {
    baseScore = 6
    minBracketPos = 100
    maxBracketPos = Math.floor(total/100)
  } else if ((position+1)/total <= 0.05) {
    baseScore = 5
    minBracketPos = Math.floor(total/100)
    maxBracketPos = Math.floor(total/20)
  } else if ((position+1)/total <= 0.1) {
    baseScore = 4
    minBracketPos = Math.floor(total/20)
    maxBracketPos = Math.floor(total/10)
  } else if ((position+1)/total <= 0.25) {
    baseScore = 3
    minBracketPos = Math.floor(total/10)
    maxBracketPos = Math.floor(total/4)
  } else if ((position+1)/total <= 0.5) {
    baseScore = 2
    minBracketPos = Math.floor(total/4)
    maxBracketPos = Math.floor(total/2)
  } else if ((position+1)/total <= 0.75) {
    baseScore = 1
    minBracketPos = Math.floor(total/2)
    maxBracketPos = Math.floor(total/(4/3))
  } else {
    baseScore = 0
    minBracketPos = Math.floor(total/(4/3))
    maxBracketPos = total + 0
  }

  let actualPosition = position + 1 // starting at 1st, no 0
  let percentageWithinBracket = (maxBracketPos - actualPosition) / (maxBracketPos - minBracketPos)

  return percentageWithinBracket + baseScore
}

const getBracketNameFromId = (bracketScore) => {
  const bracketNames = [
    "Top 100%",
    "Top 75%",
    "Top 50%",
    "Top 25%",
    "Top 10%",
    "Top 5%",
    "Top 1%",
    "Top 100",
    "Top 25",
    "Top 5",
    "Champion"
  ]

  const bracketId = parseInt(Math.floor(bracketScore))

  return bracketNames[bracketId]
}

const getBracketScoreSumQualitativeDescriptor = (bracketScoreSum) => {
  if (bracketScoreSum >= 32) {
    return "Ineffably high" // average 8.00 = 25th
  } else if (bracketScoreSum >= 29) {
    return "Extremely high" // average 7.25 = 75th = 0.1%
  } else if (bracketScoreSum >= 27) {
    return "Very high"      // average 6.75 = 200th = 0.2%
  } else if (bracketScoreSum >= 25) {
    return "Above average"  // average 6.25 = 500th = 0.7%
  } else if (bracketScoreSum >= 20) {
    return "Average"        // average 5.00 = 4000th = 5.0%
  } else {
    return "Below average"
  }
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