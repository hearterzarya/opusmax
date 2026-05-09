import { UsageLog } from '@prisma/client'

export type UsageLogWithKey = UsageLog & {
  apiKey: {
    id: string
    name: string
    keyPrefix: string
  }
}

// API Request/Response types
export interface AnthropicMessageRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>
  }>
  max_tokens?: number
  stream?: boolean
  system?: string
  temperature?: number
  top_p?: number
  top_k?: number
  metadata?: {
    user_id?: string
  }
}

export interface AnthropicCountTokensRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string | Array<{ type: string; text?: string }>
  }>
  system?: string
}

export interface AnthropicCountTokensResponse {
  input_tokens: number
  input_tokens_details?: {
    cached_tokens: number
  }
  mount_tokens?: number
}

export interface AnthropicModelsResponse {
  data: Array<{
    id: string
    display_name: string
    created_at: number
    api_version: string
    top_provider: {
      organization: string
      url: string
    }
    features: {
      mobile_friendly: boolean
      output_video: boolean
      tool_use_properties?: Record<string, unknown>
    }
  }>
}

// Dashboard metrics
export interface DashboardMetrics {
  totalApiKeys: number
  activeKeys: number
  totalRequests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgLatencyMs: number
  errors: number
  last24hRequests: number
  last7dRequests: number
  last30dRequests: number
}

// Health status
export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latencyMs: number | null
  uptime: number
  lastCheck: Date
}

// Admin stats
export interface AdminStats {
  totalKeys: number
  activeKeys: number
  pausedKeys: number
  expiredKeys: number
  revokedKeys: number
  totalAdmins: number
}

// API Key form data
export interface CreateApiKeyData {
  name: string
  rpmLimit?: number
  hourlyTokenBudget?: bigint
  expiresAt?: Date
}

// Usage log filters
export interface UsageLogFilters {
  apiKeyId?: string
  model?: string
  dateFrom?: Date
  dateTo?: Date
  statusCode?: number
  errorOnly?: boolean
}

// CSV Export
export interface UsageLogCSV {
  id: string
  apiKeyName: string
  apiKeyPrefix: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  latencyMs: number
  statusCode: number
  errorType: string | null
  timestamp: string
}