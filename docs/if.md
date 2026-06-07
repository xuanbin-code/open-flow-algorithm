# if - 条件分支

根据条件表达式的真假，执行不同的分支路径。

## XML 语法

```xml
<if expression="条件表达式">
    <then>
        <!-- 条件为真时执行的节点 -->
    </then>
    <else>
        <!-- 条件为假时执行的节点（可为空） -->
    </else>
</if>
```

## 属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expression` | String | 是 | 条件表达式 |

## 子元素

| 元素 | 必填 | 说明 |
|------|------|------|
| `<then>` | 是 | True 分支，可包含任意代码节点，可为空 `<then/>` |
| `<else>` | 是 | False 分支，可包含任意代码节点，可为空 `<else/>`（但元素本身必须存在） |

## 示例

```xml
<!-- 标准 if-else -->
<if expression="N1&gt;N2">
    <then>
        <assign variable="MAX" expression="N1"/>
    </then>
    <else>
        <assign variable="MAX" expression="N2"/>
    </else>
</if>

<!-- 仅 then 分支 -->
<if expression="N3&gt;MAX">
    <then>
        <assign variable="MAX" expression="N3"/>
    </then>
    <else/>
</if>

<!-- 嵌套 if -->
<if expression="guess == 0">
    <then>
        <output expression="&quot;You gave up!&quot;" newline="True"/>
    </then>
    <else>
        <if expression="guess == secret">
            <then>
                <output expression="&quot;Correct!&quot;" newline="True"/>
            </then>
            <else>
                <if expression="guess &lt; secret">
                    <then>
                        <output expression="&quot;Your guess of &quot; &amp; guess &amp; &quot; is too low.&quot;" newline="True"/>
                    </then>
                    <else>
                        <output expression="&quot;Your guess of &quot; &amp; guess &amp; &quot; is too high.&quot;" newline="True"/>
                    </else>
                </if>
                <assign variable="playing" expression="true"/>
            </else>
        </if>
    </else>
</if>

<!-- 复杂条件 -->
<if expression="part1 and part2 or part3">
    <then>
        <more/>
    </then>
    <else/>
</if>
```

## 视觉形状

菱形（判定框），上方进入，左/右两侧分别连出 True/False 分支。

## 注意事项

- 逻辑运算符可混用：`&amp;&amp;`（与）、`||`（或）
- `<else/>` 即使为空也必须作为元素存在
