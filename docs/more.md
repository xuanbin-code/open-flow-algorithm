# more - 占位节点

表示"此处有更多语句"的省略占位符，用于未完成的流程图或作为示例填充。

## XML 语法

```xml
<more/>
```

## 属性

无。

## 示例

```xml
<!-- 在 if 分支中作为占位 -->
<if expression="condition">
    <then>
        <more/>
    </then>
    <else>
        <more/>
    </else>
</if>

<!-- 在循环体中作为占位 -->
<while expression="condition">
    <more/>
</while>

<for variable="I" start="0" end="N" step="1">
    <more/>
</for>

<do expression="condition">
    <more/>
</do>
```

## 视觉形状

纯文本省略号（`...`），通常渲染为与其他节点不同的占位样式。

## 注意事项

- `<more/>` 始终是自闭合空元素
- 不表示实际的代码逻辑，仅用于占位
- 在用户插入节点的对话框中不会出现此选项
