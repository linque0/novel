/* 幕布 Markdown 导入解析单元测试（纯 Node，不依赖 DOM）：
 * 1. 验证传统 H1–H6 标题层级兼容；
 * 2. 验证《浮世地域集.md》的严格树形层级、3 顶层设定集、9 张外链图片、
 *    heading-3 标题节点、合并引用块、富文本 HTML 与零空节点。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseMubuMd } from '../src/services/importers.js'

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log('PASS', name)
}

function walkTree(nodes, fn, depth = 0, path = []) {
  for (const n of nodes) {
    const nextPath = [...path, n.text]
    fn(n, depth, nextPath)
    walkTree(n.children || [], fn, depth + 1, nextPath)
  }
}

function findByPath(nodes, segments) {
  let list = nodes
  let cur = null
  for (const seg of segments) {
    cur = list.find((n) => n.text === seg || n.text.includes(seg))
    if (!cur) return null
    list = cur.children || []
  }
  return cur
}

// 1. 传统标题大纲兼容
check('传统 H1–H3 + 正文解析保持层级', () => {
  const md = ['# 世界观', '总述段落', '## 地理', '断崖描述', '### 细节', '青铜刻度', '## 势力', '公会'].join('\n')
  const tree = parseMubuMd(md)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].text, '世界观')
  assert.equal(tree[0].heading, 1)
  assert.equal(tree[0].children.length, 3)
  assert.equal(tree[0].children[0].text, '总述段落')
  assert.equal(tree[0].children[1].text, '地理')
  assert.equal(tree[0].children[1].heading, 2)
  assert.equal(tree[0].children[1].children[1].text, '细节')
  assert.equal(tree[0].children[1].children[1].heading, 3)
  assert.equal(tree[0].children[1].children[1].children[0].text, '青铜刻度')
})

// 2. 孤立首行 H1 + 无短横分区 + 缩进列表 + 富文本/图片/引用
check('幕布导出混合格式（加粗/斜体/链接/图片/引用/空短横过滤）', () => {
  const md = [
    '# 文档名',
    '',
    '分区A',
    '- **主项**',
    '  - ### **子标题**',
    '    - *斜体说明* 与 [参考](https://example.com/a)',
    '    - <span class="bold">本质：</span><span> **逻辑真空**</span>',
    '    - 徽章项',
    '      - 寓意',
    '      ![image-1](https://example.com/1.png)',
    '      > 引用第一行',
    '      > 引用第二行',
    '  -'
  ].join('\n')
  const tree = parseMubuMd(md)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].text, '分区A')
  const main = tree[0].children[0]
  assert.equal(main.text, '主项')
  assert.equal(main.html, '<b>主项</b>')
  assert.equal(main.children.length, 1) // 末尾空 "-" 已过滤
  const sub = main.children[0]
  assert.equal(sub.text, '子标题')
  assert.equal(sub.heading, 3)
  assert.equal(sub.html, '<b>子标题</b>')
  assert.equal(sub.children[0].text, '斜体说明 与 参考')
  assert.ok(sub.children[0].html.includes('<i>斜体说明</i>'))
  assert.ok(sub.children[0].html.includes('<a href="https://example.com/a"'))
  assert.equal(sub.children[1].text, '本质： 逻辑真空')
  assert.equal(sub.children[1].html, '<b>本质：</b> <b>逻辑真空</b>')
  const badge = sub.children[2]
  assert.equal(badge.text, '徽章项')
  assert.ok(badge.html.includes('<img class="lore-image" src="https://example.com/1.png" alt="image-1">'))
  assert.equal(badge.children.length, 2)
  assert.equal(badge.children[1].text, '引用第一行\n引用第二行')
})

// 3. 真实样本：e:\小小的说\浮世\浮世地域集.md
const samplePath = 'e:/小小的说/浮世/浮世地域集.md'
if (fs.existsSync(samplePath)) {
  const raw = fs.readFileSync(samplePath, 'utf8')
  const tree = parseMubuMd(raw)

  check('浮世地域集：3 个顶层设定集（现实模版 / 虚构国度 / 设定）', () => {
    assert.deepEqual(
      tree.map((n) => n.text),
      ['现实模版', '虚构国度', '设定']
    )
  })

  let total = 0
  let maxDepth = 0
  let emptyCount = 0
  let imgCount = 0
  let heading3Count = 0
  let richCount = 0
  walkTree(tree, (n, depth) => {
    total++
    if (depth > maxDepth) maxDepth = depth
    if (!n.text.trim() && !n.html) emptyCount++
    if (n.html) {
      richCount++
      const matches = n.html.match(/<img\b[^>]*class="lore-image"/g)
      if (matches) imgCount += matches.length
    }
    if (n.heading === 3) heading3Count++
  })

  check('浮世地域集：节点总数、最大深度、图片数与零空节点', () => {
    assert.ok(total >= 1000 && total <= 1020, `预期 1000..1020 节点，实际 ${total}`)
    assert.equal(maxDepth, 9, `预期最大深度 9（共 10 层），实际 ${maxDepth}`)
    assert.equal(emptyCount, 0, '不应出现空节点')
    assert.equal(imgCount, 9, `预期 9 张外链徽章图，实际 ${imgCount}`)
    assert.equal(heading3Count, 8, `预期 8 个 heading-3 节点，实际 ${heading3Count}`)
    assert.ok(richCount > 200, `预期大量富文本节点，实际 ${richCount}`)
    console.log(`  统计: total=${total}, maxDepth=${maxDepth + 1}层, rich=${richCount}, imgs=${imgCount}, h3=${heading3Count}`)
  })

  check('浮世地域集：深层关键路径与节点挂载准确', () => {
    const xunmu = findByPath(tree, ['现实模版', '长明共和国', '势力', '国家异常现象监察管理局', '组织总览', '衍生修正处（天衍）', '二科：寻木'])
    assert.ok(xunmu, '应找到 衍生修正处（天衍）→ 二科：寻木')
    assert.ok(xunmu.children.some((c) => c.text.includes('候濂溪')))

    const logoEye = findByPath(tree, ['现实模版', '长明共和国', '势力', '国家异常现象监察管理局', '徽章（Logo）', '局徽：监察之眼'])
    assert.ok(logoEye && logoEye.html?.includes('img class="lore-image"'), '局徽：监察之眼 应内嵌徽章图')

    const stage1 = findByPath(tree, ['设定', '异象的本质定义', '叙事空洞（Model Void）', '深度解析：叙事空洞', '形成机制：熵增回填', '这一过程通常分为三个阶段：', '第一阶段：脱离'])
    assert.ok(stage1 && stage1.heading === 3, '第一阶段：脱离 应为 heading-3')

    const spanNode = findByPath(tree, ['设定', '异象的本质定义', '叙事空洞（Model Void）', '深度解析：叙事空洞', '核心定义：地图上的空白', '本质：'])
    assert.ok(spanNode && spanNode.text.startsWith('本质：') && !spanNode.text.includes('<span'), 'span 标签应转为纯文本 + <b>')
    assert.ok(spanNode.html?.includes('<b>本质：</b>'))

    const quoteParent = findByPath(tree, ['现实模版', '长明共和国', '历史背景', '历史遗留：司天监', '传承：'])
    assert.ok(quoteParent && quoteParent.children.length === 1, '传承下应挂有合并后的引用子节点')
    assert.ok(quoteParent.children[0].text.includes('续国院档案摘录') && quoteParent.children[0].text.includes('如果承认伟力合理'))

    const oldCity = findByPath(tree, ['现实模版', '德特明斯', '核心城邦', '旧城邦'])
    assert.ok(oldCity && oldCity.children[0].text.includes('旧城邦是指那些'), '旧城邦首子节点应为引用说明')
    assert.ok(oldCity.children.some((c) => c.text === '繁茂城'))

    const hollow1 = findByPath(tree, ['现实模版', '大空洞（The Grand Hollow）——万象枢纽'])
    const hollow2 = findByPath(tree, ['虚构国度', '大空洞'])
    assert.ok(hollow1 && hollow2, '两处大空洞均应按原文档严格保留')
  })
}

console.log(`\n全部 ${passed} 项检查通过`)
