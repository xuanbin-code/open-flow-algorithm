# Vueflow - Guide

**Pages:** 23

---

## Background | Vue Flow

**URL:** https://vueflow.dev/guide/components/background.html

**Contents:**
- Background ​
- Installation ​
- Usage ​
- Props ​

Vue Flow comes with two background pattern variants: dots and lines.

To use the background simply pass the Background component as a child to the VueFlow component.

**Examples:**

Example 1 (elixir):
```elixir
yarn add @vue-flow/background

# or
npm install @vue-flow/background
```

Example 2 (jsx):
```jsx
<script setup>
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
</script>

<template>
  <VueFlow>
    <Background />
  </VueFlow>
</template>
```

---

## Composables | Vue Flow

**URL:** https://vueflow.dev/guide/composables.html

**Contents:**
- Composables ​
- useVueFlow ​
  - State creation and injection ​
    - Enforcing a specific state instance ​
- useHandleConnections ​
- useNodeConnections ​
- useNodesData ​
- useNodeId ​
- useHandle ​

The useVueFlow composable provides you with a set of methods to interact with the graph.

useVueFlow exposes the whole internal state, including the nodes and edges. The values are reactive, meaning changing the values returned from useVueFlow will trigger changes in the graph.

The useVueFlow composable creates, on first call, a new instance of the VueFlowStore and injects it into the Vue component tree. This allows you to access the store from any child component using the useVueFlow composable.

This also means that the first call of useVueFlow is crucial as it determines the state instance that will be used throughout the component tree. You can think of it as a sort of <VueFlowProvider> wrapper that is automatically injected into the component tree.

You can read more about this in the State section of the guide.

If necessary, you can enforce the use of a specific state instance by passing an id to the useVueFlow composable.

useHandleConnections provides you with an array of connections that are connected to specific <Handle>.

useNodeConnections provides you with an array of connections that are connected to a specific node. This composable is especially useful when you want to get all connections (of either type source or target) of a node.

useNodesData provides you with an array of data objects depending on the node ids you pass to it. It's especially useful when used together with useHandleConnections.

To further narrow down the type of the returned data, you can pass a guard function as the 2nd argument.

useNodeId provides you with the current node id.

This composable should be called inside a custom node component, as the id for the node is provided by the internal <NodeWrapper /> component.

Instead of using the Handle component you can use the useHandle composable to create your own custom nodes.

useHandle provides you with a pointerDown- and click-handler functions that you can apply to the element you want to use as a node-handle.

This is how the default handle component is built:

**Examples:**

Example 1 (jsx):
```jsx
<script setup>
import { ref } from 'vue'
import { useVueFlow, VueFlow } from '@vue-flow/core'

const { onInit, findNode, fitView, snapToGrid } = useVueFlow()

const nodes = ref([/* ... */])

const edges = ref([/* ... */])

// to enable snapping to grid
snapToGrid.value = true

// any event that is emitted from the `<VueFlow />` component can be listened to using the `onEventName` method
onInit((instance) => {
  // `instance` is the same type as the return of `useVueFlow` (VueFlowStore)
  
  fitView()
  
  const node = findNode('1')
  
  if (node) {
    node.position = { x: 100, y: 100 }
  }
})
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" />
</template>
```

Example 2 (typescript):
```typescript
import { useVueFlow } from '@vue-flow/core'

const { onInit } = useVueFlow({ id: 'my-flow-instance' })

onInit((instance) => {
  // `instance` is the same type as the return of `useVueFlow` (VueFlowStore)
})
```

Example 3 (typescript):
```typescript
import { type HandleConnection, useHandleConnections } from '@vue-flow/core'

// get all connections where this node is the target (incoming connections)
const targetConnections = useHandleConnections({
  // type is required
  type: 'target',
})

// get all connections where this node is the source (outgoing connections)
const sourceConnections = useHandleConnections({
  type: 'source',
})

const connections = useHandleConnections({
  id: 'handle-1', // you can explicitly pass a handle id if there are multiple handles of the same type
  nodeId: '1', // you can explicitly pass a node id, otherwise it's used from the `NodeId  injection
  type: 'target',
  onConnect: (connections: HandleConnection[]) => {
    // do something with the connections
  },
  onDisconnect: (connections: HandleConnection[]) => {
    // do something with the connections
  },
})
```

Example 4 (typescript):
```typescript
import { type HandleConnection, useNodeConnections } from '@vue-flow/core'

// get all connections where this node is the target (incoming connections)
const targetConnections = useNodeConnections({
  // type is required
  handleType: 'target',
})

// get all connections where this node is the source (outgoing connections)
const sourceConnections = useNodeConnections({
  handleType: 'source',
})

const handleConnections = useNodeConnections({
  handleId: 'handle-1', // you can explicitly pass a handle id if you want to get connections of a specific handle
})

const connections = useNodeConnections({
  nodeId: '1', // you can explicitly pass a node id, otherwise it's used from the `NodeId  injection
  handleType: 'target',
  onConnect: (connections: HandleConnection[]) => {
    // do something with the connections
  },
  onDisconnect: (connections: HandleConnection[]) => {
    // do something with the connections
  },
})
```

---

## Configuration | Vue Flow

**URL:** https://vueflow.dev/guide/vue-flow/config.html

**Contents:**
- Configuration ​
- Options / Props ​
- Updating Config ​
- Basic Options ​
  - id (optional) ​
  - nodes (optional) ​
  - edges (optional) ​
  - modelValue (optional) (deprecated) ​
  - node-types (optional) ​
  - edge-types (optional) ​

This page covers the configuration options available for Vue Flow and how to use and set them.

Vue Flow allows you to configure zoom, graph and flow behavior. Configuration can be passed either as props to the VueFlow component or as options to the useVueFlow composable.

You can update the configuration at any point, either by having them bound as props or using the state values returned by useVueFlow.

Unique id of Vue Flow.

It is used for the lookup and injection of the state instance.

Use either the modelValue prop or nodes separately. Do not mix them!

Use either the modelValue prop or edges separately. Do not mix them!

An array of elements (nodes + edges).

Use either the modelValue prop or nodes/edges separately. Do not mix them!

Type: Record<string, NodeComponent>

Default: DefaultNodeTypes

An object mapping node-type names to component definitions/name.

Type: Record<string, EdgeComponent>

Default: DefaultEdgeTypes

An object mapping edge-type names to component definitions/name.

Enable/disable default state update handlers.

If you want to have full control of state changes, you can disable the default behavior and apply your own change handlers to the state.

Check the controlled flow guide for more information.

Default: ConnectionMode.Loose

If set to loose all handles are treated as source handles (thus allowing for connections on target handles as well.)

Type: ConnectionLineOptions

Options for the connection line.

The options include the connection line type, style and possible marker types (marker-end/marker-start).

Type: ConnectionLineType

Default: ConnectionLineType.Bezier

The path to use when drawing a connection-line (bezier, step, smoothstep).

When using a custom connection line this prop does nothing.

Type: CSSProperties | null

Additional styles to add to the default connection-line.

Trigger fit view when viewport is mounted.

Define a key which can be used to activate zoom.

Overwrites zoom-on-scroll or pan-on-scroll behavior as long as the key is pressed.

Whether to allow zooming in and out when scrolling inside the Vue Flow container.

Whether to allow zooming in and out when pinching (touch or trackpad) inside the Vue Flow container.

Whether to allow zooming in and out when double-clicking (or tapping) inside the Vue Flow container.

Whether to allow panning inside the Vue Flow container.

Does not work together with zoom-on-scroll but will work together with zoom-activation-key-code.

Type: PanOnScrollMode

Default: PanOnScrollMode.Free

Specify on which axis panning is allowed (x, y or both).

Old name: paneMovable

Whether to allow moving the pane when dragging inside the Vue Flow container.

Enable this to prevent vue flow from scrolling inside its container, i.e. allow for the page to scroll.

Set a class name which prevents elements from triggering wheel-scroll events (thus disabling zoom/pan-scroll behavior on the element).

Useful if you want to allow for scrolling inside a node

Set a class name which prevents elements from triggering pan-scroll events.

Type: ViewportTransform

Default: { zoom: 1, position: { x: 0, y: 0 } }

The default viewport when the component is mounted.

Type: CoordinateExtent

The area in which the viewport can be moved around.

Define a key which can be used to activate the selection rect.

Define a key which can be used to activate multi-selection.

Multi-selection can be used to select multiple nodes with clicks.

Define a key which can be used to activate remove elements from the pane.

Globally enable/disable dragging nodes.

Can be overwritten by setting draggable on a specific node element.

Globally enable/disable connecting nodes.

Can be overwritten by setting connectable on a specific node element.

Type: CoordinateExtent

The area in which nodes can be moved around.

Can be overwritten by setting extent on a specific node element.

If enabled, nodes will be placed and moved in a grid-like fashion.

If snapToGrid is enabled, nodes will be placed and moved in a grid-like fashion according to the snapGrid value.

Globally enable/disable updating edges.

If set to 'source' only source markers are updatable

If set to 'target' only target markers are updatable

If set to 'true' both source and target markers are updatable

Can be overwritten by setting updatable on a specific edge element.

The default color value which is used when presenting edge-markers (arrowheads).

The radius at which an edge-updater can be triggered.

Allow edges to be created by clicking two handles in a row.

Useful if you want to enable creating edges on a touch device.

Type: DefaultEdgeOptions

Default values when creating a new edge.

Does not work for the addEdge utility!

Type: boolean | Connector

When connection is emitted, automatically create a new edge from params.

Also accepts a Connector which returns an edge-like object or false (if creating an edge is not allowed).

This option can be used as a shorthand for onConnect((params) => addEdges([params])).

When enabled, edges will be grouped by z-index and elevated when the nodes they connect to are selected.

This is useful if you want to show the edges on top of the nodes.

By default, edges have a z-index of 0.

Skip rendering elements that are not visible currently (either hidden or outside the current pane dimensions).

Enable/disable selecting elements.

**Examples:**

Example 1 (vue):
```vue
<!-- Pass configuration as props -->
<template>
  <VueFlow :default-viewport="{ zoom: 0.5 }" :max-zoom="4" :min-zoom="0.1" />
</template>
```

Example 2 (vue):
```vue
<script setup>
const nodesDraggable = ref(false)

const toggleNodesDraggable = () => {
  // toggle the state
  nodesDraggable.value = !nodesDraggable.value
}
</script>
<template>
  <VueFlow :nodes-draggable="nodesDraggable">...</VueFlow>
</template>
```

Example 3 (jsx):
```jsx
<script setup>
const { nodesDraggable } = useVueFlow()

const toggleNodesDraggable = () => {
  nodesDraggable.value = !nodesDraggable.value
}
</script>
```

Example 4 (vue):
```vue
<script setup>
import { ref } from 'vue'  
import { VueFlow } from '@vue-flow/core'

const nodes = ref([
  { 
    id: '1', 
    type: 'input',
    position: { x: 250, y: 5 },
    data: { label: 'Node 1' },
  },
  { 
    id: '2', 
    position: { x: 100, y: 100 },
    data: { label: 'Node 2' },
  },
  { 
    id: '3', 
    position: { x: 400, y: 100 },
    data: { label: 'Node 3' },
  },
  { 
    id: '4', 
    type: 'output',
    position: { x: 400, y: 200 },
    data: { label: 'Node 4' },
  },
])
</script>
<template>
  <VueFlow :nodes="nodes" />
</template>
```

---

## Controlled Flow | Vue Flow

**URL:** https://vueflow.dev/guide/controlled-flow.html

**Contents:**
- Taking Control of Vue Flow ​
- What is a Change? ​
  - Why is no change emitted when I update a node? ​
- The applyDefault option ​
- onNodesChange / onEdgesChange events ​
- applyNodeChanges / applyEdgeChanges ​
- Validating Changes ​
- V-Model Nodes and Edges ​

This API is subject to change in the next major release where changes will not be applied automatically anymore.

By default, Vue Flow will apply changes automatically, so you don't have to worry about it.

Though, there are cases where you want to take control of changes and apply them manually after some processing and validations for example.

In this guide, we will learn how to take control of changes and apply them manually.

A change is anything that is triggered by an interaction with the flow, like adding, updating (position, selected), or removing a node or an edge, either by dragging, clicking etc. or by using the provided API.

These changes are communicated to the user-land through the onNodesChange and onEdgesChange events.

Possible Changes include:

Changes do not refer to any change in the flow, like zooming or panning, or just updating the data object of a node.

Vue Flow will not track your nodes/edges and try to figure out what changed, it will only emit changes when you interact with the flow or use the API.

For example this will not emit a change:

This is because Vue Flow does not know that the node with id 1 was removed, it only knows about changes that are triggered by the user or the API.

This, for example, will emit a change:

The applyDefault option is a prop that can be passed to the <VueFlow> component to enable or disable automatic change handling.

By setting this option to false, we tell Vue Flow to not apply changes automatically anymore, that way we can take control of changes and apply them manually.

Vue Flow provides two events that can be used to listen to changes on nodes and edges. These events are emitted regardless of the applyDefault option, so you can use them to listen to changes even if you have automatic changes enabled.

Vue Flow provides two functions that can be used to apply changes manually.

These functions are available from the useVueFlow composable.

Using what we just learned, we can now take control of changes and apply them manually.

In this example, we will first disable automatic change handlers with applyDefault, then use the onNodesChange event to listen to changes and validate delete changes and, if they are valid, use applyNodeChanges to apply them.

Checkout the confirm delete example.

In some cases you want to sync the state of internal nodes/edges with your own state, for those cases you can use the v-model directive to bind the internal state with your own state.

Doing this will sync the internal state with your own state, which is useful for situations where you update internal nodes and edges but also want those changes to be reflected in your own state.

For example, if you update the type of nodes using updateNode and want to see the same change reflected in your own nodes state and not just in the internal state.

**Examples:**

Example 1 (javascript):
```javascript
<script setup>
import { ref } from 'vue'

const nodes = ref([
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' },
  },
])

// this function *will not* emit a change
function removeNode() {
  nodes.value = nodes.value.filter((node) => node.id !== '1')
}
</script>
```

Example 2 (jsx):
```jsx
<script setup>
import { ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'

const nodes = ref([
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' },
  },
])

// this function *will* emit a change
const { removeNodes } = useVueFlow()

removeNodes('1')
</script>
```

Example 3 (typescript):
```typescript
<template>
  <VueFlow :nodes="nodes" :edges="edges" :apply-default="false" />
</template>
```

Example 4 (typescript):
```typescript
<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'  

const { onNodesChange, onEdgesChange } = useVueFlow()

onNodesChange((changes) => {
  // changes are arrays of type `NodeChange`
  console.log(changes)
})

onEdgesChange((changes) => {
  // changes are arrays of type `EdgeChange`
  console.log(changes)
})
  
const onChange = (changes) => {
  // changes are arrays of type `NodeChange` or `EdgeChange`
  console.log(changes)
}
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" @nodes-change="onChange" @edges-change="onChange" />
</template>
```

---

## Controls | Vue Flow

**URL:** https://vueflow.dev/guide/components/controls.html

**Contents:**
- Controls ​
- Installation ​
- Usage ​
- Props ​
- Emits ​
- Slots ​
  - Control Buttons ​
  - Icons ​

The control panel contains a zoom-in, zoom-out, fit-view and a lock/unlock button.

To use the controls simply pass the Controls component as a child to the VueFlow component.

Make sure you also import the styles as these are not part of the default theme anymore.

**Examples:**

Example 1 (elixir):
```elixir
yarn add @vue-flow/controls

# or
npm install @vue-flow/controls
```

Example 2 (jsx):
```jsx
<script setup>
import { VueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'

// import default controls styles
import '@vue-flow/controls/dist/style.css'
</script>

<template>
  <VueFlow>
    <Controls />
  </VueFlow>
</template>
```

---

## Control Button | Vue Flow

**URL:** https://vueflow.dev/guide/components/control-button.html

**Contents:**
- Control Button ​
- Usage ​
- Slots ​

You can use the existing ControlButton component to create new control buttons.

To use the component pass the ControlButton component as a child to the Controls component.

**Examples:**

Example 1 (vue):
```vue
<template>
  <VueFlow>
    <Controls>
      <ControlButton>
        <i class="fa fa-plus"></i>
      </ControlButton>
    </Controls>
  </VueFlow>
</template>
```

---

## Edges | Vue Flow

**URL:** https://vueflow.dev/guide/edge.html

**Contents:**
- Introduction to Edges ​
- Adding Edges to the Graph ​
- Removing Edges from the Graph ​
- Updating Edge Data ​
- Predefined Edge-Types ​
  - Default Edge (Bezier) ​
  - Step Edge ​
  - Smoothstep Edge ​
  - Straight Edge ​
- User-Defined Edges ​

Edges are the links connecting your nodes, forming a map. Each edge runs from one handle to another, and can be customized to your liking.

Remember, every edge is unique and thus requires a unique id, a source and target node id.

For the full list of options available for an edge, check out the Edge Type.

Edges are rendered by passing them to the edges prop (or the deprecated v-model prop) of the Vue Flow component.

This method will not create a change. Check out the Controlled Flow section for more information.

If you are working with more complex graphs or simply require access to the internal state, the useVueFlow composable will come in handy.

The addEdges action is available through useVueFlow, allowing you to add edges straight to the state.

What's more, this action isn't limited to the component rendering the graph; it can be utilized elsewhere, like in a Sidebar or Toolbar.

Similar to adding edges, edges can be removed from the graph by removing them from the mode-value (using v-model) or from the edges prop of the Vue Flow component.

The removeEdges action is available through useVueFlow, allowing you to remove edges straight from the state.

You can also use this action outside the component rendering the graph, like in a Sidebar or Toolbar.

Since edges are reactive object, you can update their data at any point by simply mutating it. This allows you to change the label, or even add new properties to the data object at any point in time.

There are multiple ways of achieving this, here are some examples:

Vue Flow provides several built-in edge types that you can leverage immediately. The included node types are default (bezier), step, smoothstep and straight.

The default edge is a bezier curve that connects two nodes.

A step edge has a straight path with a step towards the target.

The same as the step edge though with a border radius on the step (rounded step).

A simple straight path.

On top of the default edge types mentioned earlier, you can create as many custom edge-types as you need. Edge-types are determined from your edges' definitions.

Vue Flow will then attempt to resolve this edge-type to a component. Priority is given to a definition in the edgeTypes object of the state. Next, it tries to match the component to a globally registered one with the same name. Finally, it searches for a provided template slot to fill in the edge-type.

If no methods produce a result in resolving the component, the default edge-type is used as a fallback.

One of the easiest ways to define custom edges is, by passing them as template slots. Dynamic resolution to slot-names is done for your user-defined edge-types, meaning a edge with the type custom is expected to have a slot named #edge-custom.

Alternatively, edge-types can also be defined by passing an object as a prop to the VueFlow component (or as an option to the composable).

Take precaution to mark your components as raw (utilizing the marked function from the Vue library) to prevent their conversion into reactive objects. Otherwise, Vue will display a warning on the console.

Your custom edges are enclosed so that fundamental functions like selecting operate. But you may wish to expand on these features or implement your business logic inside edges, thus your edges receive the following properties:

Vue Flow provides two main ways of listening to edge events, either by using useVueFlow to bind listeners to the event handlers or by binding them to the <VueFlow> component.

Interact to see events in browser console

To override the styles of the default theme, visit the Theming section.

**Examples:**

Example 1 (vue):
```vue
<script setup>
import { ref, onMounted } from 'vue'
import { VueFlow } from '@vue-flow/core'

const nodes = ref([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  },
  {
    id: '2',
    position: { x: 50, y: 250 },
    data: { label: 'Node 2', },
  }
]);

const edges = ref([
  {
    id: 'e1->2',
    source: '1',
    target: '2',
  }
]);
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" />
</template>
```

Example 2 (json):
```json
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import { VueFlow } from '@vue-flow/core'

const nodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  },
  {
    id: '2',
    position: { x: 50, y: 250 },
    data: { label: 'Node 2', },
  }
]);

const edges = ref<Edge[]>([
  {
    id: 'e1->2',
    source: '1',
    target: '2',
  }
]);
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" />
</template>
```

Example 3 (vue):
```vue
<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'

const initialNodes = ref([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  },
  {
    id: '2',
    position: { x: 50, y: 250 },
    data: { label: 'Node 2', },
  }
])

const { addEdges } = useVueFlow()

addEdges([
  {
    source: '1',
    target: '2',

    // if a node has multiple handles of the same type,
    // you should specify which handle to use by id
    sourceHandle: null,
    targetHandle: null,
  }
])
</script>

<template>
  <VueFlow :nodes="initialNodes" />
</template>
```

Example 4 (vue):
```vue
<script setup>
import { ref, onMounted } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'

const nodes = ref([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  },
  {
    id: '2',
    position: { x: 50, y: 250 },
    data: { label: 'Node 2', },
  },
]);

const edges = ref([
  {
    id: 'e1->2',
    source: '1',
    target: '2',
  }
]);

function removeEdge(id) {
  edges.value = edges.value.filter((edge) => edge.id !== id)
}
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges">
    <Panel>
      <button @click="removeEdge('e1->2')">Remove Edge</button>
    </Panel>
  </VueFlow>
</template>
```

---

## Edge | Vue Flow

**URL:** https://vueflow.dev/guide/utils/edge.html

**Contents:**
- Edge ​
- getBezierPath ​
- getSimpleBezierPath ​
- getSmoothStepPath ​
- getStraightPath ​

Vue Flow exports a couple of utilities you can use to create your own custom edges without having to worry how to actually implement the edge path calculation.

This can be helpful if you don't want to actually change the way the edge path is calculated but just want to implement some custom logic on top of the regular edge behavior.

Alternatively, all default edge components are also exported and can be used to create custom edges.

A function that returns a bezier path and center positions.

A function that returns a simple bezier path (no curvature from and toward handles) and center positions.

A function that returns a smoothstep path (you can use a borderRadius 0 for a step path).

You can use borderRadius: 0 to create a step path with no smooth corners.

A function that returns a straight path.

**Examples:**

Example 1 (jsx):
```jsx
<script lang="ts" setup>
// CustomEdge.vue
import { EdgeProps, BezierEdge, SmoothStepEdge, StepEdge, StraightEdge } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

// do some custom logic
</script>
<template>
  <!-- wrap the bezier edge or do something else in the template -->
  <BezierEdge v-bind="props" />
</template>
```

Example 2 (typescript):
```typescript
<script lang="ts" setup>
import { computed } from "vue"
import { BaseEdge, getBezierPath, EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const edgePathParams = computed(() => getBezierPath({ ...props, curvature: 0.5 }))
</script>

<template>
  <BaseEdge :path="edgePathParams[0]" />
</template>
```

Example 3 (typescript):
```typescript
<script lang="ts" setup>
import { computed } from "vue"
import { BaseEdge, getSimpleBezierPath, EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const edgePathParams = computed(() => getSimpleBezierPath(props))
</script>

<template>
  <BaseEdge :path="edgePathParams[0]" />
</template>
```

Example 4 (typescript):
```typescript
<script lang="ts" setup>
import { computed } from "vue"
import { BaseEdge, getSmoothStepPath, EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const edgePathParams = computed(() => getSmoothStepPath({ ...props, borderRadius: 8 }))
</script>

<template>
  <BaseEdge :path="edgePathParams[0]" />
</template>
```

---

## Events | Vue Flow

**URL:** https://vueflow.dev/guide/vue-flow/events.html

**Contents:**
- Events ​
- Listening to Events ​
  - VueFlow Component ​
  - Flow Instance / useVueFlow ​

VueFlow provides a set of events that you can listen to in order to react to changes in the flow.

A full list of events can be found in the API Reference.

You can listen to events on the VueFlow component by using the @ directive:

You can also listen to events on the Flow instance by using the event hooks.

All events are available from useVueFlow as on<EventName>. For example, the node-click event is available as onNodeClick.

**Examples:**

Example 1 (vue):
```vue
<script setup>
import { ref } from 'vue';  
import { VueFlow } from '@vue-flow/core';

const nodes = ref([/* ... */]);
const edges = ref([/* ... */]);

// Node click event handler
function onNodeClick({ event, node }) {
  console.log('Node clicked:', node, event);
}

// Edge click event handler
function onEdgeClick({ event, edge }) {
  console.log('Edge clicked:', edge, event);
}
</script>

<template>
  <VueFlow :nodes="nodges" :edges="edges" @node-click="onNodeClick" @edge-click="onEdgeClick"></VueFlow>
</template>
```

Example 2 (vue):
```vue
<script setup>
import { ref } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';

const nodes = ref([/* ... */]);
const edges = ref([/* ... */]);

// All events are available from `useVueFlow` as `on<EventName>`
const { onNodeClick, onEdgeClick } = useVueFlow();

// Node click event handler
onNodeClick(({ event, node }) => {
  console.log('Node clicked:', node, event);
});

// Edge click event handler
onEdgeClick(({ event, edge }) => {
  console.log('Edge clicked:', edge, event);
});
</script>

<template>
  <VueFlow :nodes="nodges" :edges="edges" @node-click="onNodeClick" @edge-click="onEdgeClick"></VueFlow>
</template>
```

---

## Getting Started | Vue Flow

**URL:** https://vueflow.dev/guide/getting-started.html

**Contents:**
- Getting Started ​
- Prerequisites ​
- Play Online ​
  - new.vueflow.dev/js
  - new.vueflow.dev/ts
- Installation ​
- Quick Start ​
- TypeScript ​

This guide covers the basics of setting up and using Vue Flow. You'll learn how to install Vue Flow, configure it, and create your first flowchart.

If you're looking for a guide on how to setup a Vue project, check out the official Vue documentation.

Before you strap in, make sure you're equipped with:

Try out the sandbox starter templates for Vue Flow in JavaScript and TypeScript and get a feel for the library.

Use your preferred package manager to install Vue Flow:

In Vue Flow, a graph consists of nodes and edges.

Each node or edge requires a unique id.

Nodes also need a XY-position, while edges require a source and a target node id.

To ensure Vue Flow's is correctly displayed, make sure you include the necessary styles.

Refer to the Theming section for additional information.

Here's a simple example to get you started:

As Vue Flow is entirely written in TypeScript, we highly recommend utilizing TypeScript for improved developer experience and prevention of common errors. The necessary type definitions are included with the library.

For more information, review our TypeDocs documentation.

**Examples:**

Example 1 (elixir):
```elixir
$ npm add @vue-flow/core
```

Example 2 (elixir):
```elixir
$ pnpm add @vue-flow/core
```

Example 3 (elixir):
```elixir
$ yarn add @vue-flow/core
```

Example 4 (elixir):
```elixir
/* these are necessary styles for vue flow */
@import '@vue-flow/core/dist/style.css';

/* this contains the default theme, these are optional styles */
@import '@vue-flow/core/dist/theme-default.css';
```

---

## Graph | Vue Flow

**URL:** https://vueflow.dev/guide/utils/graph.html

**Contents:**
- Graph ​
- isEdge ​
- isNode ​
- addEdge (deprecated) ​
- updateEdge (deprecated) ​
- getOutgoers ​
- getIncomers ​
- getConnectedEdges ​
- getTransformForBounds ​
- getRectOfNodes ​

Confirms if an element is an edge.

Confirms if an element is a node.

In the composition API you should use addEdges of useVueFlow

Adds an edge to the elements array.

In the composition API you should use updateEdge of useVueFlow

Updates an edge to a new source or target node.

Returns all target elements of a node.

Returns all source elements of a node.

Returns all connected edges of a node.

Returns a transformation for the viewport according to input bounds.

Returns a rect of node elements.

Useful when you need to know the boundaries of a set of nodes.

Returns node elements that are inside a specified rect.

Returns a marker id for a marker definition.

**Examples:**

Example 1 (vue):
```vue
<script setup>
import { VueFlow, isEdge } from '@vue-flow/core'

const elements = ref([
  { id: '1', position: { x: 250, y: 5 }, },
  { id: '2', position: { x: 100, y: 100 }, },

  { id: 'e1-2', source: '1', target: '2', class: 'light' },
])

const toggleClass = () => {
  elements.value.forEach((el) => {
    if (isEdge(el)) {
      el.class = el.class === 'light' ? 'dark' : 'light'
    }
  })
}
</script>

<template>
  <VueFlow v-model="elements">
    <button @click="toggleClass">Toggle classes</button>
  </VueFlow>
</template>
```

Example 2 (vue):
```vue
<script setup>
import { VueFlow, isNode } from '@vue-flow/core'

const elements = ref([
  { id: '1', label: 'Node 1', position: { x: 250, y: 5 }, class: 'light' },
  { id: '2', label: 'Node 2', position: { x: 100, y: 100 }, class: 'light' },

  { id: 'e1-2', source: '1', target: '2' },
])

const toggleClass = () => {
  elements.value.forEach((el) => {
    if (isNode(el)) {
      el.class = el.class === 'light' ? 'dark' : 'light'
    }
  })
}
</script>

<template>
  <VueFlow v-model="elements">
    <button @click="toggleClass">Toggle classes</button>
  </VueFlow>
</template>
```

Example 3 (vue):
```vue
<script setup>
import { ref } from 'vue'
import { VueFlow, addEdge } from '@vue-flow/core'

const elements = ref([
  { id: '1', position: { x: 250, y: 5 } },
  { id: '2', position: { x: 100, y: 100 } },

  { id: 'e1-2', source: '1', target: '2' },
])

const onConnect = (params) => {
  addEdge(params, elements.value)
}
</script>
<template>
  <VueFlow v-model="elements" @connect="onConnect" />
</template>
```

Example 4 (vue):
```vue
<script setup>
import { VueFlow, updateEdge } from '@vue-flow/core'

const elements = ref([
  { id: '1', label: 'Node 1', position: { x: 250, y: 5 } },
  { id: '2', label: 'Node 2', position: { x: 100, y: 100 } },

  { id: 'e1-2', source: '1', target: '2' },
])

const onEdgeUpdate = ({ edge, connection }) => {
  elements.value = updateEdge(edge, connection, elements.value)
}
</script>
<template>
  <VueFlow v-model="elements" @edge-update="onEdgeUpdate" />
</template>
```

---

## Handles | Vue Flow

**URL:** https://vueflow.dev/guide/handle.html

**Contents:**
- Introduction to Handles ​
- <Handle> Component ​
- Handle Positions ​
  - Adjusting Handle Positions ​
- Multiple Handles ​
  - Positioning with Multiple Handles ​
- Hidden Handles ​
- Limiting Connections ​
- Connection Mode ​
- Dynamic Handle Positions & Adding/Removing Handles Dynamically ​

Handles are the small circles that are usually placed on the borders of a node. They are used to connect nodes together by dragging a connection-line from one handle to another, resulting in a connection (Edge) between the nodes.

Handles are a crucial part of VueFlow, as they are the main interaction point for a user to create edges between nodes.

Without handles, it is basically impossible to create edges between nodes, as the handles are used to calculate the source and target points for edges.

The <Handle> component is a component exported by @vue-flow/core that you can use to create a handle for a node. It is a wrapper around a <div> element that provides the necessary event handler bindings to start connections.

The <Handle> component can be used in a (custom) node component to create handles for the node. Using <Handle> components outside a node component context will not work as expected, so try to avoid this.

Handles can be placed on the following positions:

Each position corresponds to a side of the node. The position of the handle also determines which direction an edge will bend towards when drawn from and to a handle.

For example a handle with position="Position.Top" will result in an edge that bends to the top when drawn from that handle. A handle with position="Position.Right" will result in an edge that bends to the left when drawn to that handle.

Handles are positioned on their respective side using CSS with an absolute position. That means you can adjust what element a handle aligns itself with by wrapping it in a container that has a relative position.

A node can have multiple handles, the number of handles is not limited and you can use as many handles as you need. When using multiple handles of the same type (source or target), each handle needs to have a unique id.

The id prop is used to identify the handle when creating edges between nodes. If no id is provided, the first handle of the necessary type will be used.

Sometimes you want to add multiple handles to the same side. In that case you often end up having two handles on top of each other instead of next to each other. Handles will not layout themselves automatically, so you need to manually adjust their position.

You can do so using CSS styles. For example, you can set the top and bottom properties to position the handles on the top and bottom of the right side of the node.

In some cases you might not want to display a handle at all. You can hide a handle by setting opacity: 0 as the styles for that handle.

You cannot hide a handle by removing it from the DOM (for example using v-if or v-show) as that would break the calculations for the edges.

You can limit the number of connections a handle can have by setting the connectable prop on the <Handle> component.

This prop accepts a boolean value (defaults to true), a number (the maximum number of connections), or a function that returns a boolean.

Using a function allows you to implement custom logic to determine if a handle can be connected to or not.

By default, Vue Flow will use <VueFlow :connection-mode="ConnectionMode.Loose" /> which allows you to connect edges to any handle. That means connections between a source and another source type <Handle> are allowed.

If you want to restrict connections to only be made between source and target type handles, you can set the connection-mode prop to ConnectionMode.Strict.

In Vue Flow 1.x, there's no need to manually invoke updateNodeInternals when dynamically adding handles. Upon mounting, handles will automatically attempt to attach to the node. However, if for any reason this isn't happening as expected, you can stick to the guideline provided below to enforce Vue Flow to update the node internals.

At times, you may need to modify handle positions dynamically or programmatically add new handles to a node. In this scenario, the updateNodeInternals method found in Vue Flow's API comes in handy.

Invoking this method is vital when dealing with dynamic handles. If not, the node might fail to recognize these new handles, resulting in misaligned edges.

The updateNodeInternals function can be deployed in one of two ways:

**Examples:**

Example 1 (typescript):
```typescript
<script setup>
import { Handle } from '@vue-flow/core'
  
defineProps(['id', 'sourcePosition', 'targetPosition', 'data'])
</script>

<template>
  <Handle type="source" :position="sourcePosition" />
  
  <span>{{ data.label }}</span>
  
  <Handle type="target" :position="targetPosition" />
</template>
```

Example 2 (typescript):
```typescript
<template>
  <div>
    <span>{{ data.label }}</span>

    <div style="position: relative; padding: 10px">
      <Handle type="source" :position="Position.Right" />


      <Handle type="target" :position="Position.Left" />
    </div>
  </div>
</template>
```

Example 3 (jsx):
```jsx
<!-- each of these handles needs a unique id since we're using two `source` type handles -->
<Handle id="source-a" type="source" :position="Position.Right" />
<Handle id="source-b" type="source" :position="Position.Right" />

<!-- each of these handles needs a unique id since we're using two `target` type handles -->
<Handle id="target-a" type="target" :position="Position.Left" />
<Handle id="target-b" type="target" :position="Position.Left" />
```

Example 4 (javascript):
```javascript
const { onConnect } = useVueFlow()

onConnect(({ source, target, sourceHandle, targetHandle }) => {
  console.log('source', source)
  console.log('target', target)
  // these are the handle ids of the source and target node
  // if no id is specified these will be `null`, meaning the first handle of the necessary type will be used
  console.log('sourceHandle', sourceHandle)
  console.log('targetHandle', targetHandle)
})
```

---

## Introduction | Vue Flow

**URL:** https://vueflow.dev/guide/

**Contents:**
- Welcome to Vue Flow! ​
- Play Online ​
  - new.vueflow.dev/js
  - new.vueflow.dev/ts
- Key Features ​
  - Seamless Setup ​
  - Customizable ​
  - Efficient and Responsive ​
  - Utilities and Composability ​
  - Additional Components ​

Vue Flow is a bridge to the world of interactive flowcharts and graphs, empowering you to bring dynamism and interactivity to flowcharts and graphic representations. Whether it's crafting personal diagrams, generating dynamic editors, or anything else your imagination conjures up, Vue Flow is your creative companion.

Vue Flow makes it effortless to customize and extend basic functionalities by allowing the integration of your own bespoke nodes and edges. Additional components such as Background, Minimap, and Controls further enrich the interface, transforming your creations into engaging platforms.

Try out the sandbox starter templates for Vue Flow in JavaScript and TypeScript and get a feel for the library.

Vue Flow gets you into the action quickly. With built-in features like element dragging, zooming and panning, and selection, Vue Flow is ready to go right out of the box.

Vue Flow is yours to shape. From custom nodes and edges to connection lines, you can extend the functionality of Vue Flow to fit your creative needs.

Changes are tracked reactively by Vue Flow, ensuring that only the necessary elements are re-rendered.

Vue Flow is designed for complex uses, with built-in graph helper and state composable functions.

Vue Flow comes with supplementary components to enhance the user interface.

Vue Flow is written fully in TypeScript, ensuring a reliable and secure experience for developers.

---

## MiniMap Node | Vue Flow

**URL:** https://vueflow.dev/guide/components/minimap-node.html

**Contents:**
- MiniMap Node ​
- Usage ​
- Props ​
- Slots ​

The minimap node component can be used to extend the default minimap nodes. You can use it to add an icon to your node, or to add a custom tooltip etc.

To use the component pass the MiniMapNode as a child to the MiniMap component.

**Examples:**

Example 1 (vue):
```vue
<template>
  <VueFlow>
    <MiniMap>
      <template #node-input="props">
        <MiniMapNode v-bind="props" />
      </template>
    </MiniMap>
  </VueFlow>
</template>
```

---

## MiniMap | Vue Flow

**URL:** https://vueflow.dev/guide/components/minimap.html

**Contents:**
- MiniMap ​
- Installation ​
- Usage ​
  - Interactive MiniMap ​
- Props ​
- Slots ​

To use the minimap simply pass the MiniMap component as a child to the VueFlow component.

Make sure you also import the styles as these are not part of the default theme anymore.

The minimap can be made interactive by using the pannable and zoomable props.

When enabled, these props allow you to pan on drag and zoom on scroll using the MiniMap.

**Examples:**

Example 1 (elixir):
```elixir
yarn add @vue-flow/minimap
  
# or
npm install @vue-flow/minimap
```

Example 2 (jsx):
```jsx
<script setup>
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'

// import default minimap styles
import '@vue-flow/minimap/dist/style.css'
</script>

<template>
  <VueFlow>
    <MiniMap />
  </VueFlow>
</template>
```

Example 3 (vue):
```vue
<template>
  <VueFlow>
    <MiniMap pannable zoomable />
  </VueFlow>
</template>
```

---

## Nodes | Vue Flow

**URL:** https://vueflow.dev/guide/node.html

**Contents:**
- Introduction to Nodes ​
- Adding Nodes to the Graph ​
- Removing Nodes from the Graph ​
- Updating Node Data ​
- Predefined Node-Types ​
  - Default Node ​
  - Input Node ​
  - Output Node ​
- User-Defined Nodes ​
  - Template slots ​

Nodes are the underlying components of your graph. They can be any kind of data you want to visualize in your graph, existing independently and being interconnected through edges to create a data map.

Remember, every node is unique and thus requires a unique id and an XY-position.

For the full list of options available for a node, check out the Node Interface.

Nodes are rendered by passing them to the nodes prop (or the deprecated v-model prop) of the Vue Flow component.

This method will not create a change. Check out the Controlled Flow section for more information.

If you are working with more complex graphs or simply require access to the internal state, the useVueFlow composable will come in handy.

The addNodes action is available through useVueFlow, allowing you to add nodes straight to the state.

What's more, this action isn't limited to the component rendering the graph; it can be utilized elsewhere, like in a Sidebar or Toolbar.

If you want to have two-way binding of nodes, use v-model:nodes="nodes". This will allow you to mutate your nodes and have the changes reflected in the graph.

Similar to adding nodes, nodes can be removed from the graph by removing them from the mode-value (using v-model) or from the nodes prop of the Vue Flow component.

The removeNodes action is available through useVueFlow, allowing you to remove nodes straight from the state.

You can also use this action outside the component rendering the graph, like in a Sidebar or Toolbar.

Since nodes are reactive object, you can update their data at any point by simply mutating it. This allows you to disable or enable handles, change the label, or even add new properties to the data object at any point in time.

There are multiple ways of achieving this, here are some examples:

Vue Flow provides several built-in node types that you can leverage immediately. The included node types are default, input, and output.

A default node includes two handles and serves as a branching junction in your map.

You have the freedom to determine the location of handles in the node's definition.

An input node features a single handle, which is by default positioned at the bottom. It represents a starting point of your map.

An output node also possesses a single handle, although it is typically found at the top. This node represents a conclusion point of your map.

On top of the default node types mentioned earlier, you can create as many custom node-types as you need. Node-types are determined from your nodes' definitions.

Vue Flow will then attempt to resolve this node-type to a component. Priority is given to a definition in the nodeTypes object of the state. Next, it tries to match the component to a globally registered one with the same name. Finally, it searches for a provided template slot to fill in the node-type.

If no methods produce a result in resolving the component, the default node-type is used as a fallback.

One of the easiest ways to define custom nodes is, by passing them as template slots. Dynamic resolution to slot-names is done for your user-defined node-types, meaning a node with the type custom is expected to have a slot named #node-custom.

Alternatively, node-types can also be defined by passing an object as a prop to the VueFlow component (or as an option to the composable).

Take precaution to mark your components as raw (utilizing the marked function from the Vue library) to prevent their conversion into reactive objects. Otherwise, Vue will display a warning on the console.

You can find a working example here.

Your custom nodes are enclosed so that fundamental functions like dragging or selecting operate. But you may wish to expand on these features or implement your business logic inside nodes, thus your nodes receive the following properties:

Vue Flow provides two main ways of listening to node events, either by using useVueFlow to bind listeners to the event handlers or by binding them to the <VueFlow> component.

Interact to see events in browser console

To override the styles of the default theme, visit the Theming section.

When constructing a new node type, it's necessary for you to add some styling specific to it. User-created nodes don't have any default styles associated and thus need custom styling.

Sometimes, a node might contain a large amount of content, making it difficult for users to view everything without the aid of a scroll function. To facilitate this scrolling ability without invoking zoom or pan behaviors on the node, Vue Flow provides the noWheelClassName property.

The noWheelClassName property allows you to specify a class name that, when applied to a node, will disable the default zoom-on-scroll or pan-on-scroll events on that particular node.

By default, the noWheelClassName is nowheel.

There are certain scenarios where you might need to interact with the contents of a node without triggering a drag action on the node itself. This can be particularly useful when nodes contain interactive elements like input boxes, buttons, or sliders that you want your users to engage with.

To accomplish this, Vue Flow provides a noDragClassName property. This property allows specification of a class name, which when applied to an element within a node, prevents triggering a drag action on the node when the user interacts with that element.

By default, the noDragClassName is set as nodrag.

**Examples:**

Example 1 (vue):
```vue
<script setup>
import { ref, onMounted } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'

const nodes = ref([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  }
]);

function addNode() {
  const id = Date.now().toString()
  
  nodes.value.push({
    id,
    position: { x: 150, y: 50 },
    data: { label: `Node ${id}`, },
  })
}
</script>

<template>
  <VueFlow :nodes="nodes">
    <Panel>
      <button type="button" @click="addNode">Add a node</button>
    </Panel>
  </VueFlow>
</template>
```

Example 2 (typescript):
```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Node } from '@vue-flow/core'
import { VueFlow, Panel } from '@vue-flow/core'

const nodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1', },
  }
]);

function addNode() {
  const id = Date.now().toString()

  nodes.value.push({
    id,
    position: { x: 150, y: 50 },
    data: { label: `Node ${id}`, },
  })
}
</script>

<template>
  <VueFlow :nodes="nodes">
    <Panel>
      <button type="button" @click="addNode">Add a node</button>
    </Panel>
  </VueFlow>
</template>
```

Example 3 (vue):
```vue
<script setup>
import { ref } from 'vue'
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core'

const initialNodes = ref([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1' },
  }
])
const { addNodes } = useVueFlow()

function generateRandomNode() {
  return {
    id: Math.random().toString(),
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    label: 'Random Node',
  }
}

function onAddNode() {
  // add a single node to the graph
  addNodes(generateRandomNode())
}

function onAddNodes() {
  // add multiple nodes to the graph
  addNodes(Array.from({ length: 10 }, generateRandomNode))
}
</script>

<template>
  <VueFlow :nodes="initialNodes">
    <Panel>
      <button type="button" @click="onAddNode">Add a node</button>
      <button type="button" @click="onAddNodes">Add multiple nodes</button>
    </Panel>
  </VueFlow>
</template>
```

Example 4 (typescript):
```typescript
<script setup lang="ts">
import { ref } from 'vue'  
import type { Node } from '@vue-flow/core'  
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core'

const initialNodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Node 1' },
  }
])
const { addNodes } = useVueFlow()

function generateRandomNode() {
  return {
    id: Math.random().toString(),
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    label: 'Random Node',
    data: { 
      hello: 'world',
    }
  }
}

function onAddNode() {
  // add a single node to the graph
  addNodes(generateRandomNode())
}

function onAddNodes() {
  // add multiple nodes to the graph
  addNodes(Array.from({ length: 10 }, generateRandomNode))
}
</script>

<template>
  <VueFlow :nodes="initialNodes">
    <Panel>
      <button type="button" @click="onAddNode">Add a node</button>
      <button type="button" @click="onAddNodes">Add multiple nodes</button>
    </Panel>
  </VueFlow>
</template>
```

---

## Node Resizer | Vue Flow

**URL:** https://vueflow.dev/guide/components/node-resizer.html

**Contents:**
- Node Resizer ​
- Installation ​
- Usage ​
- Props ​
- Emits ​

This is a resizer component for Vue Flow. It can be used to resize your nodes.

When enabled, these props allow you to pan on drag and zoom on scroll using the MiniMap.

**Examples:**

Example 1 (elixir):
```elixir
yarn add @vue-flow/node-resizer
  
# or
npm install @vue-flow/node-resizer
```

Example 2 (vue):
```vue
<script setup>
import { ref } from 'vue'  
import { VueFlow } from '@vue-flow/core'
import initialNodes from './initialNodes'

// some nodes and edges
const nodes = ref(initialNodes)
</script>

<template>
  <VueFlow :nodes="nodes">
    <template #node-custom="nodeProps">
      <CustomNode :data="nodeProps.data"  />
    </template>
  </VueFlow>
</template>
```

Example 3 (typescript):
```typescript
<script lang="ts" setup>
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'

// make sure to include the necessary styles!
import '@vue-flow/node-resizer/dist/style.css'

defineProps(['data'])
</script>

<template>
  <NodeResizer min-width="100" min-height="30" />

  <Handle type="target" :position="Position.Left" />
  <Handle type="source" :position="Position.Right" />
</template>
```

---

## Node Toolbar | Vue Flow

**URL:** https://vueflow.dev/guide/components/node-toolbar.html

**Contents:**
- Node Toolbar ​
- Installation ​
- Usage ​
- Props ​
- Slots ​

This is a toolbar component for Vue Flow. It can be used to create a floating Toolbar next to your nodes. You can either display the Toolbar by setting the visibility prop or automatically showing the Toolbar on selected nodes.

**Examples:**

Example 1 (elixir):
```elixir
yarn add @vue-flow/node-toolbar

# or
npm install @vue-flow/node-toolbar
```

Example 2 (vue):
```vue
<script setup>
import { VueFlow } from '@vue-flow/core'
import initialNodes from './initialNodes'

// some nodes and edges
const nodes = ref(initialNodes)
</script>

<template>
  <VueFlow :nodes="nodes">
    <template #node-custom="nodeProps">
      <CustomNode :data="nodeProps.data" />
    </template>
  </VueFlow>
</template>
```

Example 3 (typescript):
```typescript
<script lang="ts" setup>
import { Handle, Position } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'

interface NodeData {
  toolbarVisible: boolean
  toolbarPosition: Position
}

interface Props {
  data: NodeData
  label: string
}

defineProps<Props>()
</script>

<template>
  <NodeToolbar :is-visible="data.toolbarVisible" :position="data.toolbarPosition">
    <button>delete</button>
    <button>copy</button>
    <button>expand</button>
  </NodeToolbar>

  <Handle type="target" :position="Position.Left" />
  <Handle type="source" :position="Position.Right" />
</template>
```

---

## Slots | Vue Flow

**URL:** https://vueflow.dev/guide/vue-flow/slots.html

**Contents:**
- Slots ​
- ​
- Default ​
- Connection Line ​
- Zoom Pane ​

Vue Flow provides several slots for customization. In addition to the node and edge slots (see the guide on nodes and edges), there are a number of other slots you can use to customize the visualization.

The default slot can be used to nest elements inside the Vue Flow wrapper <div>. It will not be rendered inside the viewport, meaning it will not receive a transformation for scale or positioning. You can use the default slot to add a sidebar or floating toolbar etc. to your graph.

The connection line slot allows you to pass down a custom connection line component, which will be used, when a connection is triggered.

The full description of connection line props can be found here.

The zoom pane slot is placed inside the viewport transformation, so that it scales and moves with the current viewport zoom and position.

**Examples:**

Example 1 (vue):
```vue
<template>
  <VueFlow>
    <template #connection-line="connectionLineProps">
      <CustomConnectionLine v-bind="connectionLineProps" />
    </template>
  </VueFlow>
</template>
```

Example 2 (vue):
```vue
<template>
  <VueFlow>
    <template #zoom-pane>
      <div>Some element inside the zoom pane</div>
    </template>
  </VueFlow>
</template>
```

---

## State | Vue Flow

**URL:** https://vueflow.dev/guide/vue-flow/state.html

**Contents:**
- State ​
- Accessing Internal State ​
- State Updates ​
- Access State in Options API ​

Under the hood Vue Flow uses Provide/Inject to pass around it's state between components. You can access the internal state through the useVueFlow composable.

useVueFlow can be used to either create a new state instance and inject it into the current component tree or inject an already existing store from the current context. Internal state can be manipulated, for example by adding new elements to the state. The state is reactive and changes will be reflected on the graph.

Using the composition API also allows us to pass the state around outside the current component context, thus we have a lot more flexibility when it comes to reading, writing and updating the state.

Consider this example, where we want to create a Sidebar that allows us to select all nodes.

We could pass all necessary info as props to the Sidebar, which could become either tedious or result in prop drilling, which we want to avoid. In this example it wouldn't be a big issue but if our destination was 3 components deep, it would become hard to track the flow of information.

Instead, we can initialize a Vue Flow store instance before the Sidebar is initialized, thus the instance becomes available as an injection in the component tree.

Now we can easily access our current state instance from our Sidebar without passing them as props.

If you have multiple store instances in the same context, make sure to give them a unique id in order to guarantee access to the correct instance. Otherwise useVueFlow will try to inject the first instance it can find in the current context, which would usually be the last one that has been injected.

State updates like removing elements or updating positions are applied by default. If you want to strictly control state changes you can disable this behavior by setting the applyDefault option/prop to false.

State changes are emitted by the onNodesChange or onEdgesChange events, which will provide an array of changes that have been triggered. To take control of state changes you can implement your own state update handlers or use the state helper functions that come with the library to mix it up.

Read more about this in the controlled flow guide.

useVueFlow was designed to be used in the composition API, but it is still possible to use it in the options API. Though it is necessary to pass a unique id for your Vue Flow state instance, otherwise a look-up will fail and Vue Flow will create a new state instance when mounted.

**Examples:**

Example 1 (jsx):
```jsx
<script setup>
import { useVueFlow } from '@vue-flow/core'

const { getNodes, onPaneReady } = useVueFlow()

// event handler
onPaneReady((i) => i.fitView())

// watch the stored nodes
watch(getNodes, (nodes) => console.log('nodes changed', nodes))
</script>
```

Example 2 (jsx):
```jsx
<!-- Container.vue -->
<template>
  <div>
    <Sidebar />
    <div class="wrapper">
      <VueFlow :nodes="nodes" :edges="edges" />
    </div>
  </div>
</template>
```

Example 3 (vue):
```vue
<script>
// Container.vue
import { useVueFlow  } from '@vue-flow/core'

// initialize a store instance in this context, so it is available when calling inject(VueFlow)
useVueFlow()
</script>
```

Example 4 (sql):
```sql
<script setup>
import { useVueFlow } from '@vue-flow/core'

const { nodesSelectionActive, addSelectedNodes, getNodes } = useVueFlow()

const selectAll = () => {
  addSelectedNodes(getNodes.value)
  nodesSelectionActive.value = true
}
</script>
<template>
  <aside>
    <div class="description">
      This is an example of how you can access the internal state outside of the Vue VueFlow component.
    </div>
    <div class="selectall">
      <button @click="selectAll">select all nodes</button>
    </div>
  </aside>
</template>
```

---

## Theming | Vue Flow

**URL:** https://vueflow.dev/guide/theming.html

**Contents:**
- Theming ​
- Library Styles ​
- Adjusting the Default Theme ​
  - Styling with CSS Classes ​
  - Using CSS Properties ​
  - Redefining Styles with CSS variables ​
- CSS Variables ​
- CSS Class Names ​
    - Containers ​
    - Edges ​

Let's take a tour around the library styles, customization opportunities, and other features that Vue Flow offers out of the box.

Vue Flow values flexibility and allows you to take the lead when it comes to styling. It showcases some obligatory stylings that must be imported, while leaving optional features, such as the default theme, up to your preference.

To import the necessary and optional styles:

The Vue Flow default theme functions as your baseline, which you can customize and decorate as per your liking using CSS rules, style and class properties, and CSS variables.

Here's how you can use CSS classes to add a pop of color or alter the font style for the theme:

You can also directly pass a style or class attribute to Vue Flow components and nodes/edges.

Below are a couple of examples on how you can do this:

Directly styling the Vue Flow component:

Styling nodes/edges with a style or class attribute:

Some of the defined theme styles can be overwritten using CSS variables. These alterations can be implemented either on a global scale or to individual elements.

Here's a concise list of CSS variables you can consider, along with their effects:

Here you'll find a handy reference guide of class names and their respective elements:

**Examples:**

Example 1 (elixir):
```elixir
/* these are necessary styles for vue flow */
@import '@vue-flow/core/dist/style.css';

/* this contains the default theme, these are optional styles */
@import '@vue-flow/core/dist/theme-default.css';
```

Example 2 (css):
```css
/* Use a purple theme for our custom node */
.vue-flow__node-custom {
    background: purple;
    color: white;
    border: 1px solid purple;
    border-radius: 4px;
    box-shadow: 0 0 0 1px purple;
    padding: 8px;
}
```

Example 3 (jsx):
```jsx
<VueFlow
  :nodes="nodes"
  :edges="edges"
  class="my-diagram-class"  
  :style="{ background: 'red' }"
/>
```

Example 4 (scala):
```scala
/* Customizing node by assigning class and style properties */
const nodes = ref([
  { 
    id: '1', 
    position: { x: 250, y: 5 },
    data: { label: 'Node 1' },
    
    // Add a class name to the node
    class: 'my-custom-node-class',
    
    // You can pass an object containing CSSProperties or CSS variables
    style: { backgroundColor: 'green', width: '200px', height: '100px' },
  },
])
```

---

## Troubleshooting | Vue Flow

**URL:** https://vueflow.dev/guide/troubleshooting.html

**Contents:**
- Troubleshooting ​
- Errors and Fixes ​
  - MISSING_VIEWPORT_DIMENSIONS ​
  - NODE_INVALID ​
  - NODE_NOT_FOUND ​
  - NODE_MISSING_PARENT ​
  - NODE_TYPE_MISSING ​
  - NODE_EXTENT_INVALID ​
  - EDGE_INVALID ​
  - EDGE_NOT_FOUND ​

This section aims to help you understand, avoid, and fix errors that may occur when using Vue Flow.

Vue Flow can emit several error types to help diagnose and resolve issues.

During development, Vue Flow emits warnings to the console for errors encountered. These warnings are intended to help developers identify and resolve issues without failing silently. In production, however, these warnings are suppressed.

You can handle errors by hooking into the onError event. This allows you to perform custom operations based on the type of error encountered. Here's an example of how to use the isErrorOfType utility to handle an error of NODE_INVALID type.

**Examples:**

Example 1 (typescript):
```typescript
<template>
  <!-- Ensure the parent container has a width and height -->
  <div style="width: 500px; height: 500px">
    <VueFlow :nodes="nodes" :edges="edges" />
  </div>
</template>
```

Example 2 (json):
```json
// Here's an example of some valid node configurations
const nodes = ref([
  { id: '1', type: 'input', label: 'Node 1', position: { x: 250, y: 5 } },
  { id: '2', label: 'Node 2', position: { x: 100, y: 100 } },
  { id: '3', type: 'output', label: 'Node 3', position: { x: 400, y: 200 } },
  { id: '4', type: 'special', label: 'Node 4', position: { x: 400, y: 200 } },
])
```

Example 3 (json):
```json
// Here's an example of a valid nested node configuration
const nodes = ref([
  { id: '1', type: 'input', label: 'Node 1', position: { x: 250, y: 5 } },
  { id: '2', label: 'Node 2', position: { x: 100, y: 100 }, parentNode: '1' },
  { id: '3', type: 'output', label: 'Node 3', position: { x: 400, y: 200 }, parentNode: '1' },
])
```

Example 4 (vue):
```vue
// Here's an example of some valid edge configurations
const edges = ref([
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-4', source: '1', target: '4' },
])
```

---

## Viewport Functions | Vue Flow

**URL:** https://vueflow.dev/guide/utils/instance.html

**Contents:**
- Viewport Functions ​
- project ​
- fitView ​
- fitBounds ​
- setViewport ​
- getViewport ​
- zoomIn ​
- zoomOut ​
- zoomTo ​
- getElements ​

Viewport Functions can be accessed via the useVueFlow utility or with the VueFlowStore instance provided by onPaneReady.

Transforms pixel coordinates to the internal VueFlow coordinate system.

This can be used when you drag nodes (from a sidebar for example) and need the internal position on the pane.

Fits the view port so that all nodes are visible.

Padding is 0.1 and includeHiddenNodes is false by default.

Fits the view port according to the bounds' rect input.

Sets position and zoom of the pane.

Gets position and zoom of the pane.

Zooms to specific level.

Returns currently stored elements (nodes + edges).

Returns currently stored nodes.

Returns currently stored edges.

Returns elements, position and zoom of the current flow state.

**Examples:**

Example 1 (jsx):
```jsx
<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'

const { onPaneReady } = useVueFlow()

// event handler
onPaneReady((instance) => instance.fitView())
</script>
```

Example 2 (vue):
```vue
<script>
import { VueFlow } from '@vue-flow/core'

export default defineComponent({
  components: { VueFlow },
  data() {
    return {
      instance: null,
    }
  },
  methods: {
    onPaneReady(vueFlowInstance) {
      vueFlowInstance.fitView()
      this.instance = vueFlowInstance
    }
  }
})
</script>
<template>
  <VueFlow @pane-ready="onPaneReady" />
</template>
```

Example 3 (css):
```css
vueFlowInstance.project({ x: 100, y: 100 })
```

Example 4 (css):
```css
vueFlowInstance.fitView({ padding: 0.25, includeHiddenNodes: true })
```

---
