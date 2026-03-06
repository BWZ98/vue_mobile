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
 * @returns 统计数据数组
 */
export const getStatsApi = () => {
  return request<unknown, StatItem[]>({
    url: '/stats',
    method: 'get',
  })
}
