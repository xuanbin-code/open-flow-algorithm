# call - 函数调用

调用另一个函数（子程序）。

## XML 语法

```xml
<call expression="函数名(参数)"/>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expression` | String | 是 | 函数调用表达式，包含函数名和实参 |

## 示例

```xml
<!-- 调用无参函数 -->
<call expression="Selections()"/>

<!-- 返回值用于循环条件判断 -->
<while expression="playOneRound()"/>

<!-- 带参数调用 -->
<while expression="inputAndCheck(secret)"/>
```

## 视觉形状

矩形（侧边带双竖线），表示子程序/函数调用。
