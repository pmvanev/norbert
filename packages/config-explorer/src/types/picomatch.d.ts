/**
 * Type declarations for picomatch v4.
 *
 * picomatch does not ship its own types and @types/picomatch is not
 * available for v4. This minimal declaration covers only the API surface
 * used by the path-tester module.
 */

declare module 'picomatch' {
  interface PicomatchOptions {
    readonly dot?: boolean;
    readonly windows?: boolean;
    readonly basename?: boolean;
    readonly matchBase?: boolean;
  }

  type MatcherFunction = (input: string) => boolean;

  interface Picomatch {
    (glob: string | readonly string[], options?: PicomatchOptions): MatcherFunction;
    isMatch(input: string, glob: string | readonly string[], options?: PicomatchOptions): boolean;
    test(input: string, regex: RegExp): { isMatch: boolean; match?: RegExpMatchArray; output?: string };
    matchBase(input: string, glob: string | readonly string[], options?: PicomatchOptions): boolean;
  }

  const picomatch: Picomatch;
  export default picomatch;
}
