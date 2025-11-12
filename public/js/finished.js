const getEventSchedule = async() => {
  return await fetch('api/list')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#eventFinisherLoadError').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#eventFinisherLoadError').innerText = `Please check your internet connection.`
    return false
  })
}

const getEventFinishers = async(eventId, playerId) => {
  return await fetch(`api/event/${eventId}/${playerId}/finished`)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else if (response.status === 404) {
      return 404
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#eventFinisherLoadError').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#eventFinisherLoadError').innerText = `Please check your internet connection.`
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

const populateFinishers = (data) => {
  const endTimeDate = new Date(data["chrono"]["end"])
  const startTimeDate = new Date(data["chrono"]["start"])
  const currentDate = new Date()
  let endTimeDateActual

  if (currentDate < endTimeDate) {
    endTimeDateActual = currentDate
  } else {
    endTimeDateActual = endTimeDate
  }

  document.querySelector("#giantPlayersFinished").innerText = data["finishers"]["rankDistribution"][data["finishers"]["maxRank"]-1].toLocaleString()

  if (currentDate > endTimeDate) {
    // display "static" values after event ends
    document.querySelector("#timeDeltaRemaining").innerHTML = getTimedeltaFormat(currentDate)
    document.querySelector("#timeDeltaElapsed").innerHTML = getTimedeltaFormat(new Date(Date.now() + Math.abs(startTimeDate - endTimeDate)))
  } else {
    document.querySelector("#timeDeltaRemaining").innerHTML = getTimedeltaFormat(endTimeDate)
    document.querySelector("#timeDeltaElapsed").innerHTML = getTimedeltaFormat(startTimeDate)
  }

  const rankDistributionLabels = []
  for (let i = 0; i < data["finishers"]["maxRank"]; i++) {
    rankDistributionLabels.push(i+1)
  }

  let chartStatus1 = Chart.getChart("rankDistributionChart"); // <canvas> id
  if (chartStatus1 != undefined) {
    chartStatus1.destroy();
  }

  let chartStatus2 = Chart.getChart("trophyDistributionChart"); // <canvas> id
  if (chartStatus2 != undefined) {
    chartStatus2.destroy();
  }

  const ctx1 = document.querySelector('#rankDistributionChart')
  new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: rankDistributionLabels,
      datasets: [{
        label: 'Players',
        data: data["finishers"]["rankDistribution"],
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  })

  const ctx2 = document.querySelector('#trophyDistributionChart')
  new Chart(ctx2, {
    type: 'scatter',
    data: {
      labels: [],
      datasets: [{
        label: 'Percentile',
        data: data["finishers"]["trophyDistribution"],
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  })

  document.querySelector('#rankAverage').innerText = data["finishers"]["rankAverage"].toFixed(4)
  document.querySelector('#trophySum').innerText = data["finishers"]["trophySum"].toLocaleString()
}

const heartbeatCentral = async(playFab, eventSchedule) => {
  document.querySelector('#heartbeatClock').addEventListener('click', async() => {
    if (document.querySelector('#heartbeatClock').innerText !== '...') {
      document.querySelector('#heartbeatClock').innerText = '...'

      const finishedData = await getEventFinishers(eventSchedule[0]["eventId"], playFab)
      document.querySelector('#heartbeatClock').innerText = ':60'

      if (!finishedData || finishedData == 404) {
        document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
      } else {
        document.querySelector('#eventFinisherLoadError').classList.add('d-none')
      }

      populateFinishers(finishedData)
    }
  })
  setInterval(() => {
    updateClock(playFab, eventSchedule)
  }, 1000)
}

const updateClock = async (playFab, eventSchedule) => {
  const time = document.querySelector('#heartbeatClock').innerText

  if (time === '...' || document.hidden) {
    return
  }

  let timeInt = parseInt(time.substr(1))
  timeInt--

  if (timeInt < 0) {
    // lock update until next set of data retrieved
    document.querySelector('#heartbeatClock').innerText = '...'

    const finishedData = await getEventFinishers(eventSchedule[0]["eventId"], playFab)
    document.querySelector('#heartbeatClock').innerText = ':60'

    if (!finishedData || finishedData == 404) {
      document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    } else {
      document.querySelector('#eventFinisherLoadError').classList.add('d-none')
    }

    populateFinishers(finishedData)
  } else {
    if (timeInt < 10) {
      document.querySelector('#heartbeatClock').innerText = `:0${timeInt}`
    } else {
      document.querySelector('#heartbeatClock').innerText = `:${timeInt}`
    }
  }

}

const init = async() => {
  const cachedPlayFab = localStorage.getItem('playerId')

  if (!cachedPlayFab) {
    document.querySelector('#eventFinisherLoadError').innerText = 'You need to have a valid PlayFab ID to continue. Please make sure that you have entered in your ID on the main page and have checked "Set as default".'
    return
  }

  const eventSchedule = await getEventSchedule()

  if (!eventSchedule) {
    document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    return
  }

  const finishedData = await getEventFinishers(eventSchedule[0]["eventId"], cachedPlayFab)

  if (finishedData === 404) {
    document.querySelector('#eventFinisherLoadError').innerText = 'You need to join the current event to continue'
    document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    return
  } else if (!finishedData) {
    document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    return
  }
  
  const invalidBanner = await getInvalidState(eventSchedule[0]["eventId"])

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

  document.querySelector('#eventFinisherLoadError').classList.add('d-none')
  document.querySelector('#eventFinisherMaster').classList.remove('d-none')
  document.querySelector('#heartbeatClock').classList.remove('d-none')
  document.querySelector('#heartbeatClock').innerText = ':60'
  populateFinishers(finishedData)

  heartbeatCentral(cachedPlayFab, eventSchedule)
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})