const fs = require('fs')

module.exports = class BalanceParser {
  constructor(eventName, startTime, endTime) {
    this.eventName = eventName
    this.startTime = startTime
    this.endTime = endTime
    this.rankCalculationMasterSwitch = false

    fs.readFile(__dirname + '/hh-config.json', 'utf8', (err, data) => {
      const hhcfg = JSON.parse(data)
      this.rankCalculationMasterSwitch = hhcfg["rankCalculationMasterSwitch"]
    })
  }

  async loadBalanceData() {
    const fs = require('fs')
    const fileName = await fs.promises.readFile(__dirname + '/balance/_DataConfig.json', 'utf8')
    .then((data) => {
      const dc = JSON.parse(data)
      for (let i in dc["Balance"]) {
        if (i.includes(this.eventName)) {
          // load balance with that name
          const balUrl = dc["Balance"][i]
          const balUrlSplit = balUrl.split('/')
          return balUrlSplit[balUrlSplit.length - 1].slice(0, -3)
        }
      }

      return Promise.reject('Balance file not found')
    })
    .catch((error) => {
      console.error(`${(new Date()).toISOString()} [internal] - Unable to load balance master list: ${error}.`)
    })

    this.balanceData = await fs.promises.readFile(__dirname + '/balance/' + fileName, 'utf8')
    .then((data) => {
      const data1 = JSON.parse(data)
      return data1
    })
    .catch((error) => {
      console.error(`${(new Date()).toISOString()} [internal] - Unable to load data file ${fileName}: ${error}.`)
    })

    this.balanceSpendCurve = await fs.promises.readFile(__dirname + '/balance/BalSpendCurve.json', 'utf8')
    .then((data) => {
      const wlbp = JSON.parse(data)
      return wlbp["balanceSpendingCurve"][this.eventName]
    })
    .catch((error) => {
      console.error(`${(new Date()).toISOString()} [internal] - Unable to load balance spending parameters: ${error}.`)
    })
  }

  async getBalanceData() {
    return this.balanceData
  }

  async getBalanceSpendingCurve() {
    return this.balanceSpendCurve
  }

  async getChrono() {
    let chronoRetStruct = {
      "start": this.startTime,
      "end": this.endTime
    }

    return chronoRetStruct
  }

  async getThreshold() {
    let trophyCheck = 0
    let trophyStep = 10000

    if (!this.rankCalculationMasterSwitch) {
      return Infinity
    }

    while (true) {
      let rank = await this.getRankFromTrophies(trophyCheck)
      if (!rank['isMaxRank']) {
        trophyCheck += trophyStep
      } else if (rank['isMaxRank'] && trophyStep > 10) {
        trophyCheck -= (trophyStep - (trophyStep / 10))
        trophyStep /= 10
      } else {
        return trophyCheck
      }
    }
  }

  async getRankFromTrophies(trophies, startTime=undefined, endTime=undefined) {
    let realStartTime
    let realEndTime
    let duration

    if (!this.rankCalculationMasterSwitch) {
      return {"rank": 0, "mission": 0, "isMaxRank": false}
    }

    if (startTime) {
      realStartTime = startTime
    } else {
      realStartTime = this.startTime
    }

    if (endTime) {
      realEndTime = endTime
    } else {
      realEndTime = this.endTime
    }

    if (startTime && endTime) {
      duration = new Date(realEndTime) - new Date(realStartTime)
    } else {
      let curr = new Date()
  
      if (curr > this.endTime) {
        duration = this.endTime - this.startTime
      } else {
        duration = curr - this.startTime
      }
    }

    duration /= 1000
    const rankTrophies = this.getRankStructure(this.balanceData)

    // -- BEGIN HERE --
    const CRITERION_TROPHY_THRESHOLD = trophies + 0
    const CRITERION_TIME_ELAPSED = duration + 0
    let i
    
    let currentStep = Math.trunc(this.balanceData["Missions"].length / 2)
    let currentStepSize = Math.trunc(this.balanceData["Missions"].length / 2)
     
    while (currentStepSize > 0) {
      let mission = this.missionsToTrophies(this.balanceData, rankTrophies, currentStep)
      let free = this.freeCapsuleEstimate(this.balanceData, rankTrophies, CRITERION_TIME_ELAPSED, currentStep)
      
      currentStepSize = Math.trunc(currentStepSize / 2)
  
      if (mission + free >= CRITERION_TROPHY_THRESHOLD) {
        currentStep -= currentStepSize
      } else {
        currentStep += currentStepSize
      }
    }

    // check local neighborhood for exact number
    for (i = currentStep - 3; i <= currentStep + 3; i++) {
      if (i < 0 || i > this.balanceData["Missions"].length) {
        continue
      }

      let mission = this.missionsToTrophies(this.balanceData, rankTrophies, i)
      let free = this.freeCapsuleEstimate(this.balanceData, rankTrophies, CRITERION_TIME_ELAPSED, i)
 
      if (mission + free >= CRITERION_TROPHY_THRESHOLD) {
        break
      }
    }

    let currentAverage = this.missionIdToRank(this.balanceData, rankTrophies, i)
    let currentAverageRank = currentAverage[0]
    let currentAverageRankMission = currentAverage[1]
    let currentAverageIsMax = false

    if (currentAverageRank === this.balanceData["Ranks"].length) {
      currentAverageIsMax = true
    }
    
    return {
      "rank": currentAverageRank, "mission": currentAverageRankMission, "isMaxRank": currentAverageIsMax
    }
  }

  getRankStructure(data) {
    let ranks = []
    let rank
    for (let i = 0; i < data["Ranks"].length; i++) {
      if (i == data["Ranks"].length - 1) {
        rank = {
          "missions": Infinity,
          "trophyCoefficient": parseInt(data["Ranks"][i]["GachaMultiplierTrophy"])
        }
      } else {
        rank = {
          "missions": parseInt(data["Ranks"][i+1]["Missions"]),
          "trophyCoefficient": parseInt(data["Ranks"][i]["GachaMultiplierTrophy"])
        }
      }
      ranks.push(rank)
    }

    return ranks
  }

  missionIdToRank(data, rankStructure, missionId) {
    let currentRank = 1
    let currentRankMission = 0
    let currentGlobalMission = 0

    for (let i of data["Missions"]) {
      if (currentGlobalMission >= missionId) {
        break
      }
      
      currentRankMission++
      currentGlobalMission++

      if (currentRankMission >= rankStructure[currentRank-1]["missions"]) {
        currentRankMission = 0
        currentRank++
      }
    }
    
    return [currentRank, currentRankMission]
  }

  missionIdToRankTrophies(data, rankStructure, missionId, reward) {
    let currentRank = 1
    let currentRankMission = 0
    let currentGlobalMission = 0

    for (let i in data["Missions"]) {
      if (currentGlobalMission >= missionId) {
        break
      }
      
      currentRankMission++
      currentGlobalMission++

      if (currentRankMission >= rankStructure[currentRank-1]["missions"]) {
        currentRankMission = 0
        currentRank++
      }
    }
      
    for (let j of data["GachaLootTable"]) {
      if (j["Id"] == reward) {
        let trophies = j["TrophyMin"] * rankStructure[currentRank-1]["trophyCoefficient"]
        return trophies
      }
    }
  }

  missionsToTrophies(data, rankStructure, threshold) {
    let trophies = 0
    let currentRank = 1
    let currentRankMission = 0
    let currentGlobalMission = 0

    for (let i of data["Missions"]) {
      if (currentGlobalMission >= threshold) {
        break
      }
        
      let reward = i["Reward"]["RewardId"]
      if (reward !== 'plastic' && reward !== 'armored') {
        // scripted
        for (let j of data["GachaScripts"]) {
          if (j["GachaId"] == reward) {
            trophies += j["Trophy"]
          }
        }
      } else {
        // non-scripted
        for (let j of data["GachaLootTable"]) {
          if (j["Id"] == reward) {
            trophies += j["TrophyMin"] * rankStructure[currentRank-1]["trophyCoefficient"]
          }
        }
      }

      currentRankMission++
      currentGlobalMission++

      if (currentRankMission >= rankStructure[currentRank-1]["missions"]) {
        currentRankMission = 0
        currentRank++
      }
    }

    return trophies
  }

  freeCapsuleEstimate(data, rankStructure, totalSeconds, currentMission) {
    const MISSION_EXP = 1.03
    const AVG_SEC_BETWEEN_FREE = 8100

    let trophies = 0
    let freeIndex = -1
    let freeCycle = []
    let firstFreeId = data["GachaFreeCycle"][0]["ScriptId"]
    let firstFreeTrophies

    // Stage 0: Preparation
    // there is a bug where the final free capsule in a cycle is duplicated before returning to the beginning.
    // in all balances, this results in an extra plastic every twenty-four free capsules.
    for (let i of data["GachaFreeCycle"][0]["Cycle"]) {
      freeCycle.push(i)
    }

    freeCycle.push(freeCycle[freeCycle.length - 1])

    for (let i of data["GachaScripts"]) {
      if (i["GachaId"] == firstFreeId) {
        firstFreeTrophies = i["Trophy"]
      }
    }
    
    // Stage 1: Get exp curve for missions
    let timeSum = []
    let sumOfTimeSum = 0

    for (let i = 0; i < currentMission; i++) {
      const val = MISSION_EXP ** i
      timeSum.push(val)
      sumOfTimeSum += val
    }

    let timeSumNormalized = []
    let timeSumNormCum = []

    for (let i = 0; i < currentMission; i++) {
      const val = timeSum[i] / sumOfTimeSum * totalSeconds
      timeSumNormalized.push(val)
      if (i === 0) {
        timeSumNormCum.push(val)
      } else {
        timeSumNormCum.push(val + timeSumNormCum[i - 1])
      }
    }

    // Stage 2: Check all frees
    for (let i = 0; i < Math.floor(totalSeconds); i += AVG_SEC_BETWEEN_FREE) {
      if (freeIndex < 0) {
        trophies += firstFreeTrophies
      } else {
        let currentMissionId = 0
        for (let j = 0; j < timeSumNormCum.length; j++) {
          if (timeSumNormCum[j] <= i) {
            currentMissionId++
          } else {
            break
          }
        }
        
        trophies += this.missionIdToRankTrophies(data, rankStructure, currentMissionId, freeCycle[freeIndex % freeCycle.length])
      }
      freeIndex++
    }
    
    return trophies
  }
}