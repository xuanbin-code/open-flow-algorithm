# output - 输出语句

将表达式的值输出/打印到屏幕。

## XML 语法

```xml
<output expression="表达式" newline="True|False"/>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expression` | String | 是 | 要输出的表达式，支持字符串拼接和变量引用 |
| `newline` | Boolean | 是 | 输出后是否换行：`True` 或 `False` |

## 表达式语法

- 字符串常量用 `&quot;` 包围：`&quot;Hello&quot;`
- 字符串拼接用 `&amp;` 运算符：`&quot;Next is &quot; &amp; NEXT`
- 变量直接引用：`MAX`

## 示例

```xml
<!-- 输出文本并换行 -->
<output expression="&quot;Next is &quot; &amp; NEXT" newline="True"/>

<!-- 输出变量值 -->
<output expression="MAX" newline="True"/>

<!-- 输出多段拼接文本 -->
<output expression="&quot;Your guess of &quot; &amp; guess &amp; &quot; is too low.&quot;" newline="True"/>
```

## 视觉形状

平行四边形（倾斜矩形），与 `input` 形状相同但方向相反。
