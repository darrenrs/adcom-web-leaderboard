const axios = require('axios')

class GameApiClient {
  constructor({ baseLeaderboard, basePlayermeta, token }) {
    this.baseLeaderboard = baseLeaderboard
    this.basePlayermeta = basePlayermeta
    this.token = token
    this.userAgent = 'adcom-web-leaderboard'
  }

  listLeaderboards() {
    return this._request(
      `${this.baseLeaderboard}/leaderboards`
    )
  }

  getPlayerMetadata(id) {
    return this._request(
      `${this.basePlayermeta}/players/${id}`
    )
  }

  getPlayerEventRegistration(id, eventId) {
    return this._request(
      `${this.baseLeaderboard}/leaderboards/${eventId}/players/${id}`
    )
  }

  getPlayerLeaderboard(id, eventId, {
    adjacentCount = 25,
    topCount = 25
  } = {}) {
    const url =
      `${this.baseLeaderboard}/leaderboards/${eventId}/players/${id}/results` +
      `?offset=${adjacentCount}` +
      `&resolvePlayers=true` +
      `&topCount=${topCount}`

    return this._request(url)
  }

  async _request(url) {
    // Timing, concurrency and retry logic will eventually live here.
    return axios.get(url, {
      headers: {
        '_token': this.token,
        'User-agent': this.userAgent
      }
    })
  }
}

module.exports = GameApiClient