<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { Calendar as VanCalendar } from 'vant'
import 'vant/es/calendar/style'
import { getStatsApi, type StatItem } from '../api/stats'

const router = useRouter()
const route = useRoute()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const splitChartRefs = ref<HTMLElement[]>([])
const splitChartInstances = shallowRef<echarts.ECharts[]>([])
const loading = ref(false)

const MIN_SPAN = 3600 * 1000
const MAX_SPAN = 24 * 3600 * 1000

type SplitChartItem = {
  id: number
  name: string
  color: string
  data: number[][]
  maxCount: number
}

type LineChartSeries = {
  name: string
  type: 'line'
  symbol: 'circle'
  symbolSize: number
  showSymbol: boolean
  smooth: boolean
  emphasis: { disabled: boolean }
  animation: boolean
  itemStyle: {
    borderColor: string
    borderWidth: number
  }
  lineStyle: {
    color: string
    width: number
  }
  data: number[][]
}

type ChartRenderModel = {
  isMultiSeries: boolean
  globalMaxCount: number
  legendData: string[]
  seriesList: LineChartSeries[]
}

const axisLayout = ref({ tickY1: 0, tickY2: 0, labelY: 0 })
const axisLabels = ref({
  left: { x: -100, text: '' },
  mid: { x: -100, text: '' },
  right: { x: -100, text: '' },
})
const shouldRenderSplitSeriesCharts = computed(() => route.query.splitSeries == 'false')
const isSplitSeriesMode = ref(false)
const splitChartItems = ref<SplitChartItem[]>([])

// 当前选中的时间范围 tab
const activeTab = ref('24h')
const tabs = [
  { label: '近6小时', value: '6h' },
  { label: '近12小时', value: '12h' },
  { label: '近24小时', value: '24h' },
]

// tab value 对应的小时数
const rangeHoursMap: Record<string, number> = { '6h': 6, '12h': 12, '24h': 24 }

let globalUpdateLabels: (() => void) | null = null
let globalSyncZoomState: (() => void) | null = null

const goBack = () => {
  router.push('/')
}

const setSplitChartRef = (el: unknown, index: number) => {
  if (el instanceof HTMLElement) {
    splitChartRefs.value[index] = el
  }
}

const disposeSplitCharts = () => {
  splitChartInstances.value.forEach(instance => instance.dispose())
  splitChartInstances.value = []
  splitChartRefs.value = []
}

const getActiveChartInstances = () => {
  if (isSplitSeriesMode.value) return splitChartInstances.value
  return chartInstance.value ? [chartInstance.value] : []
}

const setZoomForActiveCharts = (startValue: number, endValue: number) => {
  const instances = getActiveChartInstances()
  if (instances.length === 0) return false

  instances.forEach(instance => {
    instance.setOption({
      dataZoom: [{
        startValue,
        endValue,
      }],
    })
  })

  if (!isSplitSeriesMode.value) {
    globalSyncZoomState?.()
    setTimeout(() => globalUpdateLabels?.(), 0)
  }

  return true
}

// 根据当前 tab 计算 dataZoom 的 startValue（绝对时间戳）
const getZoomStartValue = () => {
  const hours = rangeHoursMap[activeTab.value] ?? 24
  return Date.now() - hours * 3600 * 1000
}

const handleTabChange = (val: string) => {
  if (activeTab.value === val) return
  activeTab.value = val
  selectedDate.value = null
  applyZoom()
}

// 日历相关
const showCalendar = ref(false)
const selectedDate = ref<Date | null>(null)

const calendarMinDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  d.setHours(0, 0, 0, 0)
  return d
})
const calendarMaxDate = computed(() => new Date())

const toggleCalendar = () => {
  showCalendar.value = !showCalendar.value
}

const handleDateSelect = (date: Date) => {
  selectedDate.value = date
  showCalendar.value = false
  activeTab.value = '' // 清除 tab 激活态
  // 缩放到选中日期的 00:00 ~ 23:59:59
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  setZoomForActiveCharts(start.getTime(), end.getTime())
}

// 仅调整可视区域，不重新请求数据
const applyZoom = () => {
  setZoomForActiveCharts(getZoomStartValue(), Date.now())
}

const createLineSeries = (name: string, color: string, data: number[][]): LineChartSeries => ({
  name,
  type: 'line',
  symbol: 'circle',
  symbolSize: 6,
  showSymbol: false,
  smooth: false,
  emphasis: { disabled: true },
  animation: false,
  itemStyle: {
    borderColor: '#fff',
    borderWidth: 1,
  },
  lineStyle: {
    color,
    width: 2,
  },
  data,
})

const buildChartRenderModel = (rawData: StatItem[]): ChartRenderModel => {
  const globalMaxCount = rawData.reduce((max, item) => Math.max(max, item.count), 0)
  const isMultiSeries = rawData.length > 0 && typeof rawData[0]?.person !== 'undefined'
  const legendData: string[] = []
  const seriesList: LineChartSeries[] = []

  if (!isMultiSeries) {
    const singleData = rawData.map((item) => [item.time, item.count])
    seriesList.push(createLineSeries('完成数', '#3b82f6', singleData))

    return { isMultiSeries, globalMaxCount, legendData, seriesList }
  }

  const groupedData = new Map<number, number[][]>()

  rawData.forEach((item) => {
    const personId = item.person
    if (!groupedData.has(personId)) groupedData.set(personId, [])
    groupedData.get(personId)!.push([item.time, item.count])
  })

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  Array.from(groupedData.keys())
    .sort((a, b) => a - b)
    .forEach((personId, index) => {
      const name = `系列${personId}`
      const color = colors[index % colors.length] ?? '#3b82f6'
      legendData.push(name)
      seriesList.push(createLineSeries(name, color, groupedData.get(personId)!))
    })

  return { isMultiSeries, globalMaxCount, legendData, seriesList }
}

const resetSingleChartOverlays = () => {
  globalUpdateLabels = null
  globalSyncZoomState = null
  axisLabels.value = {
    left: { x: -100, text: '' },
    mid: { x: -100, text: '' },
    right: { x: -100, text: '' },
  }
}

const toSplitChartItem = (series: LineChartSeries, index: number): SplitChartItem => ({
  id: index,
  name: series.name,
  color: series.lineStyle.color,
  data: series.data,
  maxCount: Math.max(...series.data.map(item => item[1] ?? 0), 1),
})

const createSplitChartOption = (item: SplitChartItem): echarts.EChartsOption => ({
  animation: false,
  legend: {
    data: [item.name],
    top: 6,
    right: '5%',
    icon: 'roundRect',
    itemWidth: 14,
    itemHeight: 8,
    textStyle: {
      color: item.color,
      fontSize: 12,
    },
  },
  grid: {
    top: 46,
    left: '5%',
    right: '5%',
    bottom: '12%',
    containLabel: true,
  },
  tooltip: {
    trigger: 'axis',
    transitionDuration: 0,
    axisPointer: {
      type: 'line',
      lineStyle: {
        color: item.color,
        type: 'dashed',
      },
      label: {
        show: false,
      },
    },
  },
  xAxis: {
    type: 'time',
    splitNumber: 2,
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.4)',
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: 'rgba(0, 0, 0, 0.4)',
      hideOverlap: true,
      fontSize: 12,
    },
    splitLine: {
      show: false,
    },
  },
  yAxis: {
    type: 'value',
    max: Math.floor(item.maxCount * 1.5),
    axisLabel: {
      color: 'rgba(0, 0, 0, 0.4)',
      fontSize: 12,
    },
    splitLine: {
      lineStyle: {
        type: 'dashed',
        color: '#eee',
      },
    },
  },
  dataZoom: [
    {
      type: 'inside',
      filterMode: 'filter',
      minValueSpan: MIN_SPAN,
      maxValueSpan: MAX_SPAN,
      xAxisIndex: [0],
      startValue: getZoomStartValue(),
      endValue: Date.now(),
    },
  ],
  series: [
    createLineSeries(item.name, item.color, item.data),
  ],
})

const focusSplitChartsByTimestamp = () => {
  const targetTimestampStr = route.query.timestamp as string
  const targetTime = Number(targetTimestampStr)
  if (!targetTimestampStr || isNaN(targetTime)) return

  activeTab.value = ''
  const halfSpan = 3 * 3600 * 1000
  splitChartItems.value.forEach((item, index) => {
    const dataIndex = item.data.findIndex((d: number[]) => d[0] === targetTime)
    const instance = splitChartInstances.value[index]
    if (dataIndex === -1 || !instance) return

    instance.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      startValue: targetTime - halfSpan,
      endValue: targetTime + halfSpan,
    })
    instance.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex,
    })
  })
}

const renderSplitSeriesCharts = async (seriesList: LineChartSeries[]) => {
  chartInstance.value?.dispose()
  chartInstance.value = null
  resetSingleChartOverlays()

  disposeSplitCharts()
  isSplitSeriesMode.value = true
  splitChartItems.value = seriesList.map(toSplitChartItem)

  await nextTick()

  splitChartInstances.value = splitChartItems.value
    .map((item, index) => {
      const chartEl = splitChartRefs.value[index]
      if (!chartEl) return null

      const instance = echarts.init(chartEl)
      instance.setOption(createSplitChartOption(item))
      return instance
    })
    .filter((instance): instance is echarts.ECharts => Boolean(instance))

  focusSplitChartsByTimestamp()
}

const initChart = async () => {
  // 始终请求 30 天数据
  try {
    loading.value = true
    const rawData = await getStatsApi('30d')

    const model = buildChartRenderModel(rawData)
    const renderIndependentSeriesCharts = model.isMultiSeries && shouldRenderSplitSeriesCharts.value

    if (renderIndependentSeriesCharts) {
      await renderSplitSeriesCharts(model.seriesList)
      return
    }

    const { globalMaxCount, isMultiSeries, legendData, seriesList } = model

    isSplitSeriesMode.value = false
    splitChartItems.value = []
    disposeSplitCharts()

    if (!chartRef.value) return
    chartInstance.value?.dispose()
    chartInstance.value = echarts.init(chartRef.value)

    const option: echarts.EChartsOption = {
      animation: false,
      ...(isMultiSeries ? {
        legend: {
          data: legendData,
          top: 0,
          right: '5%',
        },
      } : {}),
      grid: {
        top: 40,
        left: '5%',
        right: '5%',
        bottom: '10%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'none',
        transitionDuration: 0,
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#489DF7',
            type: 'dashed',
          },
          label: {
            show: false,
          },
        },
      },
      xAxis: {
        type: 'time',
        splitNumber: 2,
        axisLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.4)',
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: 'transparent',
          formatter: function () {
            return '00-00\n00:00'
          },
          hideOverlap: false,
          fontSize: 12,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        max: Math.floor(globalMaxCount * 1.5),
        name: '完成数量',
        nameGap: 15,
        nameTextStyle: {
          color: 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,
        },
        axisLabel: {
          color: 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#eee',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          filterMode: 'filter',
          minValueSpan: MIN_SPAN,
          maxValueSpan: MAX_SPAN,
          xAxisIndex: [0],
          startValue: getZoomStartValue(),
          endValue: Date.now(),
        },
      ],
      series: seriesList,
    }

    chartInstance.value.setOption(option)

    const chartEl = chartRef.value!
    const zr = chartInstance.value.getZr()

    // ─── 工具函数 ────────────────────────────────────────────
    type DzRange = { startValue: number; endValue: number }
    const getDzRange = () =>
      (chartInstance.value!.getOption().dataZoom as DzRange[])?.[0]

    let labelUpdateRaf: number | null = null
    const updateCustomLabels = () => {
      if (labelUpdateRaf !== null) cancelAnimationFrame(labelUpdateRaf)
      labelUpdateRaf = requestAnimationFrame(() => {
        const dz = getDzRange()
        if (!dz) return
        const startVal = dz.startValue
        const endVal = dz.endValue
        const midVal = (startVal + endVal) / 2

        const formatTime = (v: number) => {
          const date = new Date(v)
          const M = (date.getMonth() + 1).toString().padStart(2, '0')
          const d = date.getDate().toString().padStart(2, '0')
          const h = date.getHours().toString().padStart(2, '0')
          const m = date.getMinutes().toString().padStart(2, '0')
          return `${M}-${d}\n${h}:${m}`
        }

        const inst = chartInstance.value!
        const leftPixel = inst.convertToPixel({ xAxisIndex: 0 }, startVal)
        const midPixel = inst.convertToPixel({ xAxisIndex: 0 }, midVal)
        const rightPixel = inst.convertToPixel({ xAxisIndex: 0 }, endVal)

        // @ts-expect-error getModel is private but needed for custom coordinate calculation
        const component = inst.getModel().getComponent('grid')
        if (!component) return
        const coordSys = component.coordinateSystem
        if (!coordSys) return
        const grid = coordSys.getRect()

        axisLayout.value.tickY1 = grid.y + grid.height
        axisLayout.value.tickY2 = grid.y + grid.height + 4
        axisLayout.value.labelY = grid.y + grid.height + 8

        axisLabels.value.left = { x: leftPixel, text: formatTime(startVal) }
        axisLabels.value.mid = { x: midPixel, text: formatTime(midVal) }
        axisLabels.value.right = { x: rightPixel, text: formatTime(endVal) }
      })
    }
    globalUpdateLabels = updateCustomLabels
    globalSyncZoomState = () => {
      const dz = getDzRange()
      if (!dz) return
      currentSpan = dz.endValue - dz.startValue
      prevStartValue = dz.startValue
      prevEndValue = dz.endValue
    }

    // 初始化后立刻渲染一次标签
    setTimeout(() => {
      updateCustomLabels()
    }, 0)

    const restoreZoom = (start: number, end: number) => {
      isRestoring = true
      chartInstance.value!.dispatchAction({
        type: 'dataZoom', dataZoomIndex: 0,
        startValue: start, endValue: end,
      })
      isRestoring = false
      setTimeout(() => updateCustomLabels(), 0)
    }

    // 标记位：防止 dispatchAction 触发 dataZoom 事件形成递归
    let isRestoring = false

    // ─── 功能1：双指检测 ──────────────────────────────────────
    // 使用 TouchEvent 实时捕获屏幕上的触点数量。
    // 1. 开始缓冲：双指刚落下时在 dataZoom 回调里跳过前若干帧，防止手指落下瞬间的方向随机微颤干扰视图。
    // 2. 结束防抖：两指变单指时延迟 300ms 退出双指状态，吸收先后抬起引起的中心点突变跳动。
    let isPinching = false
    let unpinchTimer: ReturnType<typeof setTimeout> | null = null
    let pinchSkipCount = 0            // 双指刚落下后需要跳过的 dataZoom 帧数
    const PINCH_SKIP_FRAMES = 3       // 跳过前 3 帧，覆盖初始落指颤动（pointermove 频率很高，3帧约 50ms）

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        isPinching = true
        pinchSkipCount = PINCH_SKIP_FRAMES
        if (unpinchTimer) {
          clearTimeout(unpinchTimer)
          unpinchTimer = null
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchSkipCount = 0
        if (isPinching && !unpinchTimer) {
          unpinchTimer = setTimeout(() => {
            isPinching = false
            unpinchTimer = null
          }, 300)
        }
      }
    }

    // 绑定原生事件，启用捕获阶段确保准确截获，设为 passive 对性能无影响
    chartEl.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true })
    chartEl.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true })
    chartEl.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: true })

    // ─── 功能2：缩放极限保护 ──────────────────────────────────
    // 问题：ECharts 内部 sliderMove 在钳制 minSpan/maxSpan 时，
    //       会将缩放中心偏移转化为位移，导致 span 不变但位置平移。
    // 方案：在 dataZoom 回调中检测到极限状态且 span 未变时，撤销位移。
    let currentSpan = 0
    let prevStartValue = 0
    let prevEndValue = 0
    const SPAN_EPSILON = MIN_SPAN * 0.01

    const initDz = getDzRange()
    if (initDz) {
      currentSpan = initDz.endValue - initDz.startValue
      prevStartValue = initDz.startValue
      prevEndValue = initDz.endValue
    }

    // 滚轮极限保护：到达极限方向时直接拦截，阻止事件到达 ECharts
    chartEl.addEventListener('wheel', (e) => {
      // deltaY < 0 = 向上滚 = 放大(span变小)，deltaY > 0 = 向下滚 = 缩小(span变大)
      if ((e.deltaY < 0 && currentSpan <= MIN_SPAN) || (e.deltaY > 0 && currentSpan >= MAX_SPAN)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }, { capture: true })

    // ─── 功能3：长按参考线 ──────────────────────────────────
    // 长按 500ms 后进入参考线模式：显示竖线 + tooltip，手指拖动时跟随
    // 期间抑制 dataZoom 平移，使图表保持静止
    const LONG_PRESS_DURATION = 500
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let crosshairActive = false
    let startX = 0
    let startY = 0

    const clearTimer = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
    }
    const showCrosshair = (x: number, y: number) => {
      chartInstance.value?.dispatchAction({ type: 'showTip', x, y })
    }
    const hideCrosshair = () => {
      if (!crosshairActive) return
      crosshairActive = false
      setTimeout(() => {
        if (crosshairActive) return // 延迟期间又触发了长按，取消隐藏
        chartInstance.value?.dispatchAction({ type: 'hideTip' })
        chartInstance.value?.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
      }, 500)
    }

    zr.on('mousedown', (e: { offsetX: number; offsetY: number }) => {
      clearTimer()
      startX = e.offsetX
      startY = e.offsetY
      longPressTimer = setTimeout(() => {
        crosshairActive = true
        showCrosshair(startX, startY)
      }, LONG_PRESS_DURATION)
    })

    zr.on('mousemove', (e: { offsetX: number; offsetY: number }) => {
      if (longPressTimer && !crosshairActive) {
        const dx = e.offsetX - startX
        const dy = e.offsetY - startY
        // 移动超过 10 像素即视为拖动，取消长按定时器，优化性能避免大量计算
        if (dx * dx + dy * dy > 100) {
          clearTimer()
        }
      }
    })

    // ─── 核心优化：拦截移动事件，防止平移干扰 ──────────────
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!crosshairActive) return

      // 拦截事件，阻止 ECharts 内部平移和浏览器滚动
      e.stopImmediatePropagation()
      if (e.cancelable) e.preventDefault()

      let x = 0, y = 0
      if (e instanceof MouseEvent) {
        x = e.offsetX
        y = e.offsetY
      } else if (e instanceof TouchEvent && e.touches.length > 0) {
        const touch = e.touches[0]
        if (touch) {
          const rect = chartEl.getBoundingClientRect()
          x = touch.clientX - rect.left
          y = touch.clientY - rect.top
        }
      }

      showCrosshair(x, y)
    }

    chartEl.addEventListener('mousemove', handleMove, { capture: true })
    chartEl.addEventListener('touchmove', handleMove, { capture: true, passive: false })

    zr.on('mouseup', () => { clearTimer(); hideCrosshair() })
    zr.on('globalout', () => { clearTimer(); hideCrosshair() })

    // ─── dataZoom 统一回调 ───────────────────────────────────
    // 汇总处理上述功能的 dataZoom 拦截逻辑
    chartInstance.value.on('dataZoom', () => {
      const dz = getDzRange()
      if (!dz || isRestoring) return

      if (isPinching) {
        // 开始缓冲：双指刚落下的前几帧一律还原，吸收落指颤动
        if (pinchSkipCount > 0) {
          pinchSkipCount--
          restoreZoom(prevStartValue, prevEndValue)
          return
        }

        // 缩放极限：span 到达边界且未实质缩放时，撤销位移
        const newSpan = dz.endValue - dz.startValue
        const atLimit = newSpan <= MIN_SPAN + SPAN_EPSILON || newSpan >= MAX_SPAN - SPAN_EPSILON
        const spanUnchanged = Math.abs(newSpan - currentSpan) < SPAN_EPSILON
        if (atLimit && spanUnchanged && (dz.startValue !== prevStartValue || dz.endValue !== prevEndValue)) {
          restoreZoom(prevStartValue, prevEndValue)
          return
        }
      }

      // 正常更新跟踪值
      currentSpan = dz.endValue - dz.startValue
      prevStartValue = dz.startValue
      prevEndValue = dz.endValue

      updateCustomLabels()
    })

    // ─── 功能4：处理 URL timestamp ──────────────────────────────
    const targetTimestampStr = route.query.timestamp as string
    if (targetTimestampStr) {
      const targetTime = Number(targetTimestampStr)
      if (!isNaN(targetTime)) {
        let searchData: number[][] = []
        const firstSeries = seriesList[0]
        if (firstSeries?.data) {
          searchData = firstSeries.data
        }
        const dataIndex = searchData.findIndex((d: number[]) => d[0] === targetTime)
        if (dataIndex !== -1) {
          activeTab.value = '' // 清除 tab 选中状态
          const halfSpan = 3 * 3600 * 1000 // 中心各延伸 3 小时，总计 6 小时

          const onRendered = () => {
            chartInstance.value!.off('rendered', onRendered)
            chartInstance.value!.dispatchAction({
              type: 'showTip',
              seriesIndex: 0,
              dataIndex: dataIndex,
            })
            crosshairActive = true // 激活十字线状态以便后续交互可正常隐藏
          }

          chartInstance.value!.on('rendered', onRendered)

          chartInstance.value!.dispatchAction({
            type: 'dataZoom',
            dataZoomIndex: 0,
            startValue: targetTime - halfSpan,
            endValue: targetTime + halfSpan,
          })
        }
      }
    }
  } catch (error) {
    console.warn('获取统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

const handleResize = () => {
  getActiveChartInstances().forEach(instance => instance.resize())
  if (!isSplitSeriesMode.value) {
    globalUpdateLabels?.()
  }
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
  disposeSplitCharts()
})
</script>

<template>
  <div class="stats-page page-enter">
    <div class="header-container">
      <button class="back-btn" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </button>
      <h1 class="title">统计图表</h1>
      <div class="placeholder"></div>
    </div>

    <div class="filter-row">
      <div class="filter-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="handleTabChange(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
      <button class="calendar-btn" :class="{ active: selectedDate }" @click="toggleCalendar">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>
    </div>

    <VanCalendar
      v-model:show="showCalendar"
      switch-mode="month"
      :min-date="calendarMinDate"
      :max-date="calendarMaxDate"
      :default-date="selectedDate || calendarMaxDate"
      position="bottom"
      :round="true"
      :show-confirm="false"
      :safe-area-inset-bottom="false"
      color="#3b82f6"
      @select="handleDateSelect"
    />

    <div v-if="isSplitSeriesMode" class="split-chart-list">
      <div
        v-for="(item, index) in splitChartItems"
        :key="item.id"
        class="chart-container split-chart-container"
      >
        <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
        </div>
        <div :ref="(el) => setSplitChartRef(el, index)" class="echarts-dom"></div>
      </div>
    </div>

    <div v-else class="chart-container">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
      </div>
      <div ref="chartRef" class="echarts-dom"></div>

      <div v-show="axisLabels.left.text" class="custom-x-axis">
        <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.left.x}px, ${axisLayout.tickY1}px, 0)`, height: (axisLayout.tickY2 - axisLayout.tickY1) + 'px' }"></div>
        <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.mid.x}px, ${axisLayout.tickY1}px, 0)`, height: (axisLayout.tickY2 - axisLayout.tickY1) + 'px' }"></div>
        <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.right.x}px, ${axisLayout.tickY1}px, 0)`, height: (axisLayout.tickY2 - axisLayout.tickY1) + 'px' }"></div>
        <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.left.x}px - 50%), ${axisLayout.labelY}px, 0)` }">{{ axisLabels.left.text }}</div>
        <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.mid.x}px - 50%), ${axisLayout.labelY}px, 0)` }">{{ axisLabels.mid.text }}</div>
        <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.right.x}px - 50%), ${axisLayout.labelY}px, 0)` }">{{ axisLabels.right.text }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-enter {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.stats-page {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background-color: transparent;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background-color: #eff6ff;
  border-color: #93c5fd;
}

.back-btn svg {
  width: 24px;
  height: 24px;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
}

.placeholder {
  width: 42px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.5rem;
}

.filter-tabs {
  flex: 1;
  display: flex;
  background-color: #f4f4f5;
  border-radius: 12px;
  padding: 4px;
}

.calendar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: none;
  background: #f4f4f5;
  color: #71717a;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.calendar-btn.active {
  background: #3b82f6;
  color: white;
}

.calendar-btn svg {
  width: 20px;
  height: 20px;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  border-radius: 8px;
  color: #71717a;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-container {
  width: 100%;
  aspect-ratio: 4 / 3; /* 更适合移动端的宽高比例 */
  min-height: 280px;
  background: white;
  border-radius: 16px;
  position: relative;
}

.split-chart-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.split-chart-container {
  aspect-ratio: 16 / 9;
  min-height: 220px;
}

.echarts-dom {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e4e4e7;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.custom-x-axis {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.axis-tick {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  background-color: rgba(0, 0, 0, 0.4);
  transform-origin: 0 0;
  will-change: transform;
}

.axis-label {
  position: absolute;
  top: 0;
  left: 0;
  color: rgba(0, 0, 0, 0.4);
  font-size: 12px;
  text-align: center;
  white-space: pre-wrap;
  line-height: 1.2;
  will-change: transform;
}

/* Vant Calendar 选中样式覆写 */
:deep(.van-calendar__selected-day) {
  background: transparent !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 50%;
  border: 2px solid #3b82f6;
  color: #3b82f6 !important;
}
</style>
