const getEventSchedule = async() => {
  return await fetch('/api/list')
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
  return await fetch(`/api/event/${eventId}/${playerId}/finished`)
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

const populateFinishers = (data) => {
  // todo: fix time continuing to advance after event finish
  const endTimeDate = new Date(data["chrono"]["end"])
  const startTimeDate = new Date(data["chrono"]["start"])
  const currentDate = new Date()
  let endTimeDateActual

  if (currentDate < endTimeDate) {
    endTimeDateActual = currentDate
  } else {
    endTimeDateActual = endTimeDate
  }

  const timeElapsed = (endTimeDateActual - startTimeDate) / 1000

  document.querySelector("#giantPlayersFinished").innerText = data["finishers"].toLocaleString()
  document.querySelector("#amountSpentUSD").innerText = getAmountSpentUSD(data["spendingCurve"], timeElapsed)
  document.querySelector("#amountSpentGold").innerText = getAmountSpentGold(data["spendingCurve"], timeElapsed)
  document.querySelector("#timeDeltaElapsed").innerText = getTimedeltaFormat(startTimeDate)
  document.querySelector("#timeDeltaRemaining").innerText = getTimedeltaFormat(endTimeDate)
}

const getAmountSpentUSD = (func, timeElapsedSec) => {
  const amountRaw = Math.pow(func["base"], (func["powerSub"] - timeElapsedSec / 3600)) + func["intercept"]
  if (amountRaw <= 5) {
    return `no money`
  } else {
    return `ca. $${amountRaw.toFixed(2)}`
  }
}

const getAmountSpentGold = (func, timeElapsedSec) => {
  const amountUSD = Math.pow(func["base"], (func["powerSub"] - timeElapsedSec / 3600)) + func["intercept"]
  const goldConversion = amountUSD * (14.531 * (Math.log(amountUSD)) + 76.797)
  if (goldConversion <= 0 || isNaN(goldConversion)) {
    return '0'
  } else {
    return Math.floor(goldConversion).toLocaleString()
  }
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

  if (finishedData === 400) {
    document.querySelector('#eventFinisherLoadError').innerText = 'You need to join the current event to continue'
    document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    return
  } else if (!finishedData) {
    document.querySelector('#eventFinisherLoadError').classList.remove('d-none')
    return
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