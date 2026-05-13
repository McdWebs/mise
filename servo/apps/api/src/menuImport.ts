import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'

interface ImportBody {
  restaurantId: string
  mediaType: string
  fileBase64: string
}

const ExtractedMenuSchema = z.object({
  categories: z.array(z.object({
    name: z.string().describe('Section/category heading exactly as shown'),
    items: z.array(z.object({
      name: z.string(),
      description: z.string().optional().describe('One-line description if present'),
      price: z.number().optional().describe('Price as decimal, no currency symbol'),
      tags: z.array(z.enum(['Vegetarian', 'Gluten-free', 'Spicy'])).default([]),
    })),
  })),
})

export type ExtractedMenu = z.infer<typeof ExtractedMenuSchema>

export async function registerMenuImport(app: FastifyInstance) {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  app.post<{ Body: ImportBody }>(
    '/api/menu/import',
    { bodyLimit: 15 * 1024 * 1024 },
    async (request, reply) => {
      const { restaurantId, mediaType, fileBase64 } = request.body

      if (!restaurantId || !mediaType || !fileBase64) {
        return reply.status(400).send({ error: 'restaurantId, mediaType and fileBase64 are required' })
      }

      const isImage = mediaType.startsWith('image/')
      const isPDF = mediaType === 'application/pdf'

      if (!isImage && !isPDF) {
        return reply.status(400).send({ error: 'Only images (JPEG, PNG, WebP) and PDFs are supported' })
      }

      const fileContent = isImage
        ? { type: 'image' as const, image: fileBase64, mediaType }
        : { type: 'file' as const, data: fileBase64, mediaType: 'application/pdf' as const }

      try {
        const { object } = await generateObject({
          model: anthropic('claude-haiku-4-5-20251001'),
          schema: ExtractedMenuSchema,
          messages: [{
            role: 'user',
            content: [
              fileContent,
              {
                type: 'text',
                text: `Extract every menu item from this ${isPDF ? 'PDF' : 'image'} into structured JSON.

Rules:
- Group items by their section/category headings exactly as shown in the menu
- name: item name as written (required)
- description: one sentence description only if present, otherwise omit
- price: decimal number only, no currency symbols (e.g. 12.50 not "$12.50"), omit if not shown
- tags: only include if clearly indicated on the menu (Vegetarian, Gluten-free, Spicy)
- Preserve the order items appear in each section`,
              },
            ],
          }],
        })

        return reply.send(object)
      } catch (err) {
        app.log.error({ err }, 'menu import failed')
        return reply.status(500).send({ error: 'Failed to extract menu — try a clearer photo or a different file' })
      }
    }
  )
}
