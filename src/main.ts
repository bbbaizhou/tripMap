import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/variables.scss'
import App from './App.vue'
import { router } from './router'
import { useFootprintStore, useScenicStore, useMemoryStore } from './stores'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const footprintStore = useFootprintStore()
const scenicStore = useScenicStore()
const memoryStore = useMemoryStore()

footprintStore.init()
scenicStore.init()
memoryStore.init()

app.mount('#app')
