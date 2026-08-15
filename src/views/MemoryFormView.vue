<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMemoryStore } from '../stores/memoryStore'
import type { TravelMemory } from '../types'

const props = defineProps<{ memoryId?: string }>()
const router = useRouter()
const memoryStore = useMemoryStore()

const isEdit = computed(() => !!props.memoryId)
const pageTitle = computed(() => isEdit.value ? '编辑回忆' : '写回忆')

const form = ref({
  title: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  companionsRaw: '',
  tagsRaw: '',
  cost: '' as string,
  content: '',
  imagesRaw: '',
  cities: '',
})

onMounted(() => {
  if (isEdit.value && props.memoryId) {
    const existing = memoryStore.getById(props.memoryId)
    if (existing) {
      form.value = {
        title: existing.title,
        startDate: existing.startDate,
        endDate: existing.endDate,
        companionsRaw: existing.companions.join('、'),
        tagsRaw: existing.tags.join('、'),
        cost: existing.cost != null ? String(existing.cost) : '',
        content: existing.content,
        imagesRaw: existing.images.join('\n'),
        cities: existing.cities.join('、'),
      }
    }
  }
})

const splitInput = (raw: string) =>
  raw.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean)

const validationError = ref('')

const handleSubmit = () => {
  validationError.value = ''
  if (!form.value.title.trim()) {
    validationError.value = '请填写标题'
    return
  }
  if (!form.value.startDate || !form.value.endDate) {
    validationError.value = '请填写日期'
    return
  }
  if (form.value.endDate < form.value.startDate) {
    validationError.value = '结束日期不能早于开始日期'
    return
  }

  const images = form.value.imagesRaw
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('http'))

  const now = new Date().toISOString()

  if (isEdit.value && props.memoryId) {
    memoryStore.updateMemory(props.memoryId, {
      title: form.value.title.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      companions: splitInput(form.value.companionsRaw),
      tags: splitInput(form.value.tagsRaw),
      cost: form.value.cost !== '' ? Number(form.value.cost) : undefined,
      content: form.value.content,
      images,
      cities: splitInput(form.value.cities),
    })
    router.push(`/memory/${props.memoryId}`)
  } else {
    const newMemory: TravelMemory = {
      memoryId: `m${Date.now()}`,
      title: form.value.title.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      companions: splitInput(form.value.companionsRaw),
      tags: splitInput(form.value.tagsRaw),
      cost: form.value.cost !== '' ? Number(form.value.cost) : undefined,
      content: form.value.content,
      images,
      cities: splitInput(form.value.cities),
      spotIds: [],
      createdAt: now,
      updatedAt: now,
    }
    memoryStore.addMemory(newMemory)
    router.push(`/memory/${newMemory.memoryId}`)
  }
}

const handleCancel = () => {
  if (isEdit.value && props.memoryId) {
    router.push(`/memory/${props.memoryId}`)
  } else {
    router.push('/memories')
  }
}
</script>

<template>
  <section class="form-view">
    <div class="form-header">
      <button class="back-btn" @click="handleCancel">← 返回</button>
      <h2>{{ pageTitle }}</h2>
    </div>

    <form class="memory-form" @submit.prevent="handleSubmit">
      <div v-if="validationError" class="error-banner">{{ validationError }}</div>

      <div class="form-group">
        <label class="form-label">标题 *</label>
        <input v-model="form.title" type="text" class="form-input" placeholder="给这次旅行起个名字..." />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">出发日期 *</label>
          <input v-model="form.startDate" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">返回日期 *</label>
          <input v-model="form.endDate" type="date" class="form-input" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">同伴</label>
          <input v-model="form.companionsRaw" type="text" class="form-input" placeholder="朋友、家人（逗号分隔）" />
        </div>
        <div class="form-group">
          <label class="form-label">费用（元）</label>
          <input v-model="form.cost" type="number" class="form-input" min="0" placeholder="0" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">途经城市</label>
        <input v-model="form.cities" type="text" class="form-input" placeholder="北京、上海（逗号分隔）" />
      </div>

      <div class="form-group">
        <label class="form-label">标签</label>
        <input v-model="form.tagsRaw" type="text" class="form-input" placeholder="自然风光、美食、古迹（逗号分隔）" />
      </div>

      <div class="form-group">
        <label class="form-label">图片 URL（每行一个）</label>
        <textarea
          v-model="form.imagesRaw"
          class="form-textarea form-textarea-sm"
          placeholder="https://images.unsplash.com/..."
          rows="3"
        />
        <div class="field-hint">仅支持以 http 开头的图片 URL</div>
      </div>

      <div class="form-group">
        <label class="form-label">旅行记录</label>
        <textarea
          v-model="form.content"
          class="form-textarea"
          placeholder="记录这次旅途中难忘的瞬间..."
          rows="8"
        />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="handleCancel">取消</button>
        <button type="submit" class="btn-submit">{{ isEdit ? '保存修改' : '发布回忆' }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.form-view { padding: 24px; max-width: 780px; margin: 0 auto; }

.form-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.back-btn {
  background: none;
  border: none;
  color: #2e7d32;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}
.form-header h2 { margin: 0; font-size: 22px; }

.memory-form { display: flex; flex-direction: column; gap: 0; }

.error-banner {
  background: #fee2e2;
  color: #dc2626;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
}

.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }
.form-label { font-size: 14px; font-weight: 600; color: #374151; }
.form-input, .form-textarea {
  padding: 10px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  transition: border-color 200ms ease;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus, .form-textarea:focus { border-color: #4caf50; }
.form-textarea { resize: vertical; line-height: 1.6; }
.form-textarea-sm { resize: none; }
.field-hint { font-size: 12px; color: #9ca3af; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}
.btn-cancel {
  padding: 10px 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}
.btn-submit {
  padding: 10px 28px;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.btn-submit:hover { background: #43a047; }
</style>
