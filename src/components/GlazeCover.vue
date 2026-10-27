<script setup>
import ThemeBook from './ThemeBook.vue'
defineProps({book:{type:Object,required:true},miniature:Boolean,pose:{type:String,default:'front'}})
</script>
<template><ThemeBook class="glaze-cover" :book="book" theme="glaze" :miniature="miniature" :pose="pose" /></template>
