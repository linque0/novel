<script setup>
import ThemeBook from './ThemeBook.vue'
defineProps({book:{type:Object,required:true},miniature:Boolean,pose:{type:String,default:'front'}})
</script>
<template><ThemeBook class="gravity-cover" :book="book" theme="gravity" :miniature="miniature" :pose="pose" /></template>
