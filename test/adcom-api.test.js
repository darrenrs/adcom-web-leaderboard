const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const GameApiClient = require('../adcom-api')
const {TemporaryUpstreamError} = GameApiClient

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

const quietLogger = {
  info() {},
  warn() {}
}

const response = (status = 200, headers = {}) => ({
  status,
  headers,
  data: {}
})

const responseError = (status, headers = {}) => {
  const error = new Error(`HTTP ${status}`)
  error.response = {status, headers}
  return error
}

const createClient = (transport, options = {}) => new GameApiClient({
  baseLeaderboard: 'https://leaderboard.example/project/adcom',
  basePlayermeta: 'https://playermeta.example/project/adcom',
  token: 'test-token',
  transport,
  logger: quietLogger,
  maxConcurrency: 4,
  requestsPerSecond: 1_000,
  timeoutMs: 10_000,
  maxRetries: 2,
  fallbackRetryMs: 20,
  retryJitterMs: 0,
  ...options
})

test('constructs each endpoint centrally and applies timeout and headers', async () => {
  const calls = []
  const transport = {
    async get(url, config) {
      calls.push({url, config})
      return response()
    }
  }
  const client = createClient(transport, {timeoutMs: 321})

  await client.listLeaderboards()
  await client.getPlayerMetadata('PLAYER')
  await client.getPlayerEventRegistration('PLAYER', 'EVENT')
  await client.getPlayerLeaderboard('PLAYER', 'EVENT', {
    adjacentCount: 7,
    topCount: 42
  })

  assert.deepEqual(calls.map((call) => call.url), [
    'https://leaderboard.example/project/adcom/leaderboards',
    'https://playermeta.example/project/adcom/players/PLAYER',
    'https://leaderboard.example/project/adcom/leaderboards/EVENT/players/PLAYER',
    'https://leaderboard.example/project/adcom/leaderboards/EVENT/players/PLAYER/results?offset=7&resolvePlayers=true&topCount=42'
  ])

  for (const call of calls) {
    assert.equal(call.config.timeout, 321)
    assert.equal(call.config.headers._token, 'test-token')
    assert.equal(call.config.headers['User-agent'], 'adcom-web-leaderboard')
  }
})

test('bounds global concurrency and spaces request starts', async () => {
  const starts = []
  let active = 0
  let peakActive = 0

  const transport = {
    async get() {
      starts.push(Date.now())
      active++
      peakActive = Math.max(peakActive, active)
      await wait(90)
      active--
      return response()
    }
  }

  const client = createClient(transport, {
    maxConcurrency: 2,
    requestsPerSecond: 25
  })

  await Promise.all([
    client.listLeaderboards(),
    client.listLeaderboards(),
    client.listLeaderboards(),
    client.listLeaderboards(),
    client.listLeaderboards()
  ])

  assert.ok(peakActive <= 2, `peak concurrency was ${peakActive}`)

  for (let index = 1; index < starts.length; index++) {
    const separation = starts[index] - starts[index - 1]
    assert.ok(separation >= 30, `request starts were only ${separation}ms apart`)
  }
})

test('pauses the shared queue and retries only the failed request after a 429', async () => {
  const starts = []
  let attempts = 0

  const transport = {
    async get() {
      starts.push(Date.now())
      attempts++

      if (attempts === 1) {
        throw responseError(429)
      }

      return response()
    }
  }

  const client = createClient(transport, {
    maxConcurrency: 1,
    fallbackRetryMs: 50
  })

  await client.listLeaderboards()

  assert.equal(attempts, 2)
  assert.ok(starts[1] - starts[0] >= 45)
  assert.deepEqual(client.getStats(), {
    requests: 1,
    attempts: 2,
    succeeded: 1,
    failed: 0,
    retries: 1,
    rateLimited: 1,
    active: 0,
    queued: 0,
    cooldownRemainingMs: 0
  })
})

test('honors Retry-After instead of the fallback delay', async () => {
  const starts = []
  let attempts = 0

  const transport = {
    async get() {
      starts.push(Date.now())
      attempts++

      if (attempts === 1) {
        throw responseError(429, {'Retry-After': '0.04'})
      }

      return response()
    }
  }

  const client = createClient(transport, {
    fallbackRetryMs: 500
  })

  await client.listLeaderboards()

  const elapsed = starts[1] - starts[0]
  assert.ok(elapsed >= 35, `retry began after only ${elapsed}ms`)
  assert.ok(elapsed < 250, `fallback delay was used instead: ${elapsed}ms`)
})

test('understands an HTTP-date Retry-After value', () => {
  const now = Date.parse('2026-08-17T12:00:00.000Z')
  const client = createClient({get() {}}, {now: () => now})

  assert.equal(
    client._parseRetryAfter({
      'retry-after': 'Mon, 17 Aug 2026 12:00:03 GMT'
    }),
    3_000
  )
})

test('stops after the configured number of retries', async () => {
  let attempts = 0
  const transport = {
    async get() {
      attempts++
      throw responseError(429)
    }
  }

  const client = createClient(transport, {
    maxRetries: 2,
    fallbackRetryMs: 5
  })

  await assert.rejects(
    client.listLeaderboards(),
    (error) => {
      assert.ok(error instanceof TemporaryUpstreamError)
      assert.equal(error.code, 'GAME_API_TEMPORARY_FAILURE')
      assert.equal(error.status, 429)
      return true
    }
  )

  assert.equal(attempts, 3)
  assert.equal(client.getStats().retries, 2)
  assert.equal(client.getStats().failed, 1)
})

test('applies the timeout to a real HTTP attempt', async () => {
  const server = http.createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, {'content-type': 'application/json'})
      response.end('{}')
    }, 100)
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const client = new GameApiClient({
    baseLeaderboard: `http://127.0.0.1:${address.port}`,
    basePlayermeta: `http://127.0.0.1:${address.port}`,
    token: 'test-token',
    logger: quietLogger,
    requestsPerSecond: 1_000,
    timeoutMs: 20,
    maxRetries: 0,
    retryJitterMs: 0
  })

  try {
    await assert.rejects(
      client.listLeaderboards(),
      (error) => {
        assert.ok(error instanceof TemporaryUpstreamError)
        assert.equal(error.cause.code, 'ECONNABORTED')
        return true
      }
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
