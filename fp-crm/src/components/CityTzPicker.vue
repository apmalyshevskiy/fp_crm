<!-- src/components/CityTzPicker.vue — город (с поиском) + часовой пояс (МСК-акцент / серый UTC) в одну строку -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RU_TIMEZONES, CITY_LIST, cityToTz } from '../lib/timezones'

const props = defineProps({ city: { type: String, default: '' }, timezone: { type: String, default: '' } })
const emit = defineEmits(['update:city', 'update:timezone'])

const root = ref(null)
const cityOpen = ref(false)
const tzOpen = ref(false)
const active = ref(0)

const suggestions = computed(() => {
  const q = (props.city || '').trim().toLowerCase()
  const base = q ? CITY_LIST.filter(c => c.toLowerCase().includes(q)) : CITY_LIST
  return base.slice(0, 10)
})
const currentTz = computed(() => RU_TIMEZONES.find(z => z.tz === props.timezone) || null)

function onCityInput(e) {
  const v = e.target.value
  emit('update:city', v)
  const tz = cityToTz(v); if (tz) emit('update:timezone', tz)
  cityOpen.value = true; active.value = 0
}
function pickCity(c) {
  emit('update:city', c)
  const tz = cityToTz(c); if (tz) emit('update:timezone', tz)
  cityOpen.value = false
}
function onCityKey(e) {
  if (!cityOpen.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(active.value + 1, suggestions.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0) }
  else if (e.key === 'Enter') { if (suggestions.value[active.value]) { e.preventDefault(); pickCity(suggestions.value[active.value]) } }
  else if (e.key === 'Escape') { cityOpen.value = false }
}
function pickTz(z) { emit('update:timezone', z.tz); tzOpen.value = false }

function onDocClick(e) { if (root.value && !root.value.contains(e.target)) { cityOpen.value = false; tzOpen.value = false } }
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div class="ctz" ref="root">
    <div class="ctz-field">
      <label>Город</label>
      <input :value="city" @input="onCityInput" @focus="cityOpen = true" @keydown="onCityKey"
             placeholder="Начните вводить…" autocomplete="off" />
      <div v-if="cityOpen && suggestions.length" class="ctz-pop">
        <button type="button" v-for="(c, i) in suggestions" :key="c" class="ctz-opt" :class="{ on: i === active }"
                @mousedown.prevent="pickCity(c)">{{ c }}</button>
      </div>
    </div>

    <div class="ctz-field tz">
      <label>Часовой пояс</label>
      <button type="button" class="ctz-tzbtn" @click="tzOpen = !tzOpen">
        <span v-if="currentTz"><b>{{ currentTz.msk }}</b> <span class="utc">({{ currentTz.utc }})</span></span>
        <span v-else class="ph">— выбрать —</span>
        <span class="caret">▾</span>
      </button>
      <div v-if="tzOpen" class="ctz-pop">
        <button type="button" v-for="z in RU_TIMEZONES" :key="z.tz" class="ctz-opt tz" :class="{ sel: z.tz === timezone }"
                @mousedown.prevent="pickTz(z)"><b>{{ z.msk }}</b> <span class="utc">({{ z.utc }})</span></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctz { grid-column: 1 / -1; display: flex; gap: 10px; }
.ctz-field { position: relative; display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; font-size: 13px; color: var(--text-secondary); }
.ctz-field.tz { flex: 0 0 220px; }
input, .ctz-tzbtn { font: inherit; padding: 7px 10px; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--bg); width: 100%; }
.ctz-tzbtn { text-align: left; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text); }
.ctz-tzbtn b { font-weight: 600; }
.ctz-tzbtn .utc, .ctz-opt .utc { color: var(--text-tertiary); font-weight: 400; }
.ctz-tzbtn .ph { color: var(--text-tertiary); }
.ctz-tzbtn .caret { margin-left: auto; color: var(--text-tertiary); font-size: 11px; }
.ctz-pop { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--bg); border: 0.5px solid var(--border-strong); border-radius: var(--radius); box-shadow: 0 6px 20px rgba(0,0,0,0.12); max-height: 260px; overflow-y: auto; z-index: 20; padding: 4px; }
.ctz-opt { display: block; width: 100%; text-align: left; padding: 7px 10px; border: none; background: none; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text); }
.ctz-opt:hover, .ctz-opt.on { background: var(--bg-secondary); }
.ctz-opt.sel { background: var(--bg-tertiary); }
.ctz-opt b { font-weight: 600; }
@media (max-width: 560px) { .ctz { flex-direction: column; } .ctz-field.tz { flex-basis: auto; } }
</style>
