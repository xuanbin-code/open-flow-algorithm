# input - 输入语句

从用户端读取输入值并存入指定变量。

## XML 语法

```xml
<input variable="变量名"/>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `variable` | String | 是 | 接收输入值的变量名 |

## 示例

```xml
<!-- 读取输入存入 N -->
<input variable="N"/>

<!-- 依次读取输入存入不同变量 -->
<input variable="N1"/>
<input variable="N2"/>
<input variable="N3"/>

<!-- 读取字符串输入 -->
<input variable="userResponse"/>
```

## 视觉形状

平行四边形（倾斜矩形），表示数据输入。

## 注意事项

- 多个连续的 `<input>` 元素在渲染时可能被合并为一个输入框
- 变量需先通过 `<declare>` 声明
