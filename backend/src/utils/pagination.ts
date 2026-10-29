// Pagination utilities for consistent list endpoints
import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(200),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  paginated: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
})

export type PaginationParams = z.infer<typeof paginationSchema>

export function paginate(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  }
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  if (params.paginated) {
    return {
      data,
      meta: {
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(total / params.pageSize),
      },
    }
  }
  return data
}
