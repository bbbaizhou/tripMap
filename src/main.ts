import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/variables.scss'
import './assets/styles/global.scss'
import App from './App.vue'
import { router } from './router'
import { useAuthStore, useFootprintStore, useScenicStore, useMemoryStore } from './stores'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const authStore = useAuthStore()
const footprintStore = useFootprintStore()
const scenicStore = useScenicStore()
const memoryStore = useMemoryStore()

authStore.init()
footprintStore.init()
scenicStore.init()
memoryStore.init()

app.mount('#app')
