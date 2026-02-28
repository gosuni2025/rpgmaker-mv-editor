declare module 'js-beautify' {
  interface JSBeautifyOptions {
    indent_size?: number;
    brace_style?: string;
    end_with_newline?: boolean;
    preserve_newlines?: boolean;
    [key: string]: unknown;
  }
  export function js(source: string, options?: JSBeautifyOptions): string;
  export function css(source: string, options?: JSBeautifyOptions): string;
  export function html(source: string, options?: JSBeautifyOptions): string;
}
