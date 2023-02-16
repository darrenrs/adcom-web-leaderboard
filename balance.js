module.exports = class BalanceParser {
  constructor(eventName, startTime, endTime) {
    this.eventName = eventName
    this.startTime = startTime
    this.endTime = endTime
  }

  async loadBalanceData() {
    const fs = require('fs')
    const fileName = await fs.promises.readFile(__dirname + '/balance/_DataConfig.json', 'utf8')
    .then((data) => {
      console.log('Successfully loaded DataConfig.')

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
      console.log('Unable to load DataConfig.')
    })

    this.balanceData = await fs.promises.readFile(__dirname + '/balance/' + fileName, 'utf8')
    .then((data) => {
      console.log(`Successfully loaded DataFile ${fileName}.`)
      return JSON.parse(data)
    })
    .catch((error) => {
      console.log(`Unable to load DataFile ${fileName}.`)
    })

    this.balanceSpendCurve = await fs.promises.readFile(__dirname + '/balance/BalSpendCurve.json', 'utf8')
    .then((data) => {
      console.log('Successfully loaded BalSpendCurve.')
  
      const wlbp = JSON.parse(data)
      return wlbp["balanceSpendingCurve"][this.eventName]
    })
    .catch((error) => {
      console.log('Unable to load BalSpendCurve.')
    })
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

  async getRankFromTrophies(trophies) {
    let curr = new Date()
    let duration = 0
    if (curr > this.endTime) {
      duration = this.endTime - this.startTime
    } else {
      duration = curr - this.startTime
    }

    duration /= 1000
    const rankTrophies = this.getRankStructure(this.balanceData)

    // -- BEGIN HERE --
    const CRITERION_TROPHY_THRESHOLD = trophies + 0
    const CRITERION_TIME_ELAPSED = duration + 0
    let i

    for (i = 1; i < this.balanceData["Missions"].length; i++) {
      let mission = this.missionsToTrophies(this.balanceData, rankTrophies, i)
      let free = this.freeCapsuleEstimate(this.balanceData, rankTrophies, CRITERION_TIME_ELAPSED, i, (this.endTime - this.startTime) / 1000)
      
      if (mission + free >= CRITERION_TROPHY_THRESHOLD) {
        break
      }
    }
    
    let currentRank = 1
    let currentRankMission = 0
    let currentGlobalMission = 0
    let isMax = false

    for (let j of this.balanceData["Missions"]) {
      if (currentGlobalMission >= i) {
        break
      }
      
      currentRankMission += 1
      currentGlobalMission += 1

      if (currentRankMission >= rankTrophies[currentRank-1]["missions"]) {
        currentRankMission = 0
        currentRank += 1
      }
    }

    if (currentRank === this.balanceData["Ranks"].length) {
      isMax = true
    }
    
    return {"rank": currentRank, "mission": currentRankMission, "isMaxRank": isMax}
  }

  getRankStructure(data) {
    let ranks = []
    let rank
    for (let i = 0; i < data["Ranks"].length; i++) {
      if (i == data["Ranks"].length - 1) {
        rank = {
          "missions": 2147483647,
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

    for (i of data["Missions"]) {
      if (currentGlobalMission >= missionId) {
        break
      }
      
      currentRankMission++
      currentGlobalMission++

      if (currentRankMission >= rankStructure[currentRank-1]["missions"]) {
        currentRankMission = 0
        currentRank++
      }
    
    return currentRank, currentRankMission
    }
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

  freeCapsuleEstimate(data, rankStructure, totalSeconds, currentMission, eventLengthSeconds) {
    const MISSION_EXP = 1.05
    const AVG_SEC_BETWEEN_FREE = 7200

    let trophies = 0
    let freeIndex = -1
    let freeCycle = data["GachaFreeCycle"][0]["Cycle"]
    let firstFreeId = data["GachaFreeCycle"][0]["ScriptId"]
    let firstFreeTrophies

    // Stage 0: Preparation
    // there is a bug where the final free capsule in a cycle is duplicated before returning to the beginning.
    // in all balances, this results in an extra plastic every twenty-four free capsules.
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