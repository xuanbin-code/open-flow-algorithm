# for - 计数循环

从起始值到终止值，按步长进行确定次数的循环。等同于其他语言中的 `for` 循环。

## XML 语法

```xml
<for variable="循环变量" start="起始值" end="终止值" step="步长">
    <!-- 循环体，可包含任意代码节点 -->
</for>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `variable` | String | 是 | 循环计数器变量名 |
| `start` | String/Number | 是 | 循环起始值 |
| `end` | String/Number | 是 | 循环终止值 |
| `step` | String/Number | 是 | 每次迭代的步长（增量） |

## 示例

```xml
<!-- 基本 for 循环：I 从 0 到 N，步长为 1 -->
<for variable="I" start="0" end="N" step="1">
    <more/>
</for>
```

## 视觉形状

六边形（准备框），与 `while` 形状相同，渲染为前测循环样式。

## 注意事项

- 此项目中将 `for` 渲染为与 `while` 相同的前测循环形状
- `start`、`end`、`step` 可以是变量名或常量
- 循环变量由循环自身管理，无需提前声明
