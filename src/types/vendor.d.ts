declare module "stopword" {
  export const eng: string[];
  export function removeStopwords(
    tokens: string[],
    stopwords?: string[],
  ): string[];
}

declare module "keyword-extractor" {
  interface Options {
    language?: string;
    remove_digits?: boolean;
    return_changed_case?: boolean;
    remove_duplicates?: boolean;
  }
  export function extract(str: string, options?: Options): string[];
  const keyword: { extract: typeof extract };
  export default keyword;
}
