<script setup lang="ts">
import dayjs from 'dayjs'
import {
  getAllMonitorHistoryTreadBriefStream,
  getResourceMonitorInfoPackets_Unit,
  getResourceMonitorInfoPackets_Person,
  getResourceMonitorHistoryTread_Person,
  getResourceMonitorHistoryTread_Unit,
} from '@fpweb/shared/apis/methods/monitor'
import { fillMonitorEchartAxisData } from '@fpweb/shared/utils'
import { useIsUnit } from '@fpweb/shared/composables/useIsUnit'
import {
  WIFI_SIGNAL_MONITOR_TYPE,
  SIGNAL_MONITOR_TYPE,
  ELECTRICAL_TEMPERATURE_CODE,
  ACTIVE_POWER_MONITOR_TYPE,
  MONITOR_ALIAS_KEY_COLOR_MAP,
  MONITOR_CHAR_COLOR_LIST,
} from '@fpweb/shared/constants'
import {
  TREND_DATA_NEAREST_24_HOUR_TYPE,
  TREND_DATA_NEAREST_6_HOUR_TYPE,
  TREND_DATA_NEAREST_12_HOUR_TYPE,
  TREND_DATA_NEAREST_30_DAY_TYPE,
  TREND_DATA_NEAREST_7_DAY_TYPE,
} from '@fpweb/deviceModule/constants'
import { useDictStore } from '@/store/modules/global'
import LineChart from './LineChart.vue'
import SimpleLineChart from './SimpleLineChart.vue'
import HistoryRecord from './HistoryRecord.vue'
import DateRangePicker from './DateRangePicker.vue'
import i18n from '@/i18n'

const props = defineProps<{
  activeTab: string
  currentMonitorData: any
  routeQuery: any
  deviceModel?: string
  tabOffset?: string | number
}>()

interface MonitorTrendItem {
  mp?: string | number
  [key: string]: unknown
}

interface MonitorTrendData {
  mts?: MonitorTrendItem[]
  un?: string
  [key: string]: unknown
}

interface LineChartExpose {
  applyZoom?: (displayType: number | string) => void
  applyZoomByTimestamp?: (startTime: number, endTime: number) => void
}

const emit = defineEmits<{
  (e: 'update:trendLoading', value: boolean): void
  (e: 'refresh'): void
  (e: 'update:refreshLoading', value: boolean): void
}>()
const { t } = i18n.global
const { allDict } = useDictStore()
// const { isPerson } = useIsUnit()

const formateDateStr = 'YYYY-MM-DD HH:mm:ss'
const DATA_TREND_TAB_TYPE = 1
const DATA_DETAIL_TAB_TYPE = 2

const activeDataTab = ref(1)
const activeDateTab = ref(TREND_DATA_NEAREST_6_HOUR_TYPE)
const trendLoading = ref(false)
// 时间筛选项配置
const dateTabOptions = [
  { label: '近6小时', value: TREND_DATA_NEAREST_6_HOUR_TYPE },
  { label: '近24小时', value: TREND_DATA_NEAREST_24_HOUR_TYPE },
  { label: '近7天', value: TREND_DATA_NEAREST_7_DAY_TYPE },
]

// 组件内部维护的时间查询参数
const selectSearchParams = ref({
  startDate: getRangeDateArrByTimeType(TREND_DATA_NEAREST_24_HOUR_TYPE)[0],
  endDate: getRangeDateArrByTimeType(TREND_DATA_NEAREST_24_HOUR_TYPE)[1],
})

// 数据详情模式下的独立时间筛选参数（不与趋势图模式共享）
const detailSearchParams = ref({
  startDate: getRangeDateArrByTimeType(TREND_DATA_NEAREST_24_HOUR_TYPE)[0],
  endDate: getRangeDateArrByTimeType(TREND_DATA_NEAREST_24_HOUR_TYPE)[1],
})

// 简化的图表数据 - 直接使用 mock 数据格式
const mockChartData = ref<MonitorTrendData>({ mts: [], un: '' })

// 时间范围 - 用于图表 x 轴完整展示
const timeRange = ref<{ startTime: number, endTime: number } | null>(null)

// 根据时间tab获取对应的时间范围值
function getRangeDateArrByTimeType(timeType: number) {
  // const now = dayjs().startOf('minute').add(1, 'minute').format(formateDateStr)
  const now = dayjs().startOf('minute').format(formateDateStr)

  const timeTypeConfig: Record<number, { subtract: number, subtractUnit: 'hour' | 'day', startOf: 'minute' | 'day', endOf?: 'day' }> = {
    [TREND_DATA_NEAREST_6_HOUR_TYPE]: { subtract: 6, subtractUnit: 'hour', startOf: 'minute' },
    [TREND_DATA_NEAREST_12_HOUR_TYPE]: { subtract: 12, subtractUnit: 'hour', startOf: 'minute' },
    [TREND_DATA_NEAREST_24_HOUR_TYPE]: { subtract: 1, subtractUnit: 'day', startOf: 'minute' },
    [TREND_DATA_NEAREST_7_DAY_TYPE]: { subtract: 7, subtractUnit: 'day', startOf: 'day', endOf: 'day' },
    [TREND_DATA_NEAREST_30_DAY_TYPE]: { subtract: 30, subtractUnit: 'day', startOf: 'minute' },
  }

  const config = timeTypeConfig[+timeType]
  if (!config) {
    return []
  }
  const startDate = dayjs().subtract(config.subtract, config.subtractUnit).startOf(config.startOf).format(formateDateStr)
  const endDate = config.endOf ? dayjs().endOf(config.endOf).format(formateDateStr) : now

  return [startDate, endDate]
}

// 30天时间限制
const maxLimitScopes = getRangeDateArrByTimeType(TREND_DATA_NEAREST_30_DAY_TYPE)

const historyRecordRef = ref<HTMLElement | null | any>(null)
const lineChartRef = ref<LineChartExpose[]>([])
const calendarRef = ref<HTMLElement | null | any>(null)

const chartContainerId = ref('chart-container')

function setcurrentSelectSearchParams() {
  const dateObj = getRangeDateArrByTimeType(activeDateTab.value)
  if (dateObj && Array.isArray(dateObj)) {
    selectSearchParams.value.startDate = dateObj[0]
    selectSearchParams.value.endDate = dateObj[1]
  }
}
// 虚拟支路或者设备作为主回路
const isVirtual = computed(() => {
  return +props.routeQuery.virtualChannelNo === -1 || (+props.routeQuery.installMode === 1 && !props.routeQuery.channelId)
})
// 虚拟支路还需特殊处理, 电流、电压、电气温度、剩余电流
const isVirtualMonitors = computed(() => {
  return isVirtual.value && [254024, 400010, 400009, 400005].includes(+props.currentMonitorData?.monitorType)
})

const shouldSplitSeriesCharts = computed(() => props.routeQuery?.splitSeries === '1')

const chartRenderList = computed(() => {
  const rawData = mockChartData.value
  const mts = Array.isArray(rawData?.mts) ? rawData.mts : []
  if (!mts.length) {
    return []
  }

  if (!shouldSplitSeriesCharts.value) {
    return [{
      key: 'single',
      data: rawData,
    }]
  }

  const groupedData = new Map<string | number, MonitorTrendItem[]>()
  mts.forEach((item) => {
    const groupKey = item.mp ?? 'single'
    const group = groupedData.get(groupKey) || []
    group.push(item)
    groupedData.set(groupKey, group)
  })

  return Array.from(groupedData.entries()).map(([groupKey, group]) => ({
    key: String(groupKey),
    data: {
      ...rawData,
      mts: group,
    },
  }))
})

function setLineChartRef(el: unknown, index: number) {
  if (el) {
    lineChartRef.value[index] = el as LineChartExpose
  }
}

function getLineChartInstances() {
  return lineChartRef.value.filter(Boolean)
}

function applyZoomToCharts(displayType: number | string) {
  getLineChartInstances().forEach((chart) => {
    chart?.applyZoom?.(displayType)
  })
}

function applyZoomByTimestampToCharts(startTime: number, endTime: number) {
  getLineChartInstances().forEach((chart) => {
    chart?.applyZoomByTimestamp?.(startTime, endTime)
  })
}

onBeforeUpdate(() => {
  lineChartRef.value = []
})

// HistoryRecord组件会调用
function getParams() {
  const { deviceId, system, channelId, deviceModel } = props.routeQuery
  // 根据当前 tab 类型选择使用不同的时间参数
  let { startDate, endDate } = activeDataTab.value === DATA_DETAIL_TAB_TYPE
    ? detailSearchParams.value
    : selectSearchParams.value
  if (activeDataTab.value === DATA_DETAIL_TAB_TYPE) {
    startDate = dayjs(startDate).startOf('minute').format('YYYY-MM-DD HH:mm:00')
    endDate = dayjs(endDate).endOf('minute').format('YYYY-MM-DD HH:mm:00')
  }
  const channelIdArr = (props.currentMonitorData.currents || []).map((item: any) => item.channelId).filter((item: any) => !!item)
  let queryChannelId = []
  if (channelIdArr.length) {
    queryChannelId = Array.from(new Set(channelIdArr))
  } else if (channelId) {
    queryChannelId = [channelId]
  }
  return {

    deviceId,
    channelId: queryChannelId.join(','),
    endTime: endDate,
    startTime: startDate,
    monitorType: props.activeTab,
    system: system || '',
    deviceModel: deviceModel || '',
    displayType: activeDateTab.value,
  }
}

function handleDetailDateConfirm([newStartDate, newEndDate]: [string, string]) {
  // 清除趋势图模式的选中状态
  // activeDateTab.value = ''
  // selectedDate.value = null
  // 刷新历史记录列表
  detailSearchParams.value.startDate = newStartDate
  detailSearchParams.value.endDate = newEndDate
  historyRecordRef.value?.refreshList()
}

// 根据当前值的分路数量，控制并发切片大小
const sliceDaysMap = {
  4: 1,
  3: 1,
  2: 2,
  1: 3,
}

async function getMonitorItemTrend() {
  try {
    trendLoading.value = true
    // is642 时使用子组件的时间参数
    // 对应图像来说, 时间筛选不重新进行请求
    const params = {
      ...getParams(),
      startTime: getRangeDateArrByTimeType(TREND_DATA_NEAREST_30_DAY_TYPE)[0],
      endTime: getRangeDateArrByTimeType(TREND_DATA_NEAREST_30_DAY_TYPE)[1],
    }
    // 如果虚拟支路，需要给后端增加标识
    if (isVirtualMonitors) {
      params.virtualChannelNo = -1
    }
    // 保存请求的时间范围，用于图表 x 轴完整展示
    const startTimeStr = params.startTime
    const endTimeStr = params.endTime
    timeRange.value = {
      startTime: dayjs(startTimeStr).valueOf(),
      endTime: dayjs(endTimeStr).valueOf(),
    }
    // 根据当前值的分路数量，控制并发切片大小
    const currentsLength = props.currentMonitorData?.currents?.length || 4
    const sliceDays = sliceDaysMap[currentsLength]

    const res = await fetchDataBySlices(getAllMonitorHistoryTreadBriefStream, params, {
      startDate: startTimeStr,
      endDate: endTimeStr,
      sliceDays,
    })
    mockChartData.value = handleResData(res)
    trendLoading.value = false
  } catch (error) {
    trendLoading.value = false
    console.log(error)
  } finally {
    emit('update:refreshLoading', false)
  }
}

// 处理响应数据
function handleResData(data: MonitorTrendData) {
  return data
}

async function fetchDataBySlices(requestApi, baseParams, dateParams?: { startDate?: string, endDate?: string, sliceDays?: number }) {
  const { startDate, endDate, sliceDays = 2 } = dateParams || {}

  // 如果参数对象不全，直接进行单次请求
  if (!startDate || !endDate) {
    const result = await requestApi({
      ...baseParams,
    })
    return result?.data || []
  }

  // 计算日期差值（天数）
  const daysDiff = dayjs(endDate).diff(dayjs(startDate), 'day')

  // 如果日期差值小于分片天数，则不进行分片，直接请求一次
  if (daysDiff < sliceDays) {
    const result = await requestApi({
      ...baseParams,
      startTime: startDate,
      endTime: endDate,
    })
    return result?.data || {}
  }

  // 需要分片的情况 - 从最新日期开始往前遍历，直接得到最新的时间在数组最前面
  const sliceRequests: { startTime: string, endTime: string, index: number }[] = []

  // 从 endDate 开始往前推，每次取 sliceDays 天
  let currentEndDate = endDate
  let index = 0
  while (dayjs(currentEndDate).isAfter(dayjs(startDate))) {
    // 这一组的结束时间
    const sliceEndDate = dayjs(currentEndDate).endOf('day').format(formateDateStr)
    // 这一组的开始时间：结束时间往前 sliceDays-1 天
    const sliceStartDate = dayjs(currentEndDate).subtract(sliceDays - 1, 'day').startOf('day').format(formateDateStr)

    // 确保开始时间不超过原始 startDate
    const finalStartDate = dayjs(sliceStartDate).isBefore(dayjs(startDate)) ? startDate : sliceStartDate
    // 确保结束时间不超过原始 endDate
    const finalEndDate = dayjs(sliceEndDate).isAfter(dayjs(endDate)) ? endDate : sliceEndDate

    sliceRequests.push({
      startTime: finalStartDate,
      endTime: finalEndDate,
      index,
    })

    // 移动到下一组：开始时间往前一天作为新的结束边界
    currentEndDate = dayjs(finalStartDate).subtract(1, 'day').format(formateDateStr)
    index++
  }
  // 处理最后一组
  const lastSlicestartTime = sliceRequests[sliceRequests.length - 1].startTime
  if (dayjs(startDate).isBefore(lastSlicestartTime)) {
    sliceRequests.push({
      startTime: startDate,
      endTime: lastSlicestartTime,
      index,
    })
  }

  // 并发请求所有分片数据
  const allDataPromises = sliceRequests.map((timeRange) => {
    return requestApi({
      ...baseParams,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    }).then((result: any) => ({
      index: timeRange.index,
      data: result || [],
    }))
  })

  // 等待所有请求完成
  const allResults = await Promise.all(allDataPromises)

  // 按索引位置排序并组装数据
  allResults.sort((a, b) => a.index - b.index)

  // 特殊处理：当 monitorType 为 400018 时，可能出现有的分片单位是 kw，有的分片单位是 w 的情况
  // 只要有一个分片的单位是 kw，就把分片单位为 w 的数据全部除以 1000，单位也使用 kw
  const needPowerUnitConvert = +baseParams.monitorType === 400018 && allResults.some(r => r?.data?.un?.toLowerCase() === 'kw')

  // 合并所有数据
  const mergedDataMts: any[] = []
  let un = ''

  allResults.forEach((result) => {
    const { mts, un: resultUnit } = result?.data || {}
    const unit = resultUnit?.toLowerCase()

    if (needPowerUnitConvert && unit === 'w') {
      // 单位为 w 时转换为 kw
      mergedDataMts.push(...mts.map((item: any) => ({
        ...item,
        md: String(Number(item.md) / 1000),
      })))
    } else {
      mergedDataMts.push(...(mts || []))
    }

    // 统一取单位（优先取 kw）
    if (!un) {
      if (resultUnit && resultUnit !== 'null') {
        un = needPowerUnitConvert ? 'kW' : resultUnit
      }
    }
  })

  return {
    mts: mergedDataMts,
    un,
  }
}

// 日历相关
const showCalendar = ref(false)
const selectedDate = ref<Date | null>(null)

const calendarMinDate = computed(() => {
  const minTime = maxLimitScopes[0]
  return dayjs(minTime).toDate()
})
const calendarMaxDate = computed(() => {
  const maxTime = maxLimitScopes[1]
  return dayjs(maxTime).toDate()
})

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
  if (showCalendar.value) {
    calendarRef.value?.reset(selectedDate.value)
  }
}

function handleDateSelect(date: Date) {
  selectedDate.value = date
  showCalendar.value = false
  activeDateTab.value = '' // 清除 tab 激活态
  // 通知子组件缩放到选中日期的 00:00 ~ 23:59:59
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  if (activeDataTab.value === DATA_TREND_TAB_TYPE) {
    applyZoomByTimestampToCharts(start.getTime(), end.getTime())
  }
}

function dateTabChange(val) {
  selectedDate.value = null // 清除日历选中日期
  activeDateTab.value = val
  nextTick(() => {
    setcurrentSelectSearchParams()
    activeDateTabChange()
  })
}

// 时间筛选变化
function activeDateTabChange() {
  nextTick(() => {
    // 切换时间筛选项时，只更新图表显示范围，不重新请求数据
    if (activeDataTab.value === DATA_TREND_TAB_TYPE) {
      applyZoomToCharts(activeDateTab.value)
    } else if (activeDataTab.value === DATA_DETAIL_TAB_TYPE) {
      // 数据详情模式下刷新历史记录列表
      historyRecordRef.value?.refreshList()
    }
  })
}

// 趋势/详情变化
function activeDataTabChange() {
  nextTick(() => {
    // 重新请求数据画图
    if (activeDataTab.value === DATA_TREND_TAB_TYPE) {
      // 选中项恢复初始状态
      selectedDate.value = null // 清除日历选中日期
      activeDateTab.value = TREND_DATA_NEAREST_6_HOUR_TYPE
      getMonitorItemTrend()
    } else if (activeDataTab.value === DATA_DETAIL_TAB_TYPE) {
      // 数据详情模式下刷新历史记录列表
      historyRecordRef.value?.refreshList()
    }
  })
}

// 图表缩放或拖动时，取消筛选选中状态
function handleChartZoomChange() {
  activeDateTab.value = ''
  selectedDate.value = null
}

// 暴露方法供父组件调用
defineExpose({
  getMonitorItemTrend,
  refreshElectricityCompnent: activeDataTabChange,
})
</script>

<template>
  <div class="trend-history-container">
    <!-- 趋势图 & 历史记录 -->
    <div
      class="bg-white pt-12 px-16 bottom-info-card"
      :class="{
        'pb-28': activeDataTab === DATA_TREND_TAB_TYPE
      }"
    >
      <!-- 类型筛选 -->
      <VanTabs
        v-model:active="activeDataTab"
        type="card"
        class="monitor-data-tab"
        sticky
        :offset-top="tabOffset || 88"
        @change="activeDataTabChange"
      >
        <VanTab
          :title="t('deviceModule.countTrend')"
          :name="DATA_TREND_TAB_TYPE"
        >
          <!-- 时间筛选 -->
          <div class="date-filter-row">
            <div class="filter-tabs">
              <button
                v-for="item in dateTabOptions"
                :key="item.value"
                class="tab-btn"
                :class="{ active: activeDateTab === item.value }"
                @click="dateTabChange(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
            <button class="calendar-btn" :class="{ active: selectedDate }" @click="toggleCalendar">
              <VanIcon
                class="!text-20"
                name="rili"
                class-prefix="iconfont icon"
              />
            </button>
          </div>
          <!-- 趋势图 -->
          <div :id="chartContainerId" class="trend-box">
            <div
              v-if="chartRenderList.length && !trendLoading"
              class="trend mt-24 box-sizing pr--2 flex-col flex-center gap-16"
            >
              <!-- <div class="text-left black04 w-full text-12">
                {{ t('deviceModule.statisticPeriod') }}<span>{{ formateDisplayDateRange }}</span>
              </div> -->
              <SimpleLineChart
                v-for="(chartItem, index) in chartRenderList"
                :key="chartItem.key"
                :ref="el => setLineChartRef(el, index)"
                :display-type="activeDateTab"
                :data="chartItem.data"
                :current-monitor-data="currentMonitorData"
                :route-query="routeQuery"
                :time-range="timeRange"
                :is-virtual-monitors="isVirtualMonitors"
                :all-dict="allDict"
                @zoom-change="handleChartZoomChange"
              />
            </div>
            <FEmpty v-else-if="!trendLoading" class="empty-trend-box" size="sm" />
            <div v-if="trendLoading" class="h-340 flex-center flex-col">
              <VanLoading
                size="24px"
                vertical
              >
                {{ t('common.action.loading') }}
              </VanLoading>
            </div>
          </div>
        </VanTab>
        <VanTab
          :title="t('deviceModule.countDetail')"
          :name="DATA_DETAIL_TAB_TYPE"
        >
          <!-- 时间筛选 - 使用 DateRangePicker 组件 -->

          <div class="date-picker-row">
            <DateRangePicker
              :start-date="detailSearchParams.startDate"
              :end-date="detailSearchParams.endDate"
              type="date-time"
              :initial-mode="false"
              :max-limit-scopes="maxLimitScopes"
              @confirm-change="handleDetailDateConfirm"
            />
          </div>
          <!-- 数据详情 -->
          <div class="data-box">
            <div class="record-inner">
              <HistoryRecord
                ref="historyRecordRef"
                :device-type="routeQuery.deviceType"
                :get-param-fn="getParams"
                :monitor-type="currentMonitorData.monitorType"
                :current-monitor-list="currentMonitorData.currents"
                @list-loading-finish="() => emit('update:refreshLoading', false)"
              />
            </div>
          </div>
        </VanTab>
      </VanTabs>

      <!-- 日历组件 - 只在趋势图模式下显示 -->
      <VanCalendar
        v-if="activeDataTab === DATA_TREND_TAB_TYPE"
        ref="calendarRef"
        v-model:show="showCalendar"
        switch-mode="month"
        :min-date="calendarMinDate"
        :max-date="calendarMaxDate"
        :default-date="null"
        position="bottom"
        :round="true"
        :show-confirm="false"
        :safe-area-inset-bottom="false"
        @select="handleDateSelect"
      />
    </div>
  </div>
</template>
