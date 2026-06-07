# assign - 赋值语句

将表达式的值赋给指定变量。

## XML 语法

```xml
<assign variable="变量名" expression="表达式"/>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `variable` | String | 是 | 被赋值的变量名 |
| `expression` | String | 是 | 赋值表达式 |

## 示例

```xml
<!-- 简单赋值 -->
<assign variable="NEXT" expression="N+1"/>

<!-- 函数调用赋值 -->
<assign variable="secret" expression="1 + Random(100)"/>

<!-- 复杂布尔表达式赋值 -->
<assign variable="playAgain" expression="Len(userResponse) &gt; 0&#13;&#10;  &amp;&amp; (Char(userResponse, 0) == &quot;y&quot; || Char(userResponse, 0) == &quot;Y&quot;)"/>
```

## 视觉形状

矩形（处理框），与 `declare` 共用同一形状类型。

## 注意事项

- `&#13;&#10;` 表示表达式中的换行（CR+LF）
- 逻辑与用 `&amp;&amp;`，逻辑或用 `||`
- 大于号用 `&gt;`，小于号用 `&lt;`
