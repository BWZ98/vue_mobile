import request from '../utils/request'

/**
 * 统计数据项类型定义
 */
export interface StatItem {
  time: number
  date: string
  count: number
}

/**
 * 获取统计数据
 * @param range 时间范围筛选 (6h, 12h, 24h)
 * @returns 统计数据数组
 */
export const getStatsApi = (range: string = '24h') => {
  return request<unknown, StatItem[]>({
    url: '/stats',
    method: 'get',
    params: { range },
  })
}
