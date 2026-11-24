<script setup>
/* 实验性功能页（桌面版专有）：
 * 单一总开关控制恍然梦 Agent 相关全部入口、模块助手、模型设置与知识库模型。
 * 关闭后立即隐藏界面入口并暂停后台任务，本地已有密钥/预设/对话完整保留，重新开启即恢复。 */
import { useUiStore } from '../../../../stores/ui'

const ui = useUiStore()
const emit = defineEmits(['go'])

function toggleExperimental() {
  ui.applyPref('experimentalFeatures', !ui.experimentalFeatures)
}
</script>

<template>
  <div class="data-layout experimental-layout">
    <div>
      <section class="action-group experimental-master-group">
        <div class="section-title">
          <h2>功能总开关</h2>
          <span class="exp-pill" :class="{ on: ui.experimentalAiEnabled }">
            {{ ui.experimentalAiEnabled ? '已启用' : '默认关闭' }}
          </span>
        </div>

        <div class="exp-master-card" :class="{ 'is-on': ui.experimentalAiEnabled }">
          <div class="setting-row exp-master-row" data-setting="experimentalFeatures">
            <span class="exp-master-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
            </span>
            <div class="setting-copy">
              <strong id="experimental-label">显示并启用实验性功能</strong>
              <p>开启后显示恍然梦 Agent 的全部入口与模型配置；关闭时立即隐藏入口并暂停后台任务。</p>
            </div>
            <button
              type="button"
              class="switch"
              id="experimental-switch"
              role="switch"
              aria-labelledby="experimental-label"
              :aria-checked="ui.experimentalFeatures"
              data-act="toggle-experimental"
              @click="toggleExperimental"
            >
              <i></i>
            </button>
          </div>
        </div>
      </section>

      <section class="action-group">
        <div class="section-title">
          <h2>包含的功能范围</h2>
          <small>恍然梦 Agent</small>
        </div>

        <div class="action-row exp-scope-row">
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16M7 9h4M7 13h3" /></svg>
          <div>
            <strong>恍然梦入口与独立窗口</strong>
            <p>书架与工作台顶栏「恍然梦-入梦 / 浅眠」入口、书架右键入梦打开、右侧浅眠停靠列与独立拆窗</p>
          </div>
          <span class="exp-pill" :class="{ on: ui.experimentalAiEnabled }">
            {{ ui.experimentalAiEnabled ? '已显示' : '已隐藏' }}
          </span>
        </div>

        <div class="action-row exp-scope-row">
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
          <div>
            <strong>各模块写作助手</strong>
            <p>正文工具栏与右键续写/改写、大纲与设定「发送给恍然梦」及任务启动器</p>
          </div>
          <span class="exp-pill" :class="{ on: ui.experimentalAiEnabled }">
            {{ ui.experimentalAiEnabled ? '已启用' : '已隐藏' }}
          </span>
        </div>

        <div class="action-row exp-scope-row">
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" /></svg>
          <div>
            <strong>模型设置与知识库模型</strong>
            <p>左侧设置「模型设置」与「知识库模型」分类页，以及章节后台自动记忆队列与向量索引</p>
          </div>
          <div v-if="ui.experimentalAiEnabled" class="experimental-shortcuts">
            <button type="button" class="btn small" @click="emit('go', 'ai')">模型设置</button>
            <button type="button" class="btn small" @click="emit('go', 'knowledge')">知识库模型</button>
          </div>
          <span v-else class="exp-pill">已收起</span>
        </div>
      </section>
    </div>

    <aside class="data-aside">
      <h2 class="aside-heading">当前状态</h2>
      <dl class="library-list">
        <div>
          <dt>功能总开关</dt>
          <dd :class="ui.experimentalAiEnabled ? 'exp-val-on' : 'exp-val-off'">
            {{ ui.experimentalAiEnabled ? '已启用' : '已关闭' }}
          </dd>
        </div>
        <div>
          <dt>顶栏与拆窗入口</dt>
          <dd>{{ ui.experimentalAiEnabled ? '显示' : '隐藏' }}</dd>
        </div>
        <div>
          <dt>写作模块助手</dt>
          <dd>{{ ui.experimentalAiEnabled ? '可用' : '隐藏' }}</dd>
        </div>
        <div>
          <dt>模型与知识库设置</dt>
          <dd>{{ ui.experimentalAiEnabled ? '显示' : '收起' }}</dd>
        </div>
        <div>
          <dt>后台记忆与索引</dt>
          <dd>{{ ui.experimentalAiEnabled ? '按需运行' : '已暂停' }}</dd>
        </div>
      </dl>

      <div class="device-note">
        <strong>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5zM8 12l3 3 5-6" /></svg>
          本地配置完整保留
        </strong>
        <p>关闭开关不会删除你已填写的供应商预设、API 密钥或历史对话记录，随时重新打开即可恢复。</p>
      </div>

      <div class="device-note">
        <strong>不影响核心写作</strong>
        <p>仅控制桌面版「恍然梦 Agent」等实验性能力，正文、大纲、设定、人物与灵感功能始终可用。</p>
      </div>
    </aside>
  </div>
</template>
