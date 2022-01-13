// eslint-disable-next-line quotes
declare module "*.md" {
  type Render = (props: unknown) => string;
  export default Render;
}
