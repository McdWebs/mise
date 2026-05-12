import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

// Health check
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// TODO: payments — wire payment provider here in Phase 8

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`api running on http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
