<script setup lang="ts">
import { isAiConfigured } from '../utils/aiClient'

// 构建期静态替换：无 .env 时 VITE_AI_API_KEY 为 undefined → isAiConfigured() 返回 false → 显示引导卡（零请求）。
const aiConfigured = isAiConfigured()
</script>

<template>
  <section class="ai-home-view">
    <div class="ai-home-header">
      <h2>AI 旅行助手</h2>
      <p>行程规划 · 足迹数据洞察 · 智能整理</p>
    </div>

    <!-- 配置状态：未配置 → 引导卡；已配置 → 状态徽标 -->
    <div v-if="aiConfigured" class="ai-status-badge">
      <span class="ai-status-dot"></span>
      AI 服务已配置
    </div>
    <div v-else class="ai-guide-card">
      <div class="ai-guide-title">AI 能力未配置</div>
      <p class="ai-guide-desc">
        当前未检测到 AI 服务凭据。以下 AI 能力将以占位形态展示，配置后即可启用真实生成，现有功能不受影响。
      </p>
      <ol class="ai-guide-steps">
        <li>复制项目根目录的 <code>.env.example</code> 为 <code>.env</code></li>
        <li>在 <code>.env</code> 中填写 <code>VITE_AI_API_KEY</code>（platform.deepseek.com → API Keys）</li>
        <li>重启开发服务器（<code>npm run dev</code>）</li>
      </ol>
    </div>

    <!-- 三张入口卡：未配置时仍可点击，子页面各自降级 -->
    <div class="ai-entry-grid">
      <RouterLink to="/ai/plan" class="ai-entry-card">
        <div class="ai-entry-icon">🗺️</div>
        <div class="ai-entry-name">行程规划</div>
        <p class="ai-entry-desc">输入目的地与偏好，生成每日行程建议</p>
      </RouterLink>
      <RouterLink to="/ai/insights" class="ai-entry-card">
        <div class="ai-entry-icon">📊</div>
        <div class="ai-entry-name">足迹数据洞察</div>
        <p class="ai-entry-desc">按年份查看足迹统计与 AI 个性化解读</p>
      </RouterLink>
      <RouterLink to="/ai/organize" class="ai-entry-card">
        <div class="ai-entry-icon">🧹</div>
        <div class="ai-entry-name">智能整理</div>
        <p class="ai-entry-desc">坐标兜底解析、自动标签与景点信息补全</p>
      </RouterLink>
    </div>

    <!-- 合规标注（PRODUCT_RD_PLAN 5.5.4） -->
    <p class="ai-compliance-note">AI 生成内容仅供参考</p>
  </section>
</template>

<style scoped>
.ai-home-view {
  padding: var(--space-lg);
  max-width: 960px;
  margin: 0 auto;
}

.ai-home-header {
  margin-bottom: var(--space-lg);
}

.ai-home-header h2 {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-primary);
}

.ai-home-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* 已配置状态徽标 */
.ai-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.ai-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary-light);
}

/* 未配置引导卡 */
.ai-guide-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-card);
}

.ai-guide-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.ai-guide-desc {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.ai-guide-steps {
  margin: 0;
  padding-left: var(--space-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.9;
}

.ai-guide-steps code {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

/* 入口卡 */
.ai-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-md);
}

.ai-entry-card {
  display: block;
  text-decoration: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}

.ai-entry-card:hover {
  box-shadow: var(--shadow-float);
  transform: translateY(-2px);
}

.ai-entry-icon {
  font-size: 28px;
  margin-bottom: var(--space-sm);
}

.ai-entry-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.ai-entry-desc {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.ai-compliance-note {
  margin-top: var(--space-lg);
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .ai-home-view {
    padding: var(--space-md);
  }

  .ai-entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
