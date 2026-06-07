# declare - 变量声明

声明一个或多个变量。

## XML 语法

```xml
<declare name="变量名" type="类型" array="True|False" size="数组大小"/>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | 变量名，支持逗号分隔声明多个变量，如 `"N, N2, N3"` |
| `type` | String | 是 | 数据类型：`Integer`、`Real`、`String`、`Boolean` |
| `array` | Boolean | 是 | 是否为数组：`True` 或 `False` |
| `size` | String | 否 | 数组大小，非数组时为空字符串 |

## 示例

```xml
<!-- 声明单个整型变量 -->
<declare name="N" type="Integer" array="False" size=""/>

<!-- 声明多个整型变量 -->
<declare name="N, NEXT" type="Integer" array="False" size=""/>

<!-- 声明布尔变量 -->
<declare name="B" type="Boolean" array="False" size=""/>

<!-- 声明字符串变量 -->
<declare name="S" type="String" array="False" size=""/>

<!-- 声明长度为 10 的实数数组 -->
<declare name="A" type="Real" array="True" size="10"/>
```

## 视觉形状

矩形（处理框），与 `assign` 共用同一形状类型。
