<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getStatsApi } from '../api/stats'

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

// 当前选中的时间范围 tab
const activeTab = ref('7d')
const tabs = [
  { label: '近1小时', value: '1h' },
  { label: '近24小时', value: '24h' },
  { label: '近7天', value: '7d' },
]

const goBack = () => {
  router.push('/')
}

const handleTabChange = async (val: string) => {
  if (activeTab.value === val || loading.value) return
  activeTab.value = val
  await reloadChartData()
}

const fetchStatsData = async (range: string) => {
  try {
    loading.value = true
    return await getStatsApi(range)
  } catch (error) {
    console.warn('获取统计数据组件内捕获失败:', error)
    return []
  } finally {
    loading.value = false
  }
}

const reloadChartData = async () => {
  if (!chartInstance.value) return
  
  // 获取新格式的数据
  const newData = await fetchStatsData(activeTab.value)
  const formattedData = newData.map((item: { time: number; count: number }) => [item.time, item.count])
  
  // 这里移除了之前硬编码的时间格式转换
  // 以允许 ECharts 的 time 原轴利用其自身的算法展现最优时间分段
  
  chartInstance.value.setOption({
    dataZoom: [
      {
        xAxisIndex: [0],
        start: 0,
        end: 100, // 每次点击不同时间筛选项，重置缩放以容纳全新 100% 数据
        minValueSpan: 3600 * 1000, // 最小放缩跨度为1小时（3600*1000ms）
      },
    ],
    series: [{
      data: formattedData,
    }],
  })
}

const initChart = async () => {
  if (!chartRef.value) return
  
  chartInstance.value = echarts.init(chartRef.value)

  // 先行获取数据并格式化，带着数据统一完成初次渲染
  const initialData = await fetchStatsData(activeTab.value)
  const formattedData = initialData.map((item: { time: number; count: number }) => [item.time, item.count])
  
  const option: echarts.EChartsOption = {
    grid: {
      top: 40,
      left: '5%',
      right: '5%',
      bottom: '10%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      // 取消原本的 type: 'cross' 就不再在坐标轴显示具体的指示数值标签了
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: 'rgba(0, 0, 0, 0.4)',
        },
      },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.4)',
        formatter: function (value: number) {
          const date = new Date(value)
          const M = (date.getMonth() + 1).toString().padStart(2, '0')
          const d = date.getDate().toString().padStart(2, '0')
          const h = date.getHours().toString().padStart(2, '0')
          const m = date.getMinutes().toString().padStart(2, '0')
          return `${M}-${d}\n${h}:${m}`
        },
        hideOverlap: true,
        fontSize: 12,
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      max(value) {
        return Math.floor(value.max * 1.5)
      },
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
        type: 'inside', // 支持手势鼠标滑动缩放
        filterMode: 'none',
        minValueSpan: 3600 * 1000, // 最小放缩跨度为1小时
        xAxisIndex: [0],
        start: 0,
        end: 100,
      },
    ],
    series: [
      {
        name: '完成数',
        type: 'line',
        symbol: 'none', // 彻底禁止显示任何数据点（包括 hover 状态）
        showSymbol: false, 
        smooth: true,
        lineStyle: {
          color: '#3b82f6', // 蓝色加深一点点
          width: 2,
        },
        data: formattedData,
      },
    ],
  }
  
  chartInstance.value.setOption(option)
}

const handleResize = () => {
  chartInstance.value?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
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

    <div class="chart-container">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
      </div>
      <div ref="chartRef" class="echarts-dom"></div>
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

.filter-tabs {
  display: flex;
  background-color: #f4f4f5;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 1.5rem;
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
</style>
