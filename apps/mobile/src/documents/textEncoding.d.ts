export const TEXT_ENCODING_ERROR: string;
export const NOT_TEXT_ERROR: string;
export function decode_document_bytes(input: ArrayBuffer | Uint8Array): string;
export function decode_text_file(input: ArrayBuffer | Uint8Array, declared?: string | null): string;
export function declared_html_charset(input: ArrayBuffer | Uint8Array): string | null;
export function header_charset(value: string | null | undefined): string | null;
