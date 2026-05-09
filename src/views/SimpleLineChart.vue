<script setup lang="ts">
import { shallowRef } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import {
  TREND_DATA_NEAREST_6_HOUR_TYPE,
  TREND_DATA_NEAREST_12_HOUR_TYPE,
  TREND_DATA_NEAREST_24_HOUR_TYPE,
  TREND_DATA_NEAREST_7_DAY_TYPE,
} from '@fpweb/deviceModule/constants'
import {
  SIGNAL_MONITOR_TYPE,
  RF_SIGNAL_MONITOR_TYPE,
  BLUETOOTH_SIGNAL_MONITOR_TYPE,
} from '@fpweb/shared/constants/monitor'
import { signalLevelList, getLabelBySignalLevel } from '@fpweb/shared/dicts'

interface IMonitorItem {
  md: string | number // monitorData
  mt: number // monitorTime 时间戳
  mp?: number // 系列标识，区分不同系列
}

interface IChartData {
  mts: IMonitorItem[] // 监测数据数组
  un: string // unit 单位
}

interface SplitChartItem {
  id: number
  name: string
  color: string
  data: number[][]
  maxCount: number
}

interface LineChartSeries {
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

interface ChartRenderModel {
  isMultiSeries: boolean
  globalMaxCount: number
  legendData: string[]
  seriesList: LineChartSeries[]
}

interface Props {
  data: IChartData
  displayType?: number | string
  routeQuery: any
  timeRange?: { startTime: number, endTime: number } | null
  currentMonitorData: object
  isVirtualMonitors: boolean
  allDict: object
}

const props = withDefaults(defineProps<Props>(), {
  displayType: '',
  data: () => ({ mts: [], un: '' }),
  currentMonitorData: () => ({}),
  timeRange: null,
  isVirtualMonitors: false,
  allDict: () => ({}),
})

const emit = defineEmits<{
  (e: 'zoomChange'): void
}>()

const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const splitChartRefs = ref<HTMLElement[]>([])
const splitChartInstances = shallowRef<echarts.ECharts[]>([])

const MIN_SPAN = 3600 * 1000
const MAX_SPAN = 24 * 3600 * 1000

const axisLayout = ref({ tickY1: 0, tickY2: 0, labelY: 0 })
const axisLabels = ref({
  left: { x: -100, text: '' },
  mid: { x: -100, text: '' },
  right: { x: -100, text: '' },
})
const shouldRenderSplitSeriesCharts = computed(() => props.routeQuery.splitSeries === '1')
const isSplitSeriesMode = ref(false)
const splitChartItems = ref<SplitChartItem[]>([])

// 保存 series 数据用于长按tooltip检查
let chartSeriesData: any[] = []

// tab value 对应的小时数
const rangeHoursMap: Record<number, number> = {
  [TREND_DATA_NEAREST_6_HOUR_TYPE]: 6,
  [TREND_DATA_NEAREST_12_HOUR_TYPE]: 12,
  [TREND_DATA_NEAREST_24_HOUR_TYPE]: 24,
  [TREND_DATA_NEAREST_7_DAY_TYPE]: 7 * 24,
}

let globalUpdateLabels: (() => void) | null = null
let globalSyncZoomState: (() => void) | null = null

// 有些特殊监测值, 图表的形式要做兼容
// 信号
const isSignalType = computed(() => {
  return [
    SIGNAL_MONITOR_TYPE,
    RF_SIGNAL_MONITOR_TYPE,
    BLUETOOTH_SIGNAL_MONITOR_TYPE,
  ].includes(+props.currentMonitorData?.monitorType)
})

function setSplitChartRef(el: unknown, index: number) {
  if (el instanceof HTMLElement) {
    splitChartRefs.value[index] = el
  }
}

function disposeSplitCharts() {
  splitChartInstances.value.forEach(instance => instance.dispose())
  splitChartInstances.value = []
  splitChartRefs.value = []
}

function getActiveChartInstances() {
  if (isSplitSeriesMode.value)
    return splitChartInstances.value
  return chartInstance.value ? [chartInstance.value] : []
}

function setZoomForActiveCharts(startValue: number, endValue: number) {
  const instances = getActiveChartInstances()
  if (instances.length === 0)
    return false
  instances.forEach((instance) => {
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

// 根据当前 displayType 计算 dataZoom 的 startValue（绝对时间戳）
function getZoomStartValue(displayType: number) {
  const hours = rangeHoursMap[displayType] ?? 24
  return Date.now() - hours * 3600 * 1000
}

// 仅调整可视区域，不重新请求数据
function applyZoom(displayType: number) {
  const startValue = getZoomStartValue(displayType)
  // 优先使用传入的 timeRange.endTime，如果没有则使用当前时间
  const zoomEndTime = props.timeRange?.endTime ?? Date.now()
  setZoomForActiveCharts(startValue, zoomEndTime)
}

// 根据指定时间戳范围缩放图表
function applyZoomByTimestamp(startTime: number, endTime: number) {
  setZoomForActiveCharts(startTime, startTime)
}
// 计算合适的图表最大值
function calculateYAxisMax(maxValue: number): number {
  if (maxValue <= 0)
    return 1

  // 计算最大值的小数位数
  const decimalPlaces = Math.floor(-Math.log10(maxValue))

  if (maxValue < 1) {
    // 小于1时，使用2倍并按小数位数取整
    const multiplier = 2
    const factor = 10 ** decimalPlaces
    return Math.ceil(maxValue * multiplier * factor) / factor
  }
  // 大于等于1时，使用原有逻辑
  return Math.ceil(maxValue * 1.5)
}

// 获取系列名称，支路需要特殊处理
function getSeriesName(mp: number | undefined, isMultiSeries: boolean) {
  // 单条，并且不是支路情况，直接返回label
  if (!isMultiSeries && !props.isVirtualMonitors) {
    return props.currentMonitorData?.label || ''
  }
  // 如果是支路，需要字典查别名拼接通道
  if (props.isVirtualMonitors) {
    const currents = props.currentMonitorData?.currents || []
    const monitorAliasKey = currents.find(item => item.channelNo === String(mp))?.monitorAliasKey || ''
    const monitorAliasName = props.allDict[monitorAliasKey] || '--'
    // 电压和电流去掉
    if ([400010, 400009].includes(+props.currentMonitorData?.monitorType)) {
      const simpleMonitorAliasName = monitorAliasName.slice(0, 2)
      return `${simpleMonitorAliasName}(通道${mp})`
    }
    return `${monitorAliasName}(通道${mp})`
  }
  // 其它的多系列情况
  return `${mp}路${props.currentMonitorData?.label || ''}`
}

function initChart() {
  if (!chartRef.value) {
    return
  }
  // 缩放范围
  const MIN_SPAN = 3600 * 1000
  const MAX_SPAN = 30 * 24 * 3600 * 1000

  if (chartInstance.value) {
    chartInstance.value.dispose()
  }

  chartInstance.value = echarts.init(chartRef.value)

  const unit = props.data.un || ''
  // 信号监测值需要设置series的step
  const seriesStepValue = isSignalType.value ? 'start' : false

  // 检测是否有多系列数据
  const mpValues = [...new Set(props.data.mts.map(item => item.mp))].filter(v => v !== undefined).sort((a, b) => a - b)
  const isMultiSeries = mpValues.length > 1

  // 最大值
  let globalMaxCount = 0

  // 系列颜色配置
  const seriesColors = ['#4A90E4', '#50E3C2', '#F5A623', '#FF6B6B', '#9013FE', '#FF9500']

  let series: any[] = []
  const legendData: string[] = []

  // 记录每个系列的数据长度
  const seriesDataLengths: Record<number, number> = {}

  if (isMultiSeries) {
    // 多系列：按 mp 分组
    const groupedData: Record<number, [number, number][]> = {}
    props.data.mts.forEach((item) => {
      const mp = item.mp ?? 1
      if (!groupedData[mp]) {
        groupedData[mp] = []
      }
      const numberValue = Number(item.md)
      if (numberValue > globalMaxCount) {
        globalMaxCount = numberValue
      }
      groupedData[mp].push([item.mt * 1000, numberValue])
    })

    series = mpValues.map((mp, index) => {
      const seriesName = getSeriesName(mp, isMultiSeries)
      legendData.push(seriesName)
      // 保存该系列的数据长度
      seriesDataLengths[mp] = groupedData[mp]?.length ?? 0
      return {
        name: seriesName,
        type: 'line',
        step: seriesStepValue,
        // sampling: 'lttb',
        smooth: false,
        emphasis: { disabled: true },
        animation: false,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: {
          width: 2,
          color: seriesColors[index % seriesColors.length],
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
          color: seriesColors[index % seriesColors.length],
        },
        data: groupedData[mp] ?? [],
      }
    })
  } else {
    // 单系列：原有逻辑
    const seriesData = props.data.mts.map((item) => {
      const numberValue = Number(item.md)
      if (numberValue > globalMaxCount) {
        globalMaxCount = numberValue
      }
      return [
        item.mt * 1000,
        numberValue,
      ]
    })
    // 保存单系列的数据长度
    seriesDataLengths[1] = seriesData.length
    const seriesName = getSeriesName(mpValues[0], isMultiSeries)
    legendData.push(seriesName)
    series = [
      {
        name: seriesName,
        type: 'line',
        step: seriesStepValue,
        // sampling: 'lttb',
        smooth: false,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 7,
        emphasis: { disabled: true },
        animation: false,
        lineStyle: {
          width: 2,
          color: '#4A90E4',
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
          color: '#4A90E4',
        },
        data: seriesData,
      },
    ]
  }
  // 保存 series 数据用于长按tooltip检查
  chartSeriesData = series

  // 计算 filterMode：如果最多的系列数量超过一定数量，则使用filter
  // 数据稀疏时使用filter会导致折线看起来缺少一截，过多时不使用filter会有性能问题
  const allDataLengths = Object.values(seriesDataLengths)
  const maxLengths = allDataLengths.length > 0 ? Math.max(...allDataLengths) : 0
  const calcFilterMode: 'filter' | 'none' = maxLengths > 9000 ? 'filter' : 'none'
  const gridTopValue = isMultiSeries ? 70 : 40 // 粗略计算

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      triggerOn: 'none',
      transitionDuration: 0,
      confine: true,
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#489DF7',
          type: 'solid',
          width: 1,
        },
        label: {
          show: false,
        },
      },
      position(pt: any) {
        return [pt[0], '10%']
      },
      formatter(params: any) {
        if (!params || params.length === 0)
          return ''
        const item = params[0]
        const time = dayjs(item.value[0]).format('YYYY/MM/DD HH:mm:ss')
        let result = `${time}`
        params.forEach((p: any) => {
          let tempValue = p.value[1]
          if (isSignalType.value) {
            tempValue = getLabelBySignalLevel(tempValue)
          }
          result += `<br/>${p.marker}${p.seriesName}：${tempValue}${unit}`
        })
        return result
      },
    },
    grid: {
      left: 40,
      right: 20,
      top: gridTopValue, // 多系列时顶部留出图例空间
      bottom: 50,
    },
    legend: {
      data: legendData,
      top: 0,
      right: 15,
      orient: (props.isVirtualMonitors && mpValues.length > 3) ? 'horizontal' : 'vertical',
      type: 'plain',
      itemWidth: 20, // 设置图例项宽度
      itemStyle: {
        opacity: 0, // 隐藏图形
      },
      textStyle: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.6)',
        padding: [0, 0, 8, 0],
      },

      ...((mpValues.length > 3 || mpValues.length === 2)
        ? {
          width: '60%',
          padding: [15, 5, 5, 5],
        }
        : {}),
    },
    // legend: isMultiSeries
    //   ? {
    //       data: legendData,
    //       top: 0,
    //       right: 15,
    //       orient: 'vertical',
    //       itemWidth: 20, // 设置图例项宽度
    //       itemStyle: {
    //         opacity: 0 // 隐藏图形
    //       },
    //       textStyle: {
    //         fontSize: 12,
    //         color: 'rgba(0,0,0,0.6)',
    //         padding: [0, 0, 8, 0]
    //       }
    //     }
    //   : undefined,
    xAxis: {
      type: 'time',
      splitNumber: 2,
      boundaryGap: false,
      min: props.timeRange?.startTime,
      max: props.timeRange?.endTime,
      axisLine: {
        lineStyle: { color: 'rgba(0,0,0,0.12)' },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        show: false, // x轴使用自定义标签
        color: 'transparent',
        fontSize: 12,
        formatter() {
          return ''
        },
        hideOverlap: true,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: isSignalType.value ? globalMaxCount : calculateYAxisMax(globalMaxCount),
      name: unit
        ? `${props.currentMonitorData?.label || ''}(${unit})`
        : `${props.currentMonitorData?.label || ''}`,
      nameTextStyle: {
        color: 'rgba(0,0,0,0.4)',
        fontSize: 12,
        padding: [0, 0, 8, 0],
      },
      axisLabel: {
        formatter: (value: number) => {
          if (isSignalType.value) {
            return getLabelBySignalLevel(value)
          }
          return value
        },
        color: 'rgba(0,0,0,0.4)',
        fontSize: 12,
      },

      splitArea: {
        show: !!isSignalType.value,
        areaStyle: {
          color: ['rgba(255,156,56,0.04)', 'rgba(245,232,54,0.04)', 'rgba(79,219,93,0.04)'],
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0,0,0,0.04)',
        },
      },
      splitNumber: isSignalType.value ? 3 : 5,
    },
    dataZoom: [
      {
        type: 'inside',
        filterMode: calcFilterMode,
        minValueSpan: MIN_SPAN,
        maxValueSpan: MAX_SPAN, // 一屏最多展示24小时
        zoomOnMouseWheel: false,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: false,
        xAxisIndex: [0],
        startValue: getZoomStartValue(props.displayType || 24),
        endValue: props.timeRange?.endTime ?? Date.now(),
      },
    ],
    series,
  }

  chartInstance.value.setOption(option)

  const chartEl = chartRef.value!
  const zr = chartInstance.value.getZr()
  // 标记位：防止 dispatchAction 触发 dataZoom 事件形成递归
  let isRestoring = false

  // ─── 工具函数 ────────────────────────────────────────────
  interface DzRange {
    startValue: number
    endValue: number
  }

  const getDzRange = () =>
    (chartInstance.value!.getOption().dataZoom as DzRange[])?.[0]
  // 自定义label
  let labelUpdateRaf: number | null = null
  const updateCustomLabels = () => {
    if (labelUpdateRaf !== null)
      cancelAnimationFrame(labelUpdateRaf)
    labelUpdateRaf = requestAnimationFrame(() => {
      const dz = getDzRange()
      if (!dz)
        return
      const startVal = dz.startValue
      const endVal = dz.endValue
      const midVal = (startVal + endVal) / 2

      // 根据缩放范围决定时间格式：2小时以内显示秒
      const TWO_HOURS = 2 * 60 * 60 * 1000
      const span = endVal - startVal
      const showSeconds = span <= TWO_HOURS
      const formatTime = (v: number) => {
        return dayjs(v).format(showSeconds ? 'MM/DD HH:mm:ss' : 'MM/DD HH:mm')
      }

      const inst = chartInstance.value!
      const leftPixel = inst.convertToPixel({ xAxisIndex: 0 }, startVal)
      const midPixel = inst.convertToPixel({ xAxisIndex: 0 }, midVal)
      const rightPixel = inst.convertToPixel({ xAxisIndex: 0 }, endVal)

      // @ts-expect-error getModel is private but needed for custom coordinate calculation
      const component = inst.getModel().getComponent('grid')
      if (!component)
        return
      const coordSys = component.coordinateSystem
      if (!coordSys)
        return
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
    if (!dz)
      return
    // eslint-disable-next-line ts/no-use-before-define
    currentSpan = dz.endValue - dz.startValue
    // eslint-disable-next-line ts/no-use-before-define
    prevStartValue = dz.startValue
    // eslint-disable-next-line ts/no-use-before-define
    prevEndValue = dz.endValue
  }

  // 初始化后立刻渲染一次标签
  setTimeout(() => {
    updateCustomLabels()
  }, 0)

  const restoreZoom = (start: number, end: number) => {
    isRestoring = true
    chartInstance.value!.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      startValue: start,
      endValue: end,
    })
    isRestoring = false
    setTimeout(() => updateCustomLabels(), 0)
  }

  // 双指检测
  // 使用 TouchEvent 实时捕获屏幕上的触点数量。
  // 1. 开始缓冲：双指刚落下时在 dataZoom 回调里跳过前若干帧，防止手指落下瞬间的方向随机微颤干扰视图。
  // 2. 结束防抖：两指变单指时延迟 300ms 退出双指状态，吸收先后抬起引起的中心点突变跳动。
  let isPinching = false
  let unpinchTimer: ReturnType<typeof setTimeout> | null = null
  let singleTouchStartX = 0
  let singleTouchStartY = 0
  let crosshairActive = false
  let pinchSkipCount = 0 // 双指刚落下后需要跳过的 dataZoom 帧数
  const PINCH_SKIP_FRAMES = 3 // 跳过前 3 帧，覆盖初始落指颤动（pointermove 频率很高，3帧约 50ms）

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      singleTouchStartX = e.touches[0].clientX
      singleTouchStartY = e.touches[0].clientY
    }
    if (e.touches.length >= 2) {
      isPinching = true
      pinchSkipCount = PINCH_SKIP_FRAMES
      if (unpinchTimer) {
        clearTimeout(unpinchTimer)
        unpinchTimer = null
      }
    }
  }

  const handleSingleTouchMove = (e: TouchEvent) => {
    if (crosshairActive || e.touches.length !== 1)
      return

    const touch = e.touches[0]
    const deltaX = touch.clientX - singleTouchStartX
    const deltaY = touch.clientY - singleTouchStartY
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
      e.stopImmediatePropagation()
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
  chartEl.addEventListener('touchmove', handleSingleTouchMove, { capture: true, passive: true })
  chartEl.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true })
  chartEl.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: true })

  // 缩放极限处理
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


  // 长按参考线
  // 长按 500ms 后进入参考线模式：显示竖线 + tooltip，手指拖动时跟随
  // 期间抑制 dataZoom 平移，使图表保持静止
  const LONG_PRESS_DURATION = 500
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  const clearTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }
  const showCrosshair = (x: number, y: number) => {
    // 检查视图范围内是否有数据点
    const dz = getDzRange()
    if (!dz)
      return
    const hasDataInVisibleRange = chartSeriesData.some((s) => {
      if (!s.data || s.data.length === 0)
        return false
      // 检查是否有数据点在视图范围内
      return s.data.some((d: number[]) => d[0] >= dz.startValue && d[0] <= dz.endValue)
    })

    // 只有视图范围内有数据点时才显示tooltip
    if (hasDataInVisibleRange) {
      chartInstance.value?.dispatchAction({ type: 'showTip', x, y })
    }
  }
  const hideCrosshair = () => {
    if (!crosshairActive)
      return
    crosshairActive = false
    setTimeout(() => {
      if (crosshairActive)
        return // 延迟期间又触发了长按，取消隐藏
      chartInstance.value?.dispatchAction({ type: 'hideTip' })
      chartInstance.value?.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
    }, 1000)
  }

  zr.on('mousedown', (e: { offsetX: number, offsetY: number }) => {
    clearTimer()
    startX = e.offsetX
    startY = e.offsetY
    longPressTimer = setTimeout(() => {
      crosshairActive = true
      showCrosshair(startX, startY)
    }, LONG_PRESS_DURATION)
  })
  zr.on('mousemove', (e: { offsetX: number, offsetY: number }) => {
    if (longPressTimer && !crosshairActive) {
      const dx = e.offsetX - startX
      const dy = e.offsetY - startY
      // 移动超过 10 像素即视为拖动，取消长按定时器，优化性能避免大量计算
      if (dx * dx + dy * dy > 100) {
        clearTimer()
      }
    }
  })

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!crosshairActive)
      return

    // 拦截事件，阻止 ECharts 内部平移和浏览器滚动
    e.stopImmediatePropagation()
    if (e.cancelable)
      e.preventDefault()

    let x = 0
    let y = 0
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

  zr.on('mouseup', () => {
    clearTimer()
    hideCrosshair()
  })
  zr.on('globalout', () => {
    clearTimer()
    hideCrosshair()
  })

  // dataZoom 统一回调
  // 汇总处理上述功能的 dataZoom 拦截逻辑
  chartInstance.value.on('dataZoom', () => {
    // 通知父组件取消筛选选中状态
    emit('zoomChange')

    const dz = getDzRange()
    if (!dz || isRestoring)
      return

    // 双指缩放极限：span 到达边界且未实质缩放时，撤销位移
    if (isPinching) {
      // 开始缓冲：双指刚落下的前几帧一律还原，吸收落指颤动
      if (pinchSkipCount > 0) {
        pinchSkipCount--
        restoreZoom(prevStartValue, prevEndValue)
        return
      }
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

  // 处理url传值的时间戳
  const alarmTime = props.routeQuery.alarmTime as string
  const targetTimestampStr = dayjs(alarmTime, 'YYYY/MM/DD HH:mm:ss').valueOf()
  if (targetTimestampStr) {
    const targetTime = Number(targetTimestampStr)
    if (!Number.isNaN(targetTime) && +props.currentMonitorData?.monitorType === +props.routeQuery?.monitorType) {
      // 多系列数据需要遍历所有系列找到匹配的时间点
      let targetSeriesIndex = -1
      let targetDataIndex = -1

      for (let i = 0; i < series.length; i++) {
        const dataIndex = series[i].data.findIndex((d: number[]) => d[0] === targetTime)
        if (dataIndex !== -1) {
          targetSeriesIndex = i
          targetDataIndex = dataIndex
          break
        }
      }

      if (targetSeriesIndex !== -1) {
        emit('zoomChange') // 清除 tab 选中状态
        const halfSpan = 3 * 3600 * 1000 // 中心各延伸 3 小时，总计 6 小时

        // 获取图表最右侧时间（时间范围结束时间或当前时间）
        const chartEndTime = props.timeRange?.endTime ?? Date.now()
        // 计算 endValue：取 alarmTime + halfSpan 和图表最右侧时间的较小值
        const endValue = Math.min(targetTime + halfSpan, chartEndTime)

        const onRendered = () => {
          chartInstance.value!.off('rendered', onRendered)
          chartInstance.value!.dispatchAction({
            type: 'showTip',
            seriesIndex: targetSeriesIndex,
            dataIndex: targetDataIndex,
          })
          crosshairActive = true // 激活十字线状态以便后续交互可正常隐藏
        }
        chartInstance.value!.on('rendered', onRendered)

        chartInstance.value!.dispatchAction({
          type: 'dataZoom',
          dataZoomIndex: 0,
          startValue: targetTime - halfSpan,
          endValue,
        })
      }
    }
  }
}

function handleResize() {
  chartInstance.value?.resize()
  globalUpdateLabels?.()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
})

watch(() => props.data, () => {
  initChart()
}, { deep: true })

defineExpose({
  initChart,
  applyZoom,
  applyZoomByTimestamp,
})
</script>

<template>
  <div class="simple-chart-box">
    <div ref="chartRef" class="chart" />

    <!-- Custom DOM Labels for better performance -->
    <div v-show="axisLabels.left.text" class="custom-x-axis">
      <!-- Ticks -->
      <!-- <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.left.x}px, ${axisLayout.tickY1}px, 0)`, height: `${axisLayout.tickY2 - axisLayout.tickY1}px` }" />
      <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.mid.x}px, ${axisLayout.tickY1}px, 0)`, height: `${axisLayout.tickY2 - axisLayout.tickY1}px` }" />
      <div class="axis-tick" :style="{ transform: `translate3d(${axisLabels.right.x}px, ${axisLayout.tickY1}px, 0)`, height: `${axisLayout.tickY2 - axisLayout.tickY1}px` }" /> -->
      <!-- Labels -->
      <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.left.x}px), ${axisLayout.labelY}px, 0)` }">
        {{ axisLabels.left.text }}
      </div>
      <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.mid.x}px - 50%), ${axisLayout.labelY}px, 0)` }">
        {{ axisLabels.mid.text }}
      </div>
      <div class="axis-label" :style="{ transform: `translate3d(calc(${axisLabels.right.x}px - 100%), ${axisLayout.labelY}px, 0)` }">
        {{ axisLabels.right.text }}
      </div>
    </div>
  </div>
  <div class="font-size-[var(--font-size-xs)] color-[--secondaryTextColor]">
    （支持左右移动或缩放曲线更改统计时间范围）
  </div>
</template>

<style scoped lang="scss">
.simple-chart-box {
  position: relative;
  width: 100%;
  .chart {
    width: 100%;
    height: 280px;
    touch-action: pan-y pinch-zoom;
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
    top: 5px;
    left: 0;
    color: rgba(0, 0, 0, 0.4);
    font-size: 12px;
    text-align: center;
    white-space: pre-wrap;
    line-height: 1.2;
    will-change: transform;
  }
}
</style>
