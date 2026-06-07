# FlowgorithmJS 自动布局算法详解

本文档基于 `flowgorithm.js` v0.17a1 (2020-05-02) 分析其 flowchart 自动布局的原理。

## 1. 核心坐标系

代码使用一个**全局垂直坐标** `flow.Y`，所有元素按顺序垂直排列：

```javascript
flow = {Y:0, fWidth:0, dim:[]};  // Y = 当前垂直位置
```

每个元素绘制后，`flow.Y` 会累加该元素的高度 + 箭头高度：

```javascript
flow.Y += 36 + options.aH + options.aT;  // 例如 drawAssign
```

---

## 2. 顺序执行（Sequence）

线性流程最简单，每个元素：
1. 画箭头（垂直短线）
2. 画元素本身（矩形/菱形/平行四边形）
3. `flow.Y` 下移

```javascript
function drawSequence($xml) {
    var s = '<g class="block sequence" transform="translate(0,'+flow.Y+')">';
    flow.Y = 0;  // 重置Y来计算内部高度
    // 遍历子元素，调用 drawDeclare/drawInput/drawAssign...
    $xml.children().each(function(i){
        switch($el.prop("tagName")){
            case 'declare': s += drawDeclare(...); break;
            case 'output':  s += drawOutput(...); break;
            case 'input':   s += drawInput(...); break;
            case 'assign':  s += drawAssign(...); break;
            case 'call':    s += drawCall(...); break;
            case 'if':      s += drawSelection(...); break;
            case 'for':     s += drawPreIteraction(...); break;
            case 'while':   s += drawPreIteraction(...); break;
            case 'do':      s += drawPostIteraction(...); break;
            case 'more':    s += drawMore(); break;
        }
    });
    return s + '</g>';
}
```

---

## 3. 条件分支（if）布局 — 最复杂的部分

```
           条件(菱形)
          /         \
      True路径      False路径
      (可能更宽)     (可能更宽)
          \         /
           汇聚点(圆圈)
```

关键步骤：

**Step 1** — 绘制菱形条件框，计算左右分支宽度：

```javascript
var trueWidth = halfCondition - 5;   // True分支基础宽度
var falseWidth = halfCondition - 5;  // False分支基础宽度

if($branchTrue.children().length > 0) {
    svgSequenceTrue = drawSequence($branchTrue);
    trueWidth += Math.max(calcBlockX(svgSequenceTrue), minPathWidth);
}
```

**Step 2** — 绘制两个分支的SVG内容（各自独立调用 `drawSequence`，重置 `flow.Y`）

**Step 3** — 如果两个分支高度不同，用垂直线补齐使汇聚点对齐：

```javascript
if(branchTrueHeight > branchFalseHeight) {
    s += '<polyline points="'+(-falseWidth)+','+branchFalseHeight+' '+(-falseWidth)+','+branchTrueHeight+'"/>';
}
```

**代码位置：** `drawSelection()` 函数，约第311-393行。

---

## 4. 循环布局（while/for/do-while）

### 4.1 预循环（while/for）— 条件在顶部，循环体在下方

三种 `itMode` 风格通过 `options.itMode`（1/2/3）选择箭头路由样式：

**itMode=2（默认）的经典布局：**
```
         [条件六边形]
            |
      +-----+-----+
      |           |
     T/F        T/F
      |           |
   [循环体]    向下到False出口
      |
      +-- 向上回跳到条件左侧
```

```javascript
// itMode=2 的关键逻辑
var down = Math.max(0, romH - options.aH - options.aT);
s += '    <g class="true-path" transform="translate('+(condW2+15)+','+romH+')">'
     + '       <polyline points="0,0 '+(half-5)+',0 '+(half-5)+','+down+'"/>'
     + '       ...循环体内容...'
     + '       <polyline class="arrow" points="0,0 0,15 '+(-half+15-condW2)+',15 '+(-half+15-condW2)+',0 '+(-half+15-condW2)+','+(-flow.Y+(options.aT*2)+options.aH)+'"/>';
```

**代码位置：** `drawPreIteraction()` 函数，约第395-487行。

### 4.2 后循环（do-while）— 循环体先执行，条件在底部

```javascript
// 先画小圆点，再画循环体，最后画底部条件
s = '...<circle cx="0" cy="'+(options.aH+options.aT)+'" r="4"/>...';
contentDraw = drawSequence($content);  // 循环体
// 最后画底部条件六边形
```

```
    [小圆点]---->[循环体]----+
         ↑                 |
         +-------[条件]-----+
              (False出口向下)
```

**代码位置：** `drawPostIteraction()` 函数，约第489-544行。

---

## 5. 宽度计算 — `getBBox()` 技巧

代码使用两个隐藏的SVG元素来**测量渲染后的尺寸**：

```javascript
// 测量文本宽度
function calcExtraWidth(content) {
    $('#ttest').text(content);
    return $('#ttest').get(0).getBBox().width;
}

// 测量整个块的宽度（含内部偏移）
function calcBlockWidth(content) {
    $('#gtest').get(0).innerHTML = '<g transform="translate(0,0)">'+content+'</g>';
    return $('#gtest').children('g').get(0).getBBox().width;
}

// 计算块左边缘到原点的距离（用于计算分支偏移）
function calcBlockX(content) {
    return Math.abs($('#gtest').children('g').get(0).getBBox().x);
}
```

**原理：** 将内容临时放入隐藏的 `<g id="gtest">` 或 `<text id="ttest">`，然后调用 SVG 的 `getBBox()` API 获取精确的渲染尺寸。

---

## 6. 多函数横向排列

当XML有多个 `<function>` 时，每个函数横向排列：

```javascript
var tempX = funX;
if(tempX != 0) {
    tempX += fx;      // 前一个函数宽度
    funX += fwidth;   // 累加总宽度
} else {
    funX = fwidth - fx;  // 第一个函数居中偏移
}
return '<g transform="translate('+tempX+',10)" class="function">'+s+'</g>';
```

---

## 7. 最终尺寸调整

所有SVG生成后，测量总边界框并调整偏移使其左对齐：

```javascript
var gwidth = $svg.children('g').get(0).getBBox().width;
var gheight = $svg.children('g').get(0).getBBox().height;
$svg.attr('width', gwidth+10).attr('height', gheight+15)
    .attr('viewBox', '0 0 '+(gwidth+10)+' '+(gheight+15));

// 计算左偏移量（使内容左对齐并留边距）
var disc = 0 - $svg.children('g').get(0).getBBox().x + 5;
$svg.children('g').attr('transform', 'translate('+disc+',0)');
```

---

## 8. 布局算法总结

| 特性 | 实现方式 |
|------|---------|
| **顺序流** | 全局 `flow.Y` 垂直累加，每个元素高度 + 箭头高度 |
| **分支布局** | 先计算分支宽度，再画分支内容，最后用垂直线均衡高度 |
| **循环布局** | 预循环：条件→体；后循环：体→条件 |
| **宽度测量** | 隐藏 SVG + `getBBox()` 实时计算文本和块的尺寸 |
| **多函数** | 横向累加 `funX`，每个函数独立 `flow.Y` 坐标 |
| **最终调整** | 测量整体边界框，左对齐并留边距 |

---

## 9. 关键函数索引

| 函数 | 行号 | 功能 |
|------|------|------|
| `drawFlowchart` | 39-94 | 主入口，初始化SVG |
| `drawFunction` | 96-134 | 绘制单个函数（Main或其他） |
| `drawSequence` | 135-175 | 遍历函数体中的所有元素 |
| `drawStart` / `drawEnd` | 176-201 | START/END 椭圆 |
| `drawDeclare` | 202-216 | 变量声明框 |
| `drawAssign` | 217-229 | 赋值框 |
| `drawInput` | 230-244 | 输入平行四边形 |
| `drawOutput` | 245-259 | 输出平行四边形 |
| `drawCall` | 260-273 | 子程序调用框 |
| `drawSelection` | 311-393 | if条件分支布局 |
| `drawPreIteraction` | 395-487 | while/for预循环布局 |
| `drawPostIteraction` | 489-544 | do-while后循环布局 |
| `calcExtraWidth` | 546-551 | 测量文本渲染宽度 |
| `calcBlockWidth` | 552-557 | 测量整个块的宽度 |
| `calcBlockX` | 558-561 | 计算块左边缘偏移 |

---

## 10. 选项说明

```javascript
options = {
    aH: 12,           // 箭头长度
    aT: 7,            // 箭头尖端大小
    groupInput: false, // 是否将连续多个INPUT合并为一个
    viewDesc: true,   // 是否显示标题、作者、描述信息
    itMode: 2,        // 预循环布局风格（1/2/3）
    labelTrue: "True",
    labelFalse: "False"
}
```