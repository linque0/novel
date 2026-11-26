/* Shared, responsive scene sources. Each scene has separate structure and text layers. */
const PREVIEW_WIDTH = 960
const PREVIEW_HEIGHT = 540
const MOBILE_HEIGHT = 580

function captureScene(page, logicalWidth, logicalHeight, density) {
  const mobile = logicalWidth < 500
  const layers = Array.from({ length: 2 }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(logicalWidth * density)
    canvas.height = Math.round(logicalHeight * density)
    return canvas
  })
  const [forms, type] = layers.map(canvas => {
    const ctx = canvas.getContext('2d')
    ctx.scale(canvas.width / logicalWidth, canvas.height / logicalHeight)
    return ctx
  })
  const sans = '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif'
  const serif = '"Songti SC",SimSun,"Noto Serif CJK SC",serif'
  const ink = '#f8eee5'
  const muted = '#d9c9ba'
  const warm = '#efc69b'
  const hairline = '#f9dfc24a'

  function text(value, x, y, size, color = ink, face = sans, weight = 400) {
    type.fillStyle = color
    type.font = weight + ' ' + size + 'px ' + face
    type.textBaseline = 'alphabetic'
    type.fillText(value, x, y)
  }

  function rule(x, y, length, vertical = false) {
    forms.fillStyle = hairline
    forms.fillRect(x, y, vertical ? 1 : length, vertical ? length : 1)
  }

  function surface(x, y, w, h, radius = 10, fill = '#211b1bd9', outline = hairline) {
    forms.beginPath()
    forms.roundRect(x, y, w, h, radius)
    forms.fillStyle = fill
    forms.fill()
    if (outline) {
      forms.strokeStyle = outline
      forms.lineWidth = 1
      forms.stroke()
    }
  }

  function tag(value, x, y) {
    type.font = '500 11px ' + sans
    const width = Math.ceil(type.measureText(value).width) + 20
    surface(x, y, width, 24, 12, '#81685270', '#ecbe8360')
    text(value, x + 10, y + 16, 11, '#f8d7ac', sans, 500)
  }

  function lines(values, x, y, size = 14, spacing = 22) {
    values.forEach((value, i) => text(value, x, y + i * spacing, size, muted))
  }

  function card(x, y, w, h, label, title, descriptions) {
    surface(x, y, w, h, 9, '#342824cd')
    text(label, x + 17, y + 24, 11, warm)
    text(title, x + 17, y + 51, 21, ink, serif)
    lines(descriptions, x + 17, y + 76, 12, 18)
  }

  const margin = mobile ? 14 : 35
  const left = margin + (mobile ? 17 : 25)
  const innerWidth = logicalWidth - 2 * left
  const headerY = mobile ? 17 : 29
  surface(margin, headerY, logicalWidth - 2 * margin, logicalHeight - 2 * headerY, 14, '#201817e3')
  forms.fillStyle = '#f3c78f'
  forms.beginPath()
  forms.arc(left + 7, headerY + 24, 6, 0, Math.PI * 2)
  forms.fill()
  text('浮世', left + 20, headerY + 30, 16, ink, serif, 600)
  text(page === 'A' ? '作品设定' : '档案详情', logicalWidth - left - 51, headerY + 29, 12, muted)
  rule(margin, headerY + 47, logicalWidth - margin * 2)

  if (page === 'A') {
    const titleY = mobile ? 149 : 170
    const overviewWidth = mobile ? innerWidth : 526
    text('WORLD ATLAS  /  地域概览', left, titleY - 43, 11, warm, sans, 600)
    text('浮世地域集 · 07', left, titleY, mobile ? 34 : 49, ink, serif, 500)
    lines(mobile ? ['从旧港到北境群岛，记录各地的', '地理、口述历史与行路见闻。']
      : ['从旧港到北境群岛，记录各地的地理、口述历史与行路见闻。'], left, titleY + 26)
    tag('编辑中', left, titleY + (mobile ? 58 : 42))
    rule(left, titleY + (mobile ? 99 : 84), overviewWidth)

    if (mobile) {
      card(left, 267, innerWidth, 107, '01  /  沿岸', '松雾港', ['潮季航线与旧港航标'])
      card(left, 387, innerWidth, 107, '02  /  海域', '北境诸岛', ['风暴带外的群岛与渡口'])
      rule(left, 518, innerWidth)
      text('卷一  /  已收录 12 个地点', left, 543, 12, muted)
    } else {
      const cardY = 278
      const cardWidth = (overviewWidth - 14) / 2
      card(left, cardY, cardWidth, 126, '01  /  沿岸', '松雾港', ['潮季航线与旧港航标', '港湾 · 档案 07'])
      card(left + cardWidth + 14, cardY, cardWidth, 126, '02  /  海域', '北境诸岛', ['风暴带外的群岛与渡口', '群岛 · 档案 12'])
      const sideX = left + overviewWidth + 52
      rule(sideX - 25, 101, 342, true)
      card(sideX, 102, logicalWidth - left - sideX, 132, 'REGIONS  /  本卷', '长明共和国',
        ['地形、物产与边境通行记录', '已收录 12 个地点'])
      text('近期修订', sideX, 273, 15, ink, serif)
      ;['07  松雾港 · 海雾季', '12  北境诸岛 · 船道', '19  长明共和国 · 地图'].forEach((item, i) => {
        rule(sideX, 292 + i * 42, logicalWidth - left - sideX)
        text(item, sideX, 316 + i * 42, 13, muted)
      })
      rule(left, 448, innerWidth)
      text('卷一  /  地域总览', left, 477, 12, muted)
    }
  } else {
    const y = mobile ? 82 : 94
    const height = mobile ? 203 : 190
    surface(left, y, innerWidth, height, 10, '#443025cb', '#e9c59f73')
    text('ARCHIVE 07  /  沿岸地区', left + 18, y + 33, 11, warm, sans, 600)
    text('松雾港 · No.07', left + 18, y + 82, mobile ? 34 : 49, ink, serif, 500)
    lines(mobile ? ['雾沿海岸上升，潮声落在木栈道下。', '冬天的船队会在这里等风。']
      : ['雾沿海岸上升，潮声落在木栈道下。冬天的船队会在这里等风。'], left + 18, y + 111)
    tag('档案已归档', left + 18, y + (mobile ? 154 : 139))
    if (!mobile) {
      const aside = logicalWidth - left - 188
      rule(aside - 23, y + 29, 131, true)
      text('N 32°  /  E 117°', aside, y + 63, 15, warm)
      lines(['所属  长明共和国', '航季  春至初冬'], aside, y + 100, 13, 26)
    }
    const listY = y + height + 31
    text('档案条目', left, listY, 18, ink, serif, 600)
    const entries = [
      ['01', '港口沿革', '旧港栈桥与潮汐'],
      ['02', '航路与风季', '北线航船与候风地'],
      ['03', '地标索引', '灯塔、渡口与海图']
    ]
    entries.forEach(([number, label, detail], i) => {
      const row = listY + (mobile ? 18 : 13) + i * (mobile ? 57 : 39)
      rule(left, row, innerWidth)
      text(number, left + 2, row + 25, 12, warm)
      text(label, left + 41, row + 25, 15, ink)
      text(detail, logicalWidth - left - (mobile ? 112 : 194), row + 25, mobile ? 11 : 13, muted)
    })
  }
  return layers
}
