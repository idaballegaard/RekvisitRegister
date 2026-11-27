<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import SiteNavbar from './components/SiteNavbar.vue'

const route = useRoute()
</script>

<template>
  <SiteNavbar v-if="route.meta.requiresAuth" />
  <RouterView />
</template>