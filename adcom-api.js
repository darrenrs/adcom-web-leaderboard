const axios = require('axios')

const DEFAULT_MAX_CONCURRENCY = 4
const DEFAULT_REQUESTS_PER_SECOND = 8
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_FALLBACK_RETRY_MS = 2_000
const DEFAULT_RETRY_JITTER_MS = 250

const readNumber = (name, fallback, minimum) => {
  const parsed = Number(process.env[name])

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

class TemporaryUpstreamError extends Error {
  constructor(operation, cause, retryAfterMs) {
    super(`Game API temporarily unavailable during ${operation}`, {cause})
    this.name = 'TemporaryUpstreamError'
    this.code = 'GAME_API_TEMPORARY_FAILURE'
    this.operation = operation
    this.status = cause.response?.status ?? null
    this.retryAfterMs = retryAfterMs
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1_000))

    // Preserve Axios response information for existing callers that inspect it.
    this.response = cause.response
  }
}

class GameApiClient {
  constructor({
    baseLeaderboard,
    basePlayermeta,
    token,
    transport = axios,
    logger = console,
    maxConcurrency = readNumber(
      'ADCOM_API_MAX_CONCURRENCY',
      DEFAULT_MAX_CONCURRENCY,
      1
    ),
    requestsPerSecond = readNumber(
      'ADCOM_API_REQUESTS_PER_SECOND',
      DEFAULT_REQUESTS_PER_SECOND,
      0.001
    ),
    timeoutMs = readNumber(
      'ADCOM_API_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      1
    ),
    maxRetries = readNumber(
      'ADCOM_API_MAX_RETRIES',
      DEFAULT_MAX_RETRIES,
      0
    ),
    fallbackRetryMs = readNumber(
      'ADCOM_API_FALLBACK_RETRY_MS',
      DEFAULT_FALLBACK_RETRY_MS,
      0
    ),
    retryJitterMs = readNumber(
      'ADCOM_API_RETRY_JITTER_MS',
      DEFAULT_RETRY_JITTER_MS,
      0
    ),
    sleep = wait,
    now = Date.now,
    random = Math.random
  }) {
    this.baseLeaderboard = baseLeaderboard
    this.basePlayermeta = basePlayermeta
    this.token = token
    this.userAgent = 'adcom-web-leaderboard'

    this.transport = transport
    this.logger = logger
    this.maxConcurrency = Math.floor(maxConcurrency)
    this.minimumStartIntervalMs = 1_000 / requestsPerSecond
    this.timeoutMs = Math.floor(timeoutMs)
    this.maxRetries = Math.floor(maxRetries)
    this.fallbackRetryMs = Math.floor(fallbackRetryMs)
    this.retryJitterMs = Math.floor(retryJitterMs)
    this.sleep = sleep
    this.now = now
    this.random = random

    this.normalQueue = []
    this.retryQueue = []
    this.activeRequests = 0
    this.nextStartAt = 0
    this.cooldownUntil = 0
    this.drainTimer = null

    this.stats = {
      requests: 0,
      attempts: 0,
      succeeded: 0,
      failed: 0,
      retries: 0,
      rateLimited: 0
    }
  }

  listLeaderboards() {
    return this._request(
      'list-leaderboards',
      `${this.baseLeaderboard}/leaderboards`
    )
  }

  getPlayerMetadata(id) {
    return this._request(
      'player-metadata',
      `${this.basePlayermeta}/players/${id}`
    )
  }

  getPlayerEventRegistration(id, eventId) {
    return this._request(
      'player-event-registration',
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

    return this._request('player-leaderboard', url)
  }

  getStats() {
    return {
      ...this.stats,
      active: this.activeRequests,
      queued: this.normalQueue.length + this.retryQueue.length,
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - this.now())
    }
  }

  async _request(operation, url) {
    const requestId = ++this.stats.requests
    let lastError
    let retryAfterMs = this.fallbackRetryMs

    for (let retryIndex = 0; retryIndex <= this.maxRetries; retryIndex++) {
      const attempt = retryIndex + 1

      try {
        const response = await this._schedule(
          () => this._performAttempt({
            requestId,
            operation,
            url,
            attempt,
            retryIndex
          }),
          retryIndex > 0
        )

        this.stats.succeeded++
        return response
      } catch (error) {
        lastError = error
        retryAfterMs = error.gameApiRetryAfterMs ?? retryAfterMs

        if (!this._isRetryable(error)) {
          this.stats.failed++
          throw error
        }

        if (retryIndex >= this.maxRetries) {
          this.stats.failed++
          throw new TemporaryUpstreamError(
            operation,
            error,
            retryAfterMs
          )
        }

        this.stats.retries++
        this._log(
          'warn',
          `request=${requestId} operation=${operation} ` +
          `retry=${attempt}/${this.maxRetries} waitMs=${retryAfterMs}`
        )

        // A 429 pauses the shared queue. Other transient failures delay only
        // this logical request before its next attempt rejoins the queue.
        if (error.response?.status !== 429) {
          await this.sleep(retryAfterMs)
        }
      }
    }

    // The loop always returns or throws. This is only a defensive fallback.
    throw lastError
  }

  async _performAttempt({
    requestId,
    operation,
    url,
    attempt,
    retryIndex
  }) {
    const attemptId = ++this.stats.attempts
    const startedAt = this.now()

    try {
      const response = await this.transport.get(url, {
        headers: {
          '_token': this.token,
          'User-agent': this.userAgent
        },
        timeout: this.timeoutMs
      })

      this._log(
        'info',
        `attempt=${attemptId} request=${requestId} operation=${operation} ` +
        `try=${attempt} status=${response.status} ` +
        `durationMs=${Math.round(this.now() - startedAt)} ` +
        `headers=${this._formatRateHeaders(response.headers)}`
      )

      return response
    } catch (error) {
      const status = error.response?.status ?? 'network-error'
      const responseHeaders = error.response?.headers
      const calculatedRetryAfterMs = this._calculateRetryDelay(
        responseHeaders,
        retryIndex
      )

      error.gameApiRetryAfterMs = calculatedRetryAfterMs

      if (status === 429) {
        this.stats.rateLimited++
        this._pauseQueue(calculatedRetryAfterMs)
      }

      this._log(
        'warn',
        `attempt=${attemptId} request=${requestId} operation=${operation} ` +
        `try=${attempt} status=${status} ` +
        `durationMs=${Math.round(this.now() - startedAt)} ` +
        `headers=${this._formatRateHeaders(responseHeaders)}`
      )

      throw error
    }
  }

  _schedule(task, isRetry) {
    return new Promise((resolve, reject) => {
      const job = {task, resolve, reject}

      if (isRetry) {
        this.retryQueue.push(job)
      } else {
        this.normalQueue.push(job)
      }

      this._drain()
    })
  }

  _drain() {
    if (
      this.activeRequests >= this.maxConcurrency ||
      (this.retryQueue.length === 0 && this.normalQueue.length === 0)
    ) {
      return
    }

    const now = this.now()
    const allowedStartAt = Math.max(this.nextStartAt, this.cooldownUntil)

    if (allowedStartAt > now) {
      if (!this.drainTimer) {
        this.drainTimer = setTimeout(() => {
          this.drainTimer = null
          this._drain()
        }, Math.ceil(allowedStartAt - now))
      }

      return
    }

    if (this.drainTimer) {
      clearTimeout(this.drainTimer)
      this.drainTimer = null
    }

    const job = this.retryQueue.shift() ?? this.normalQueue.shift()
    this.activeRequests++
    this.nextStartAt = this.now() + this.minimumStartIntervalMs

    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        this.activeRequests--
        this._drain()
      })

    // Schedule the next permitted start without waiting for this request to
    // finish, up to the configured global concurrency limit.
    this._drain()
  }

  _pauseQueue(milliseconds) {
    this.cooldownUntil = Math.max(
      this.cooldownUntil,
      this.now() + milliseconds
    )

    // An existing timer may fire before the new cooldown ends. It will
    // re-evaluate cooldownUntil and schedule the correct remaining wait.
    this._drain()
  }

  _calculateRetryDelay(headers, retryIndex) {
    const retryAfterMs = this._parseRetryAfter(headers)
    const baseDelay = retryAfterMs ??
      this.fallbackRetryMs * (2 ** retryIndex)
    const jitter = this.retryJitterMs > 0
      ? Math.floor(this.random() * this.retryJitterMs)
      : 0

    return Math.max(0, Math.ceil(baseDelay + jitter))
  }

  _parseRetryAfter(headers) {
    const value = this._getHeader(headers, 'retry-after')

    if (value === undefined || value === null || value === '') {
      return null
    }

    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000
    }

    const date = Date.parse(value)
    if (!Number.isNaN(date)) {
      return Math.max(0, date - this.now())
    }

    return null
  }

  _getHeader(headers, name) {
    if (!headers) {
      return undefined
    }

    if (typeof headers.get === 'function') {
      return headers.get(name)
    }

    const lowerName = name.toLowerCase()
    const matchingKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === lowerName
    )

    return matchingKey ? headers[matchingKey] : undefined
  }

  _formatRateHeaders(headers) {
    const names = [
      'retry-after',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ]
    const selected = {}

    for (const name of names) {
      const value = this._getHeader(headers, name)
      if (value !== undefined && value !== null) {
        selected[name] = value
      }
    }

    return JSON.stringify(selected)
  }

  _isRetryable(error) {
    const status = error.response?.status
    if ([429, 502, 503, 504].includes(status)) {
      return true
    }

    if (error.response) {
      return false
    }

    return [
      'ECONNABORTED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ERR_NETWORK'
    ].includes(error.code)
  }

  _log(level, message) {
    if (!this.logger) {
      return
    }

    if (typeof this.logger === 'function') {
      this.logger(`[game-api] ${message}`)
      return
    }

    const logMethod = this.logger[level] ?? this.logger.log
    if (typeof logMethod === 'function') {
      logMethod.call(this.logger, `[game-api] ${message}`)
    }
  }
}

module.exports = GameApiClient
module.exports.TemporaryUpstreamError = TemporaryUpstreamError
