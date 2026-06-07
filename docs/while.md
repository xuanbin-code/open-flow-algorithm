# while - 前测循环

先判断条件表达式，条件为真时执行循环体，否则跳过。等同于其他语言中的 `while`。

## XML 语法

```xml
<while expression="条件表达式">
    <!-- 循环体，可包含任意代码节点 -->
</while>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expression` | String | 是 | 循环条件表达式 |

## 示例

```xml
<!-- 基本 while 循环（含占位符） -->
<while expression="condition">
    <more/>
</while>

<!-- 空循环体 -->
<while expression="condition">
</while>

<!-- 实际应用：循环直到用户放弃 -->
<while expression="playOneRound()"/>

<!-- 嵌套条件 -->
<while expression="inputAndCheck(secret)"/>

<!-- 复杂复合条件 -->
<while expression="part1 &amp;&amp; (part2 || part3) &amp;&amp; (part4 || part5 || part6)">
    <more/>
</while>
```

## 视觉形状

六边形（准备框），上方进入，左侧连出循环体，下方连出循环体外。

## 注意事项

- 循环体可以为空（自闭合 `<while expression="..." />` 或空内容）
- 条件表达式可以是函数调用（利用返回值）
- 支持复合条件，使用 `&amp;&amp;` 和 `||`
