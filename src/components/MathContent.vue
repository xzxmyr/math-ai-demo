<template>
  <span ref="el" class="math-content"></span>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 数学公式渲染组件
 * 支持 $...$ 行内公式 与 $$...$$ / \[...\] 独立公式, 其余文本原样保留(保留换行)。
 * 渲染失败时回退为原文, 不影响可读性。
 */
const props = defineProps({
  text: { type: String, default: '' },
});

const el = ref(null);

const INLINE_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]/g;

function render() {
  const node = el.value;
  if (!node) return;
  const text = props.text ?? '';

  const frag = document.createDocumentFragment();
  const appendText = (t) => frag.appendChild(document.createTextNode(t));

  let last = 0;
  let m;
  while ((m = INLINE_RE.exec(text)) !== null) {
    appendText(text.slice(last, m.index));
    const math = m[1] ?? m[2] ?? m[3];
    const displayMode = Boolean(m[1] || m[3]);
    try {
      const html = katex.renderToString(math.trim(), {
        displayMode,
        throwOnError: false,
        strict: false,
      });
      const span = document.createElement('span');
      span.innerHTML = html;
      frag.appendChild(span);
    } catch {
      appendText(m[0]);
    }
    last = m.index + m[0].length;
  }
  appendText(text.slice(last));

  node.innerHTML = '';
  node.appendChild(frag);
}

onMounted(render);
watch(() => props.text, render);
</script>

<style scoped>
.math-content {
  white-space: pre-wrap;
  word-break: break-word;
}
.math-content :deep(.katex-display) {
  margin: 0.4em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
