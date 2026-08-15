<script setup lang="ts">
import { ref } from 'vue'
import { isAiConfigured } from '../utils/aiClient'

// 扩展点注释（P1 后置，本轮不触发任何真实调用）：
// 1. 坐标兜底解析：复用 geoResolver.ts 管线（AmapGeoResolver 已预留远程扩展）；
//    LLM 兜底 = TODO 仿 autoTag 加一个 resolveCoordsViaLLM(input, cfg) 函数，本轮只留注释。
// 2. 自动标签：TODO Phase 5.2 调 aiClient.autoTag()；UI 预留「对回忆批量打标签」入口（未配置禁用 + 提示）。
// 3. 景点信息补全：TODO 为景点生成 description/type/最佳季节，产出标注「AI 生成，请核实」（PRODUCT 5.4 原则）。

const aiConfigured = isAiConfigured()
const tagHint = ref('')

/** 占位交互：Phase 5.2 调 autoTag()；本轮不触发任何真实 AI/网络调用。 */
const onBatchTag = () => {
  tagHint.value = '自动标签功能接入中（TODO Phase 5.2）'
}
</script>

<template>
  <section class="organize-view">
    <div class="organize-header">
      <h2>AI 智能整理</h2>
      <p>坐标兜底解析 · 自动标签 · 景点信息补全</p>
    </div>

    <div class="org-list">
      <!-- 坐标兜底解析 -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">坐标兜底解析</span>
            <span class="org-badge">接入中</span>
          </div>
          <p class="org-desc">本地坐标库未命中时，预留 LLM 兜底解析城市经纬度（复用 geoResolver 管线）</p>
        </div>
        <div class="org-action">
          <button class="org-btn" disabled>解析坐标（Phase 5.2）</button>
        </div>
      </div>

      <!-- 自动标签 -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">自动标签</span>
            <span class="org-badge">接入中</span>
          </div>
          <p class="org-desc">对回忆内容批量生成标签，便于按主题回顾</p>
        </div>
        <div class="org-action">
          <button class="org-btn" :disabled="!aiConfigured" @click="onBatchTag">对回忆批量打标签</button>
        </div>
      </div>

      <div v-if="!aiConfigured" class="form-hint org-hint">
        AI 能力未配置：请在 <code>.env.example</code> 中填写 <code>VITE_AI_API_KEY</code> 后重启开发服务器，即可启用自动标签
      </div>
      <div v-else-if="tagHint" class="form-hint org-hint">{{ tagHint }}</div>

      <!-- 景点信息补全 -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">景点信息补全</span>
            <span class="org-badge">接入中</span>
          </div>
          <p class="org-desc">为景点生成简介 / 类型 / 最佳季节，产出将标注「AI 生成，请核实」</p>
        </div>
        <div class="org-action">
          <button class="org-btn" disabled>补全景点信息（Phase 5.2）</button>
        </div>
      </div>
    </div>

    <p class="ai-compliance-note">AI 生成内容仅供参考，请以实际为准</p>
  </section>
</template>

<style scoped>
.organize-view {
  padding: var(--space-lg);
  max-width: 860px;
  margin: 0 auto;
}

.organize-header {
  margin-bottom: var(--space-lg);
}

.organize-header h2 {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-primary);
}

.organize-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.org-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.org-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
}

.org-main {
  flex: 1;
}

.org-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.org-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.org-badge {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.org-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.org-action {
  flex-shrink: 0;
}

.org-btn {
  padding: 8px 16px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.org-btn:hover:not(:disabled) {
  background: var(--color-primary-lighter);
}

.org-btn:disabled {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  cursor: not-allowed;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

.org-hint code {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.ai-compliance-note {
  margin-top: var(--space-lg);
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .organize-view {
    padding: var(--space-md);
  }

  .org-row {
    flex-direction: column;
    align-items: stretch;
  }

  .org-action {
    align-self: flex-end;
  }
}
</style>
