import type Markdown from "*.md";

const load =
  (_module: unknown): Markdown =>
  () =>
    `markdown`;

export default load;
